from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "SlotSync"
    # Notice the postgresql+psycopg schema. This tells SQLAlchemy to use our async driver.
    DATABASE_URL: str = "postgresql+psycopg://admin:securepassword@localhost:5432/slotsync"
    REDIS_URL: str = "redis://localhost:6379"

    class Config:
        case_sensitive = True

settings = Settings()