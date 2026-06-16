from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.security import verify_token
from app.db.models import AppointmentType, Provider
from app.db.session import get_db
from app.schemas.booking import (
    AppointmentTypeCreate,
    AppointmentTypeResponse,
    AssignAppointmentTypeRequest,
    ProviderCreate,
    ProviderResponse,
)

router = APIRouter(tags=["Admin"])


@router.post("/appointment-types", response_model=AppointmentTypeResponse)
async def create_appointment_type(
    payload: AppointmentTypeCreate,
    db: AsyncSession = Depends(get_db),
    _current_user: str = Depends(verify_token),
):
    appointment_type = AppointmentType(**payload.model_dump())
    db.add(appointment_type)
    await db.commit()
    await db.refresh(appointment_type)
    return appointment_type


@router.post("/providers", response_model=ProviderResponse)
async def create_provider(
    payload: ProviderCreate,
    db: AsyncSession = Depends(get_db),
    _current_user: str = Depends(verify_token),
):
    provider = Provider(**payload.model_dump())
    db.add(provider)
    await db.commit()
    await db.refresh(provider)
    return provider


@router.post("/providers/{provider_id}/types")
async def attach_type_to_provider(
    provider_id: str,
    payload: AssignAppointmentTypeRequest,
    db: AsyncSession = Depends(get_db),
    _current_user: str = Depends(verify_token),
):
    provider_result = await db.execute(select(Provider).where(Provider.id == provider_id))
    provider = provider_result.scalars().first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found.")

    appointment_type_result = await db.execute(
        select(AppointmentType).where(AppointmentType.id == payload.appointment_type_id)
    )
    appointment_type = appointment_type_result.scalars().first()
    if not appointment_type:
        raise HTTPException(status_code=404, detail="Appointment type not found.")

    if appointment_type not in provider.appointment_types:
        provider.appointment_types.append(appointment_type)

    await db.commit()
    return {"status": "linked", "provider_id": str(provider.id), "appointment_type_id": str(appointment_type.id)}