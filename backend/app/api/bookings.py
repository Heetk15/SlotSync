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

# --- THE PERIMETER DEFENSE & SECURITY ---
from app.core.rate_limit import check_rate_limit
from app.core.security import verify_token

router = APIRouter(prefix="/bookings", tags=["Bookings"])

# The rate limiter dependency intercepts the request before it ever reaches the database
# The verify_token dependency extracts the user identity from the JWT
@router.post("/", response_model=BookingResponse, dependencies=[Depends(check_rate_limit)])
async def book_slot(request: BookingRequest, db: AsyncSession = Depends(get_db), current_user: str = Depends(verify_token)):
    # Fire the booking engine with the verified identity
    result = await attempt_booking(db, request, current_user)
    
    # Broadcast the immediate result (Success or Waitlisted)
    await broadcast_slot_state(
        str(request.slot_id), 
        result.status, 
        result.message
    )
    return result

@router.delete("/{slot_id}")
async def cancel_slot(slot_id: str, db: AsyncSession = Depends(get_db), current_user: str = Depends(verify_token)):
    # Safely route the cancellation, enforcing IDOR defense (User must own the lock)
    await cancel_booking(db, slot_id, current_user)
    
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
    
    await pubsub.subscribe(channel)
    
    try:
        async for message in pubsub.listen():
            if message["type"] == "message":
                data = message["data"]
                text_data = data.decode("utf-8") if isinstance(data, bytes) else data
                await websocket.send_text(text_data)
    except WebSocketDisconnect:
        await pubsub.unsubscribe(channel)