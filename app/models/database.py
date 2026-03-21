import logging
import socket

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

logger = logging.getLogger(__name__)

_SQLITE_FALLBACK = "sqlite+aiosqlite:///./micro_learn_local.db"


def _create_engine(url: str):
    kwargs = {"echo": settings.DEBUG}
    if url.startswith("sqlite"):
        kwargs["connect_args"] = {"check_same_thread": False}
    return create_async_engine(url, **kwargs)


def _pick_engine_url() -> str:
    """Pick database URL, falling back to SQLite if the primary DB host is unreachable."""
    db_url = settings.DATABASE_URL
    if db_url.startswith("sqlite"):
        return db_url
    # Quick DNS check to avoid slow connection timeouts
    try:
        from urllib.parse import urlparse
        parsed = urlparse(db_url.replace("+asyncpg", ""))
        host = parsed.hostname
        if host:
            socket.getaddrinfo(host, parsed.port or 5432, socket.AF_UNSPEC, socket.SOCK_STREAM)
    except (socket.gaierror, OSError) as e:
        logger.warning(f"Primary database host unreachable: {e}")
        logger.info("Using local SQLite database")
        return _SQLITE_FALLBACK
    return db_url


_selected_url = _pick_engine_url()
engine = _create_engine(_selected_url)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def create_tables():
    global engine, async_session
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database connected successfully")
    except Exception as e:
        logger.warning(f"Could not connect to primary database: {e}")
        logger.info("Falling back to local SQLite database")
        engine = _create_engine(_SQLITE_FALLBACK)
        async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("SQLite fallback database ready")


async def get_db():
    async with async_session() as session:
        yield session
