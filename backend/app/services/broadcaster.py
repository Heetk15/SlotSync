import json
import logging
from app.core.redis import get_redis

logger = logging.getLogger("broadcaster")

async def broadcast_slot_state(slot_id: str, status: str, message: str):
    """Publishes a real-time state change to the Redis Pub/Sub channel."""
    try:
        redis = await get_redis()
        channel = f"channel:slot:{slot_id}"
        payload = json.dumps({
            "slot_id": str(slot_id),
            "status": status,
            "message": message
        })
        # PUBLISH blasts the message to any WebSocket listening to this channel
        await redis.publish(channel, payload)
        logger.info(f"Broadcasted to {channel}: {status}")
    except Exception as e:
        logger.error(f"Broadcast failed: {str(e)}")