from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "SlotSync"
    # Port updated to 5433 to bypass local collisions
    DATABASE_URL: str = "postgresql+psycopg://admin:securepassword@localhost:5433/slotsync"
    REDIS_URL: str = "redis://localhost:6379"

    class Config:
        case_sensitive = True

settings = Settings()