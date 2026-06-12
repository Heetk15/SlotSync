from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.schemas.booking import BookingRequest, BookingResponse
from app.services.booking import attempt_booking, cancel_booking
from arq import create_pool
from app.worker.tasks import WorkerSettings

router = APIRouter(prefix="/bookings", tags=["Bookings"])

@router.post("/", response_model=BookingResponse)
async def book_slot(request: BookingRequest, db: AsyncSession = Depends(get_db)):
    return await attempt_booking(db, request)

@router.delete("/{slot_id}")
async def cancel_slot(slot_id: str, db: AsyncSession = Depends(get_db)):
    # 1. Free the slot in the database
    await cancel_booking(db, slot_id)
    
    # 2. Trigger the background worker to pop the waitlist
    arq_redis = await create_pool(WorkerSettings.redis_settings)
    await arq_redis.enqueue_job('promote_user_from_waitlist', slot_id)
    
    return {"status": "CANCELED", "message": "Slot freed. Worker triggered for waitlist promotion."}