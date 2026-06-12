from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.schemas.booking import BookingRequest, BookingResponse
from app.services.booking import attempt_booking, cancel_booking
from app.services.broadcaster import broadcast_slot_state
from app.core.redis import get_redis
from arq import create_pool
from app.worker.tasks import WorkerSettings
import json

router = APIRouter(prefix="/bookings", tags=["Bookings"])

@router.post("/", response_model=BookingResponse)
async def book_slot(request: BookingRequest, db: AsyncSession = Depends(get_db)):
    result = await attempt_booking(db, request)
    
    # Broadcast the immediate result (Success or Waitlisted)
    await broadcast_slot_state(
        str(request.slot_id), 
        result.status, 
        result.message
    )
    return result

@router.delete("/{slot_id}")
async def cancel_slot(slot_id: str, db: AsyncSession = Depends(get_db)):
    await cancel_booking(db, slot_id)
    
    # Broadcast that the slot is temporarily free
    await broadcast_slot_state(slot_id, "AVAILABLE", "Slot has been freed.")
    
    arq_redis = await create_pool(WorkerSettings.redis_settings)
    await arq_redis.enqueue_job('promote_user_from_waitlist', slot_id)
    
    return {"status": "CANCELED", "message": "Worker triggered for waitlist promotion."}

# --- THE REAL-TIME WEBSOCKET ENDPOINT ---
@router.websocket("/ws/{slot_id}")
async def slot_websocket(websocket: WebSocket, slot_id: str):
    await websocket.accept()
    redis = await get_redis()
    pubsub = redis.pubsub()
    channel = f"channel:slot:{slot_id}"
    
    # Subscribe this specific user to this specific slot's channel
    await pubsub.subscribe(channel)
    
    try:
        # Listen indefinitely for messages from the Redis channel
        async for message in pubsub.listen():
            if message["type"] == "message":
                data = message["data"]
                # FIX: Only decode if it arrives as raw bytes. If it's already a string, leave it alone.
                text_data = data.decode("utf-8") if isinstance(data, bytes) else data
                # Push the data straight to the user's browser
                await websocket.send_text(text_data)
    except WebSocketDisconnect:
        # Clean up the connection if the user closes their browser tab
        await pubsub.unsubscribe(channel)