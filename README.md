# SlotSync

A distributed scheduling platform designed to handle high-concurrency booking scenarios while maintaining transactional integrity.

Built using FastAPI, PostgreSQL, Redis, ARQ, and Next.js.

## The Problem

In traditional booking systems, multiple users attempting to reserve the same slot simultaneously can lead to:

* Double bookings
* Duplicate requests
* Inconsistent state
* Poor user experience during traffic spikes

SlotSync was built to address these challenges through database-level concurrency control and distributed system patterns.

---

## Key Features

* Secure appointment booking and cancellation
* Provider-based scheduling and slot generation
* Real-time slot availability using WebSockets
* Automatic Redis-backed waitlists
* JWT-based authentication and ownership validation
* Idempotent booking operations
* Redis Lua token-bucket rate limiting
* Background waitlist promotion using ARQ workers

---

## Architecture Highlights

### Transactional Safety

Uses PostgreSQL row-level locking (`FOR UPDATE NOWAIT`) to guarantee that a slot can only be booked by a single user.

### Idempotency

Prevents duplicate bookings caused by retries, double-clicks, or network interruptions.

### Automatic Waitlisting

Failed booking attempts are automatically routed into a Redis FIFO queue and promoted when a slot becomes available.

### Real-Time Updates

Booking state changes are propagated through Redis Pub/Sub and delivered to connected clients via WebSockets.

---

## Tech Stack

**Frontend**

* Next.js
* React
* Tailwind CSS

**Backend**

* FastAPI
* SQLAlchemy
* Pydantic

**Data & Infrastructure**

* PostgreSQL
* Redis
* ARQ
* Docker
* Render
* Vercel
* Neon
* Upstash

---

## Concepts Demonstrated

* ACID Transactions
* Pessimistic Locking
* Idempotency
* Distributed Queueing
* Dead Letter Queues
* Pub/Sub Messaging
* Rate Limiting
* JWT Authentication
* Event-Driven Architecture

---

## Author

**Heet Kothari**
