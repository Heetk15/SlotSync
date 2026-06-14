import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "SlotSync"
    # Fallback to local dev URLs if env vars are missing
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql+psycopg://admin:securepassword@localhost:5433/slotsync")
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379")

    class Config:
        case_sensitive = True

settings = Settings()

# Cloud Provider Fix: Neon injects "postgresql://", which defaults to the old psycopg2 driver.
# We must intercept it and force it to use the modern async psycopg3 driver we installed.
if settings.DATABASE_URL.startswith("postgresql://"):
    settings.DATABASE_URL = settings.DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)