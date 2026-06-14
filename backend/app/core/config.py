import os
from dotenv import load_dotenv

load_dotenv()

# Grab the raw URL from the environment (Render/Neon)
raw_db_url = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/slotsync")

# Fix the URL scheme for SQLAlchemy Async Engine
if raw_db_url and raw_db_url.startswith("postgresql://"):
    DATABASE_URL = raw_db_url.replace("postgresql://", "postgresql+asyncpg://", 1)
else:
    DATABASE_URL = raw_db_url

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")