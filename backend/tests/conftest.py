import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from datetime import datetime, timedelta, timezone
from app.main import app
from app.db.session import AsyncSessionLocal
from app.db.models import Slot, SlotStatus
from app.core.rate_limit import check_rate_limit
from app.core.redis import init_redis, close_redis

# INTERVIEW SIGNAL: We override the rate limiter during testing 
# so we can aggressively test the database concurrency locks.
app.dependency_overrides[check_rate_limit] = lambda: None

@pytest_asyncio.fixture
async def client():
    """Provides an async HTTP client connected to our FastAPI app."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac

@pytest_asyncio.fixture
async def test_slot():
    """Seeds a fresh, available slot in the database before a test runs."""
    async with AsyncSessionLocal() as db:
        slot = Slot(
            start_time=datetime.now(timezone.utc),
            end_time=datetime.now(timezone.utc) + timedelta(hours=1),
            status=SlotStatus.AVAILABLE
        )
        db.add(slot)
        await db.commit()
        await db.refresh(slot)
        return str(slot.id)

@pytest_asyncio.fixture(autouse=True)
async def setup_redis():
    """
    Forces the in-memory test environment to initialize the Redis client pool
    since ASGITransport bypasses Uvicorn's standard startup events.
    """
    await init_redis()
    yield
    await close_redis()