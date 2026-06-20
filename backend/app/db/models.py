from sqlalchemy import Column, String, DateTime, Integer, JSON, Enum as SQLEnum, Text, Boolean, ForeignKey, Table
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import declarative_base, relationship
from datetime import datetime, timezone
import uuid
import enum

Base = declarative_base()

provider_appointment_types = Table(
    'provider_appointment_types',
    Base.metadata,
    Column('provider_id', UUID(as_uuid=True), ForeignKey('providers.id'), primary_key=True),
    Column('appointment_type_id', UUID(as_uuid=True), ForeignKey('appointment_types.id'), primary_key=True),
)

class SlotStatus(str, enum.Enum):
    AVAILABLE = 'AVAILABLE'
    HELD = 'HELD'
    BOOKED = 'BOOKED'

class UserRole(str, enum.Enum):
    USER = 'USER'
    PROVIDER = 'PROVIDER'
    ADMIN = 'ADMIN'

class ApplicationStatus(str, enum.Enum):
    PENDING = 'PENDING'
    APPROVED = 'APPROVED'
    REJECTED = 'REJECTED'

class User(Base):
    __tablename__ = 'users'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username = Column(String(255), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(SQLEnum(UserRole), nullable=False, default=UserRole.USER)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

class ProviderApplication(Base):
    __tablename__ = 'provider_applications'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False)
    status = Column(SQLEnum(ApplicationStatus), nullable=False, default=ApplicationStatus.PENDING)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))


class AppointmentType(Base):
    __tablename__ = 'appointment_types'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    duration_minutes = Column(Integer, nullable=False)
    active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

    providers = relationship(
        'Provider',
        secondary=provider_appointment_types,
        back_populates='appointment_types',
    )
    slots = relationship('Slot', back_populates='appointment_type')


class Provider(Base):
    __tablename__ = 'providers'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

    appointment_types = relationship(
        'AppointmentType',
        secondary=provider_appointment_types,
        back_populates='providers',
    )
    slots = relationship('Slot', back_populates='provider')

class Slot(Base):
    __tablename__ = 'slots'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # NEW: The string identifier of the user who holds the booking
    owner_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='SET NULL'), nullable=True) 
    provider_id = Column(UUID(as_uuid=True), ForeignKey('providers.id'), nullable=True, index=True)
    appointment_type_id = Column(UUID(as_uuid=True), ForeignKey('appointment_types.id'), nullable=True)
    start_time = Column(DateTime(timezone=True), nullable=False, index=True)
    end_time = Column(DateTime(timezone=True), nullable=False)
    status = Column(SQLEnum(SlotStatus), nullable=False, default=SlotStatus.AVAILABLE, index=True)
    version = Column(Integer, nullable=False, default=1)

    provider = relationship('Provider', back_populates='slots')
    appointment_type = relationship('AppointmentType', back_populates='slots')

class IdempotencyKey(Base):
    __tablename__ = 'idempotency_keys'
    key = Column(String(255), primary_key=True)
    # FIXED: Replaced naive datetime.utcnow with timezone-aware lambda
    locked_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    response_code = Column(Integer, nullable=True)
    response_body = Column(JSON, nullable=True)
    status = Column(String(50), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)