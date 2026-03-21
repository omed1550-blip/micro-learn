from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/microlearn"
    GEMINI_API_KEY: str = ""
    APP_NAME: str = "Micro-Learning Engine"
    DEBUG: bool = True
    SECRET_KEY: str = "change-me-in-production"

    model_config = {"env_file": ".env"}


settings = Settings()
