import json
from app.core.redis import get_redis
from pydantic import UUID4

async def add_to_waitlist(slot_id: UUID4, user_payload: dict):
    """Pushes a failed booking attempt onto the Redis waitlist."""
    redis = await get_redis()
    queue_key = f"waitlist:{str(slot_id)}"
    
    # RPUSH adds to the right (end) of the list, ensuring FIFO order
    await redis.rpush(queue_key, json.dumps(user_payload))
    
async def pop_from_waitlist(slot_id: UUID4) -> dict | None:
    """Pops the oldest user from the waitlist."""
    redis = await get_redis()
    queue_key = f"waitlist:{str(slot_id)}"
    
    # LPOP removes and returns the first element from the left (front)
    payload_str = await redis.lpop(queue_key)
    
    if payload_str:
        return json.loads(payload_str)
    return None

async def get_waitlist_length(slot_id: UUID4) -> int:
    """Returns the current size of the waitlist for metrics."""
    redis = await get_redis()
    queue_key = f"waitlist:{str(slot_id)}"
    return await redis.llen(queue_key)