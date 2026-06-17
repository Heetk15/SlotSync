from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, Query
from sqlalchemy import text, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.db.models import AppointmentType, Provider, Slot
from app.schemas.booking import BookingRequest, BookingResponse
from app.services.booking import attempt_booking, cancel_booking
from app.services.broadcaster import broadcast_slot_state
from app.core.redis import get_redis
from arq import create_pool
from app.worker.tasks import WorkerSettings
import json

from app.core.rate_limit import check_rate_limit
from app.core.security import get_current_user_id

router = APIRouter(tags=["Bookings"])


@router.get("/my-slots")
async def get_my_slots(
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user_id),
):
    result = await db.execute(
        select(Slot)
        .where(Slot.owner_id == current_user)
        .order_by(Slot.start_time.asc())
    )

    slots = []
    for slot in result.scalars().all():
        slots.append(
            {
                "id": str(slot.id),
                "owner_id": slot.owner_id,
                "start_time": slot.start_time.isoformat() if slot.start_time else None,
                "end_time": slot.end_time.isoformat() if slot.end_time else None,
                "status": slot.status,
                "provider_id": str(slot.provider_id) if slot.provider_id else None,
                "appointment_type_id": str(slot.appointment_type_id) if slot.appointment_type_id else None,
            }
        )

    return slots


@router.get("/appointment-types")
async def get_appointment_types(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(AppointmentType)
        .where(AppointmentType.active.is_(True))
        .order_by(AppointmentType.created_at.desc())
    )

    appointment_types = []
    for appointment_type in result.scalars().all():
        appointment_types.append(
            {
                "id": str(appointment_type.id),
                "name": appointment_type.name,
                "description": appointment_type.description,
                "duration_minutes": appointment_type.duration_minutes,
                "active": appointment_type.active,
            }
        )

    return appointment_types


@router.get("/appointment-types/{type_id}/providers")
async def get_providers_for_appointment_type(type_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Provider)
        .join(Provider.appointment_types)
        .where(AppointmentType.id == type_id)
        .where(Provider.active.is_(True))
        .where(AppointmentType.active.is_(True))
        .order_by(Provider.created_at.desc())
    )

    providers = []
    for provider in result.scalars().unique().all():
        providers.append(
            {
                "id": str(provider.id),
                "user_id": provider.user_id,
                "name": provider.name,
                "description": provider.description,
                "active": provider.active,
            }
        )

    return providers
# --- THE NEW GET ENDPOINT ---
@router.get("/slots")
async def get_all_slots(
    db: AsyncSession = Depends(get_db),
    _current_user: str = Depends(get_current_user_id),
    provider_id: str | None = Query(default=None),
):
    # Uses raw SQL to bypass SQLAlchemy model mismatches during testing
    statement = text("SELECT id, start_time, end_time, status, provider_id, appointment_type_id FROM slots")
    if provider_id:
        statement = text(
            "SELECT id, start_time, end_time, status, provider_id, appointment_type_id "
            "FROM slots WHERE provider_id = :provider_id"
        )
        result = await db.execute(statement, {"provider_id": provider_id})
    else:
        result = await db.execute(statement)
    
    slots = []
    for row in result.all():
        slots.append({
            "id": str(row.id),
            "start_time": row.start_time.isoformat() if row.start_time else None,
            "end_time": row.end_time.isoformat() if row.end_time else None,
            "status": row.status,
            "provider_id": str(row.provider_id) if getattr(row, "provider_id", None) else None,
            "appointment_type_id": str(row.appointment_type_id) if getattr(row, "appointment_type_id", None) else None,
        })
    return slots

# --- EXISTING ROUTES ---
@router.post("/", response_model=BookingResponse, dependencies=[Depends(check_rate_limit)])
async def book_slot(request: BookingRequest, db: AsyncSession = Depends(get_db), current_user: str = Depends(get_current_user_id)):
    result = await attempt_booking(db, request, current_user)
    await broadcast_slot_state(str(request.slot_id), result.status, result.message)
    return result

@router.delete("/{slot_id}")
async def cancel_slot(slot_id: str, db: AsyncSession = Depends(get_db), current_user: str = Depends(get_current_user_id)):
    await cancel_booking(db, slot_id, current_user)
    await broadcast_slot_state(slot_id, "HELD", "Processing slot availability...")
    
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