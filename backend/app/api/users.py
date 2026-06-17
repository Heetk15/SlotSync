from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db
from app.db.models import ProviderApplication, ApplicationStatus, User, Provider, UserRole
from app.core.security import get_current_user_id

router = APIRouter(tags=["Users"])

@router.get("/me")
async def get_current_user_info(
    db: AsyncSession = Depends(get_db),
    current_user_id: str = Depends(get_current_user_id)
):
    result = await db.execute(select(User).where(User.id == current_user_id))
    user = result.scalars().first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    response_data = {
        "id": str(user.id),
        "username": user.username,
        "role": user.role.value,
        "provider_id": None
    }
    
    if user.role == UserRole.PROVIDER:
        provider_result = await db.execute(select(Provider).where(Provider.user_id == current_user_id))
        provider = provider_result.scalars().first()
        if provider:
            response_data["provider_id"] = str(provider.id)
            
    return response_data

@router.post("/apply-provider")
async def apply_provider(
    db: AsyncSession = Depends(get_db),
    current_user_id: str = Depends(get_current_user_id)
):
    # Check if application already exists
    result = await db.execute(select(ProviderApplication).where(ProviderApplication.user_id == current_user_id))
    existing_application = result.scalars().first()
    
    if existing_application:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Application already exists with status: {existing_application.status.value}")

    new_application = ProviderApplication(
        user_id=current_user_id,
        status=ApplicationStatus.PENDING
    )
    db.add(new_application)
    await db.commit()
    await db.refresh(new_application)
    
    return {"status": "Application submitted", "application_id": str(new_application.id)}
