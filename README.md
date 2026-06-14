# SlotSync: Distributed High-Concurrency Scheduling Engine

SlotSync is a transactionally safe, high-concurrency backend engine disguised as a booking system. It is engineered to handle massive concurrent traffic spikes and prevent race conditions, utilizing architectural patterns common in financial order-matching engines.

## ⚡ Core Architectural Guarantees

* **Zero Double-Bookings:** Implemented strict **Pessimistic Locking** (`SELECT FOR UPDATE NOWAIT`) in PostgreSQL to enforce row-level locks and guarantee data integrity under heavy concurrent load.
* **Network Fault Tolerance:** Built an **Idempotency Key Ledger** to safely cache transaction states, ensuring network drops or rapid retries never result in duplicate processing.
* **Graceful Degradation via Queues:** Instead of dropping user connections or crashing the database pool during high contention, overflow traffic is instantly routed to an in-memory **Redis FIFO Waitlist**.
* **Asynchronous Self-Healing:** Deployed isolated **ARQ Background Workers** to listen for cancellation events. When a slot frees up, the worker automatically pops the waitlist, inherits the queued user's identity, and safely processes the transaction in the background.
* **Real-Time Order Book:** Replaced standard REST polling with an event-driven **Redis Pub/Sub & WebSocket** architecture, streaming sub-millisecond state mutations directly to a Next.js React frontend.
* **DDoS Perimeter Defense:** Engineered an atomic **Redis Token Bucket Rate Limiter** using Lua scripting to intercept and drop malicious traffic spikes (`429 Too Many Requests`) before they hit the database layer.
* **Stateless Ownership Verification:** Secured mutable state changes (cancellations) using minimal **JWT Authentication**, preventing Insecure Direct Object Reference (IDOR) vulnerabilities.

## 🛠️ Tech Stack

* **Backend:** FastAPI (Python 3), Uvicorn
* **Database:** PostgreSQL 15, SQLAlchemy 2.0 (psycopg3 async C-extensions)
* **Message Broker / Cache:** Redis 7
* **Background Tasks:** ARQ (Async Redis Queues)
* **Frontend Dashboard:** Next.js, React, Tailwind CSS
* **Infrastructure:** Docker Compose

## 🚀 Local Development Setup

**1. Boot the Infrastructure (Database & Redis)**
```bash
docker-compose up -d