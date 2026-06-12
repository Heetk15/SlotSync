import sys
import asyncio

# --- WINDOWS ASYNCIO PATCH ---
# Force Windows to use the compatible SelectorEventLoop for psycopg3 async C-extensions
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
# -----------------------------

from arq.connections import RedisSettings
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import AsyncSessionLocal
from app.services.waitlist import pop_from_waitlist
from app.services.booking import attempt_booking
from app.schemas.booking import BookingRequest
from app.core.redis import get_redis, init_redis, close_redis
from app.core.config import settings
import json
import logging

# Configure logging so we can see the worker's heartbeat in the terminal
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("worker")

async def promote_user_from_waitlist(ctx, slot_id: str):
    """
    Triggered when a slot becomes available. Pops the next user and attempts to book.
    If it fails systemically, it catches the error and pushes to our Manual DLQ.
    """
    logger.info(f"Checking waitlist for slot: {slot_id}")
    
    # 1. Pop the oldest user from the Redis FIFO queue
    next_user_payload = await pop_from_waitlist(slot_id)
    if not next_user_payload:
        logger.info("Waitlist is empty. Slot remains available.")
        return

    logger.info(f"Promoting user with idempotency key: {next_user_payload['idempotency_key']}")
    
    request = BookingRequest(**next_user_payload)
    
    # 2. Open a fresh, isolated database session for the background task
    async with AsyncSessionLocal() as db:
        try:
            # 3. Reuse our core transactional logic to guarantee safety!
            result = await attempt_booking(db, request)
            logger.info(f"Promotion Successful! Slot booked.")
            return result.model_dump(mode='json')
            
        except Exception as e:
            logger.error(f"Promotion Failed: {str(e)}")
            # --- THE MANUAL DEAD LETTER QUEUE (DLQ) ---
            redis = await get_redis()
            dlq_payload = {
                "slot_id": slot_id,
                "user_payload": next_user_payload,
                "error": str(e)
            }
            await redis.lpush("dlq:booking_failures", json.dumps(dlq_payload))
            logger.error("Payload moved to Manual DLQ.")

async def startup(ctx):
    """Bootstraps the worker process by initializing its own database connections."""
    logger.info("Starting ARQ Worker...")
    await init_redis()

async def shutdown(ctx):
    """Gracefully spins down connections when the worker is stopped."""
    logger.info("Shutting down ARQ Worker...")
    await close_redis()

# ARQ Configuration Class
class WorkerSettings:
    functions = [promote_user_from_waitlist]
    on_startup = startup
    on_shutdown = shutdown
    # Safely convert our string URL into a strict ARQ Redis connection object
    redis_settings = RedisSettings.from_dsn(settings.REDIS_URL)