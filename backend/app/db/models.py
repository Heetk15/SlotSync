from sqlalchemy import Column, String, DateTime, Integer, JSON, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import declarative_base
from datetime import datetime, timezone
import uuid
import enum

Base = declarative_base()

class SlotStatus(str, enum.Enum):
    AVAILABLE = 'AVAILABLE'
    HELD = 'HELD'
    BOOKED = 'BOOKED'

class Slot(Base):
    __tablename__ = 'slots'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # NEW: The string identifier of the user who holds the booking
    owner_id = Column(String(255), nullable=True) 
    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=False)
    status = Column(SQLEnum(SlotStatus), nullable=False, default=SlotStatus.AVAILABLE)
    version = Column(Integer, nullable=False, default=1)

class IdempotencyKey(Base):
    __tablename__ = 'idempotency_keys'
    key = Column(String(255), primary_key=True)
    # FIXED: Replaced naive datetime.utcnow with timezone-aware lambda
    locked_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    response_code = Column(Integer, nullable=True)
    response_body = Column(JSON, nullable=True)
    status = Column(String(50), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)