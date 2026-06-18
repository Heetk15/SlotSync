import os
import sys
import asyncio
from datetime import datetime, timedelta, timezone
import random
import uuid

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text
from passlib.context import CryptContext
from faker import Faker

# Add backend directory to sys.path
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from app.db.models import User, Provider, AppointmentType, Slot, UserRole, SlotStatus, provider_appointment_types, Base

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("Error: DATABASE_URL environment variable is not set.")
    sys.exit(1)

# Ensure postgresql+asyncpg scheme
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
fake = Faker()

async def clear_database(session: AsyncSession):
    print("Clearing existing data...")
    # Safely wipes old data without destroying your tables or ENUMs
    await session.execute(text("TRUNCATE TABLE slots, provider_appointment_types, appointment_types, providers, provider_applications, users CASCADE"))
    await session.commit()
    print("Database cleared.")

async def seed_db():
    async with AsyncSessionLocal() as session:
        # We re-enabled this so you don't get duplicate 'admin' errors!
        await clear_database(session)

        print("Seeding database...")
        password_hash = pwd_context.hash("password123")

        # Create admin user
        admin = User(
            id=uuid.uuid4(),
            username="admin",
            password_hash=password_hash,
            role=UserRole.ADMIN
        )
        session.add(admin)

        # 1. Generate 10 standard users
        print("Generating 10 standard users...")
        for _ in range(10):
            user = User(
                id=uuid.uuid4(),
                username=fake.unique.user_name(),
                password_hash=password_hash,
                role=UserRole.USER
            )
            session.add(user)

        await session.commit()

        # 2. Generate 5 approved providers
        print("Generating 5 providers and appointment types...")
        providers = []
        for _ in range(5):
            provider_user = User(
                id=uuid.uuid4(),
                username=fake.unique.user_name(),
                password_hash=password_hash,
                role=UserRole.PROVIDER
            )
            session.add(provider_user)
            
            # ---> FIX: Force DB to save the user so the ID exists <---
            await session.flush() 
            
            provider = Provider(
                id=uuid.uuid4(),
                user_id=provider_user.id,
                name=fake.company(),
                description=fake.catch_phrase(),
                active=True
            )
            session.add(provider)
            providers.append(provider)

        await session.commit()

        # Generate 5 appointment types
        appointment_types = []
        for _ in range(5):
            appt_type = AppointmentType(
                id=uuid.uuid4(),
                name=fake.job(),
                description=fake.sentence(),
                duration_minutes=random.choice([15, 30, 45, 60]),
                active=True
            )
            session.add(appt_type)
            appointment_types.append(appt_type)
            
        await session.commit()

        # Link providers to appointment types randomly
        print("Linking providers to appointment types...")
        for provider in providers:
            num_types = random.randint(1, 3)
            selected_types = random.sample(appointment_types, num_types)
            for appt_type in selected_types:
                await session.execute(
                    provider_appointment_types.insert().values(
                        provider_id=provider.id,
                        appointment_type_id=appt_type.id
                    )
                )

        await session.commit()

        # 3. Generate 20 random available slots spread across the upcoming week
        print("Generating 20 random slots...")
        now = datetime.now(timezone.utc)
        for _ in range(20):
            provider = random.choice(providers)
            days_ahead = random.randint(1, 7)
            start_hour = random.randint(9, 16)
            slot_start = now.replace(hour=start_hour, minute=0, second=0, microsecond=0) + timedelta(days=days_ahead)
            slot_end = slot_start + timedelta(minutes=30)

            slot = Slot(
                id=uuid.uuid4(),
                provider_id=provider.id,
                appointment_type_id=None,
                start_time=slot_start,
                end_time=slot_end,
                status=SlotStatus.AVAILABLE,
                version=1
            )
            session.add(slot)

        await session.commit()
        print("Seeding completed successfully! All passwords are 'password123'.")

if __name__ == "__main__":
    asyncio.run(seed_db())