from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import OperationalError
from fastapi import HTTPException
from datetime import datetime, timedelta, timezone
from app.db.models import Slot, SlotStatus, IdempotencyKey, User
from app.schemas.booking import BookingRequest, BookingResponse
from app.services.waitlist import add_to_waitlist, get_waitlist_length
from app.services.email_service import send_email

async def get_user_email(db: AsyncSession, user_id: str) -> str:
    user = await db.execute(select(User).where(User.id == user_id))
    user_obj = user.scalars().first()
    return user_obj.username if user_obj else user_id

async def attempt_booking(db: AsyncSession, request: BookingRequest, current_user: str) -> BookingResponse:
    # 1. Idempotency Check
    stmt = select(IdempotencyKey).where(IdempotencyKey.key == request.idempotency_key)
    result = await db.execute(stmt)
    existing_key = result.scalars().first()

    if existing_key:
        if existing_key.status == 'COMPLETED':
            return BookingResponse(**existing_key.response_body)
        elif existing_key.status == 'IN_PROGRESS':
            raise HTTPException(status_code=409, detail="Request already processing.")
    
    # 2. Register Idempotency Key
    new_key = IdempotencyKey(
        key=request.idempotency_key,
        status='IN_PROGRESS',
        expires_at=datetime.now(timezone.utc) + timedelta(hours=24)
    )
    db.add(new_key)
    await db.flush() 

    is_waitlisted = False

    try:
        # 3. The Core Concurrency Defense
        slot_stmt = select(Slot).where(Slot.id == request.slot_id).with_for_update(nowait=True)
        slot_result = await db.execute(slot_stmt)
        slot = slot_result.scalars().first()

        if not slot:
            raise HTTPException(status_code=404, detail="Slot not found.")
        
        if slot.status != SlotStatus.AVAILABLE:
            is_waitlisted = True
        else:
            # 4. Mutate State & ASSIGN OWNERSHIP
            slot.status = SlotStatus.BOOKED
            slot.owner_id = current_user # SECURITY: Lock the row to this user
            slot.version += 1 
            
            response_data = BookingResponse(
                slot_id=slot.id,
                status="SUCCESS",
                message="Slot booked successfully.",
                timestamp=datetime.now(timezone.utc)
            )
            
            # Dispatch Email
            user_email = await get_user_email(db, current_user)
            await send_email(
                to_email=user_email,
                subject="Booking Confirmation",
                body=f"Your appointment has been successfully booked for {slot.start_time.strftime('%Y-%m-%d %H:%M')}."
            )

    except OperationalError:
        await db.rollback()
        is_waitlisted = True
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Transaction Failed: {str(e)}")

    # 5. Handle Waitlist Routing
    if is_waitlisted:
        new_key = await db.merge(new_key)
        
        # SECURITY: Inject the user's identity into the waitlist payload so 
        # the background worker knows who to assign the slot to later.
        queue_payload = request.model_dump(mode='json')
        queue_payload['user_id'] = current_user 
        
        await add_to_waitlist(request.slot_id, queue_payload)
        position = await get_waitlist_length(request.slot_id)
        
        response_data = BookingResponse(
            slot_id=request.slot_id,
            status="WAITLISTED",
            message=f"Slot highly contested. Added to waitlist at position {position}.",
            timestamp=datetime.now(timezone.utc)
        )

    # 6. Finalize Idempotency State
    new_key.status = 'COMPLETED'
    new_key.response_code = 200
    new_key.response_body = response_data.model_dump(mode='json')
    
    await db.commit()
    return response_data

async def cancel_booking(db: AsyncSession, slot_id: str, current_user: str):
    """Safely cancels a booking with strict ownership verification."""
    stmt = select(Slot).where(Slot.id == slot_id).with_for_update()
    result = await db.execute(stmt)
    slot = result.scalars().first()

    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found.")
    
    if slot.status != SlotStatus.BOOKED:
        raise HTTPException(status_code=400, detail="Slot is not currently booked.")

    # SECURITY: Prevent unauthorized cancellations (IDOR Defense)
    if slot.owner_id != current_user:
        raise HTTPException(status_code=403, detail="Forbidden: You do not own this booking.")

    # Free the slot
    slot.status = SlotStatus.AVAILABLE
    slot.owner_id = None # Clear ownership
    slot.version += 1 
    
    # Dispatch Email
    user_email = await get_user_email(db, current_user)
    await send_email(
        to_email=user_email,
        subject="Booking Cancellation",
        body=f"Your appointment scheduled for {slot.start_time.strftime('%Y-%m-%d %H:%M')} has been cancelled."
    )
    
    await db.commit()
    return True