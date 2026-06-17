from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db
from app.db.models import ProviderApplication, ApplicationStatus
from app.core.security import get_current_user_id

router = APIRouter(tags=["Users"])

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
