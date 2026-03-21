import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.models import User, LearningModule, Flashcard, QuizQuestion, ReviewLog, StudySession, ManualDeck, ManualCard, DailyActivity, UserStats  # noqa: F401
from app.models.database import create_tables

app = FastAPI(title="Micro-Learning Engine", version="0.1.0")

_allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.on_event("startup")
async def startup():
    await create_tables()


@app.get("/health")
async def health():
    return {"status": "healthy", "version": "0.1.0"}
