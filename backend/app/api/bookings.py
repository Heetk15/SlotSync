from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text 
from app.db.session import get_db
from app.schemas.booking import BookingRequest, BookingResponse
from app.services.booking import attempt_booking, cancel_booking
from app.services.broadcaster import broadcast_slot_state
from app.core.redis import get_redis
from arq import create_pool
from app.worker.tasks import WorkerSettings
import json

from app.core.rate_limit import check_rate_limit
from app.core.security import verify_token

router = APIRouter(prefix="/bookings", tags=["Bookings"])

# --- THE NEW GET ENDPOINT ---
@router.get("/slots")
async def get_all_slots(db: AsyncSession = Depends(get_db)):
    # Uses raw SQL to bypass SQLAlchemy model mismatches during testing
    result = await db.execute(text("SELECT id, start_time, end_time, status FROM slots"))
    
    slots = []
    for row in result.all():
        slots.append({
            "id": str(row.id),
            "start_time": row.start_time.isoformat() if row.start_time else None,
            "end_time": row.end_time.isoformat() if row.end_time else None,
            "status": row.status
        })
    return slots

# --- EXISTING ROUTES ---
@router.post("/", response_model=BookingResponse, dependencies=[Depends(check_rate_limit)])
async def book_slot(request: BookingRequest, db: AsyncSession = Depends(get_db), current_user: str = Depends(verify_token)):
    result = await attempt_booking(db, request, current_user)
    await broadcast_slot_state(str(request.slot_id), result.status, result.message)
    return result

@router.delete("/{slot_id}")
async def cancel_slot(slot_id: str, db: AsyncSession = Depends(get_db), current_user: str = Depends(verify_token)):
    await cancel_booking(db, slot_id, current_user)
    await broadcast_slot_state(slot_id, "AVAILABLE", "Slot has been freed.")
    
    arq_redis = await create_pool(WorkerSettings.redis_settings)
    await arq_redis.enqueue_job('promote_user_from_waitlist', slot_id)
    return {"status": "CANCELED", "message": "Worker triggered for waitlist promotion."}

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