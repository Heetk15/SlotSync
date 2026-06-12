import redis.asyncio as redis
from app.core.config import settings

# We initialize this as None, and connect it during FastAPI's startup event
redis_client: redis.Redis | None = None

async def init_redis():
    global redis_client
    # decode_responses=True ensures we get Python strings back instead of raw bytes
    redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)

async def close_redis():
    global redis_client
    if redis_client:
        await redis_client.aclose()

# Dependency to inject Redis into our routes
async def get_redis() -> redis.Redis:
    if not redis_client:
        raise Exception("Redis client not initialized")
    return redis_client