from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.security import verify_admin
from app.db.models import AppointmentType, Provider, ProviderApplication, ApplicationStatus, User, UserRole
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
    _current_user: str = Depends(verify_admin),
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
    _current_user: str = Depends(verify_admin),
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
    _current_user: str = Depends(verify_admin),
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

@router.get("/applications")
async def get_applications(
    db: AsyncSession = Depends(get_db),
    _current_user: str = Depends(verify_admin),
):
    result = await db.execute(select(ProviderApplication, User).join(User, ProviderApplication.user_id == User.id).where(ProviderApplication.status == ApplicationStatus.PENDING))
    
    applications = []
    for app, user in result.all():
        applications.append({
            "id": str(app.id),
            "user_id": str(app.user_id),
            "username": user.username,
            "status": app.status.value,
            "created_at": app.created_at.isoformat() if app.created_at else None
        })
    return applications

@router.post("/applications/{app_id}/approve")
async def approve_application(
    app_id: str,
    db: AsyncSession = Depends(get_db),
    _current_user: str = Depends(verify_admin),
):
    result = await db.execute(select(ProviderApplication).where(ProviderApplication.id == app_id))
    application = result.scalars().first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
        
    if application.status != ApplicationStatus.PENDING:
        raise HTTPException(status_code=400, detail="Application is not in PENDING status")
        
    application.status = ApplicationStatus.APPROVED
    
    user_result = await db.execute(select(User).where(User.id == application.user_id))
    user = user_result.scalars().first()
    if user:
        user.role = UserRole.PROVIDER
        
    new_provider = Provider(
        user_id=application.user_id,
        name=user.username,
        description="Newly approved provider",
        active=True
    )
    db.add(new_provider)
    await db.commit()
    
    return {"status": "Approved", "provider_id": str(new_provider.id)}