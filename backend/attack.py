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
            start_time=datetime.now(timezone.utc),
            end_time=datetime.now(timezone.utc) + timedelta(hours=1),
            status=SlotStatus.AVAILABLE
        )
        db.add(new_slot)
        await db.commit()
        await db.refresh(new_slot)
        return str(new_slot.id)

async def attack(slot_id):
    """Simulates 50 unique authenticated users trying to book simultaneously."""
    url = "http://127.0.0.1:8000/bookings/"
    auth_url = "http://127.0.0.1:8000/auth/token"
    
    async def make_request(client, req_id):
        user_id = f"attack_user_{req_id}"
        
        # 1. Fetch JWT Token for this specific simulated user
        auth_response = await client.post(auth_url, json={"user_id": user_id})
        if auth_response.status_code != 200:
            return {"status": "AUTH_ERROR"}
        token = auth_response.json()["access_token"]
        
        # 2. Attempt Booking with the JWT attached
        payload = {
            "slot_id": slot_id,
            "idempotency_key": str(uuid.uuid4())
        }
        headers = {
            "Authorization": f"Bearer {token}"
        }
        response = await client.post(url, json=payload, headers=headers)
        
        if response.status_code == 200:
            return response.json()
        elif response.status_code == 429:
            return {"status": "RATE_LIMITED"}
        elif response.status_code == 403:
            return {"status": "FORBIDDEN"}
        else:
            return {"status": "ERROR"}

    async with httpx.AsyncClient() as client:
        tasks = [make_request(client, i) for i in range(50)]
        results = await asyncio.gather(*tasks)
        
        successes = len([r for r in results if r.get("status") == "SUCCESS"])
        waitlisted = len([r for r in results if r.get("status") == "WAITLISTED"])
        rate_limited = len([r for r in results if r.get("status") == "RATE_LIMITED"])
        forbidden = len([r for r in results if r.get("status") == "FORBIDDEN"])
        errors = len([r for r in results if r.get("status") in ("ERROR", "AUTH_ERROR")])
        
        print("\n--- ATTACK RESULTS ---")
        print(f"Total Requests Fired: {len(results)}")
        print(f"Direct Successes: {successes}")
        print(f"Users Waitlisted: {waitlisted}")
        print(f"Rate Limited (429): {rate_limited}")
        print(f"Forbidden (403): {forbidden}")
        print(f"Dropped/Errors: {errors}")
        print("----------------------\n")

async def main():
    print("Seeding database with 1 available slot...")
    slot_id = await setup_slot()
    print(f"Target Slot Created: {slot_id}")
    print("Initiating Authenticated Concurrency Attack (50 simultaneous requests)...")
    await attack(slot_id)

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())