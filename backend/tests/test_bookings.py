import pytest
import asyncio
import uuid
from app.core.security import create_access_token

@pytest.mark.asyncio
async def test_idempotency_guarantee(client, test_slot):
    """
    GUARANTEE 1: Network Resilience.
    If a user's network drops and they retry the exact same request, 
    the system must not double-process or crash. It should return the cached success.
    """
    user_token = create_access_token("heet_test_user")
    headers = {"Authorization": f"Bearer {user_token}"}
    payload = {"slot_id": test_slot, "idempotency_key": str(uuid.uuid4())}

    # Strike 1: Initial Booking
    response1 = await client.post("/bookings/", json=payload, headers=headers)
    assert response1.status_code == 200
    assert response1.json()["status"] == "SUCCESS"

    # Strike 2: Network Retry (Same Payload, Same Key)
    response2 = await client.post("/bookings/", json=payload, headers=headers)
    assert response2.status_code == 200
    assert response2.json()["status"] == "SUCCESS" # Cached response!

@pytest.mark.asyncio
async def test_concurrency_and_waitlist_guarantee(client, test_slot):
    """
    GUARANTEE 2: Transactional Safety under Load.
    If 50 users try to book the same slot at the exact same millisecond,
    exactly 1 must succeed, and exactly 49 must be waitlisted.
    """
    async def make_request(req_id):
        user_token = create_access_token(f"concurrent_user_{req_id}")
        payload = {"slot_id": test_slot, "idempotency_key": str(uuid.uuid4())}
        headers = {"Authorization": f"Bearer {user_token}"}
        return await client.post("/bookings/", json=payload, headers=headers)

    # Fire 50 requests concurrently
    tasks = [make_request(i) for i in range(50)]
    responses = await asyncio.gather(*tasks)

    successes = [r.json() for r in responses if r.json().get("status") == "SUCCESS"]
    waitlisted = [r.json() for r in responses if r.json().get("status") == "WAITLISTED"]

    # The absolute proof of our Pessimistic Lock architecture
    assert len(successes) == 1
    assert len(waitlisted) == 49

@pytest.mark.asyncio
async def test_ownership_idor_defense(client, test_slot):
    """
    GUARANTEE 3: Security & Identity.
    User B cannot cancel a slot owned by User A.
    """
    # 1. User A books the slot
    user_a_token = create_access_token("user_A")
    await client.post(
        "/bookings/", 
        json={"slot_id": test_slot, "idempotency_key": str(uuid.uuid4())}, 
        headers={"Authorization": f"Bearer {user_a_token}"}
    )

    # 2. User B tries to cancel it
    user_b_token = create_access_token("user_B")
    cancel_response = await client.delete(
        f"/bookings/{test_slot}",
        headers={"Authorization": f"Bearer {user_b_token}"}
    )

    # 3. The system must violently reject User B
    assert cancel_response.status_code == 403
    assert "Forbidden" in cancel_response.json()["detail"]