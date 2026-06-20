from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.db.models import Slot, SlotStatus
from app.services.waitlist import add_to_waitlist, get_waitlist_length
from app.core.security import get_current_user_id
from pydantic import BaseModel
import uuid

router = APIRouter(tags=["Waitlist"])

class JoinWaitlistRequest(BaseModel):
    slot_id: str

@router.post("/join")
async def join_waitlist(
    request: JoinWaitlistRequest,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user_id)
):
    # 1. Verify slot exists
    stmt = select(Slot).where(Slot.id == request.slot_id)
    result = await db.execute(stmt)
    slot = result.scalars().first()

    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found.")
        
    if slot.status == SlotStatus.AVAILABLE:
        raise HTTPException(status_code=400, detail="Slot is available. Please book it directly.")
        
    # 2. Add to Waitlist
    queue_payload = {
        "user_id": current_user,
        "slot_id": request.slot_id,
        "idempotency_key": f"waitlist_join_{current_user}_{request.slot_id}_{uuid.uuid4().hex[:8]}"
    }
    
    try:
        await add_to_waitlist(request.slot_id, queue_payload)
        position = await get_waitlist_length(request.slot_id)
    except Exception:
        raise HTTPException(status_code=503, detail="Waitlist service temporarily unavailable. Please try again later.")
    
    return {
        "status": "WAITLISTED",
        "message": f"Successfully joined the waitlist. You are in position {position}.",
        "position": position
    }
