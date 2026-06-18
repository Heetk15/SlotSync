from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import insert, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user_id
from app.db.models import Slot, SlotStatus, Provider
from app.db.session import get_db
from app.schemas.booking import SlotGenerateRequest

router = APIRouter(tags=["Providers"])


@router.get("/search")
async def search_providers(
    name: Optional[str] = Query(""),
    db: AsyncSession = Depends(get_db),
    _current_user: str = Depends(get_current_user_id),
):
    query = select(Provider).where(Provider.active == True)
    if name:
        query = query.where(Provider.name.ilike(f"%{name}%"))
        
    result = await db.execute(query)
    providers = result.scalars().all()
    
    return [
        {
            "id": str(p.id),
            "name": p.name,
            "description": p.description
        } for p in providers
    ]

@router.get("/{provider_id}")
async def get_provider(
    provider_id: str,
    db: AsyncSession = Depends(get_db),
    _current_user: str = Depends(get_current_user_id),
):
    result = await db.execute(select(Provider).where(Provider.id == provider_id))
    provider = result.scalars().first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
        
    return {
        "id": str(provider.id),
        "name": provider.name,
        "description": provider.description
    }

@router.post("/slots/generate")
async def generate_slots(
    payload: SlotGenerateRequest,
    db: AsyncSession = Depends(get_db),
    _current_user: str = Depends(get_current_user_id),
):
    provider_result = await db.execute(select(Provider).where(Provider.id == payload.provider_id))
    provider = provider_result.scalars().first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found.")

    slot_date = payload.date
    current_start = datetime.combine(slot_date, payload.start_time).replace(tzinfo=timezone.utc)
    window_end = datetime.combine(slot_date, payload.end_time).replace(tzinfo=timezone.utc)
    duration = timedelta(minutes=payload.duration_minutes)

    if payload.duration_minutes <= 0:
        raise HTTPException(status_code=400, detail="duration_minutes must be greater than zero.")

    slot_rows = []
    while current_start + duration <= window_end:
        slot_rows.append(
            {
                "start_time": current_start,
                "end_time": current_start + duration,
                "status": SlotStatus.AVAILABLE,
                "provider_id": payload.provider_id,
                "appointment_type_id": None,
            }
        )
        current_start += duration

    if not slot_rows:
        raise HTTPException(status_code=400, detail="Time window is too small for the requested duration.")

    await db.execute(insert(Slot), slot_rows)
    await db.commit()

    return {
        "status": "generated",
        "provider_id": str(payload.provider_id),
        "created_count": len(slot_rows),
        "date": payload.date.isoformat(),
    }