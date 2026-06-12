import asyncio
import httpx
from app.db.session import AsyncSessionLocal
from app.db.models import Slot, SlotStatus
from datetime import datetime, timedelta, timezone
import uuid
import sys

async def setup_slot():
    """Seeds the database with a single highly-contested slot."""
    async with AsyncSessionLocal() as db:
        new_slot = Slot(
            # Using strict timezone-aware objects to prevent psycopg3 crashes
            start_time=datetime.now(timezone.utc),
            end_time=datetime.now(timezone.utc) + timedelta(hours=1),
            status=SlotStatus.AVAILABLE
        )
        db.add(new_slot)
        await db.commit()
        await db.refresh(new_slot)
        return str(new_slot.id)

async def attack(slot_id):
    """Simulates 50 unique users trying to book the exact same slot simultaneously."""
    url = "http://127.0.0.1:8000/bookings/"
    
    async def make_request(client, req_id):
        payload = {
            "slot_id": slot_id,
            "idempotency_key": str(uuid.uuid4())
        }
        response = await client.post(url, json=payload)
        
        # In Phase 4, the API returns 200 OK for both direct successes and waitlisted users
        if response.status_code == 200:
            return response.json()
        else:
            return {"status": "ERROR"}

    async with httpx.AsyncClient() as client:
        # Launch 50 requests at the exact same time
        tasks = [make_request(client, i) for i in range(50)]
        results = await asyncio.gather(*tasks)
        
        # Tally the results based on our new API response structure
        successes = len([r for r in results if r.get("status") == "SUCCESS"])
        waitlisted = len([r for r in results if r.get("status") == "WAITLISTED"])
        errors = len([r for r in results if r.get("status") == "ERROR"])
        
        print("\n--- ATTACK RESULTS ---")
        print(f"Total Requests Fired: {len(results)}")
        print(f"Direct Successes: {successes}")
        print(f"Users Waitlisted: {waitlisted}")
        print(f"Dropped/Errors: {errors}")
        print("----------------------\n")

async def main():
    print("Seeding database with 1 available slot...")
    slot_id = await setup_slot()
    print(f"Target Slot Created: {slot_id}")
    print("Initiating Concurrency Attack (50 simultaneous requests)...")
    await attack(slot_id)

if __name__ == "__main__":
    # Force Windows to use the compatible SelectorEventLoop for psycopg3 async C-extensions
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    
    asyncio.run(main())