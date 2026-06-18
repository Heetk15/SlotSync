# SlotSync 📅

SlotSync is a modern, high-performance appointment scheduling and booking platform. It provides a seamless experience for both service providers to manage their availability and users to find and book appointments with ease. 

With a focus on exceptional user experience, SlotSync includes intelligent timezone handling, real-time search, waitlisting capabilities, and a responsive, highly accessible interface.

---

## ✨ Features

* **Provider Management:** Providers can dynamically generate time slots with full timezone awareness.
* **Smart Booking System:** Users can search for providers in real-time with an optimized, debounced search interface.
* **Waitlists:** Integrated waitlisting allows users to queue for booked slots and automatically get promoted if a spot opens up.
* **Idempotent Operations:** Robust backend validation ensures secure, duplicate-free bookings using idempotency keys.
* **Modern UI/UX:** Built with Next.js and Tailwind CSS, featuring high-contrast interactive elements and a professional design system.
* **Async Backend:** Powered by FastAPI and SQLAlchemy for non-blocking, high-concurrency request handling.

---

## 🛠️ Tech Stack

**Frontend:**
* [Next.js](https://nextjs.org/) (React Framework)
* [Tailwind CSS](https://tailwindcss.com/) for styling
* Client-side fetching and state management

**Backend:**
* [FastAPI](https://fastapi.tiangolo.com/) (Python Web Framework)
* [SQLAlchemy](https://www.sqlalchemy.org/) (AsyncSession for database operations)
* [Pydantic](https://docs.pydantic.dev/) for strict schema validation
* PostgreSQL (Database)

---

## 🚀 Getting Started

### Prerequisites
* Node.js (v18+)
* Python (3.10+)
* PostgreSQL

### 1. Backend Setup
Navigate to the `backend` directory and set up your Python environment:

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Set up your `.env` variables and start the FastAPI server:
```bash
uvicorn app.main:app --reload
```

### 2. Frontend Setup
Navigate to the `frontend` directory and install dependencies:

```bash
cd frontend
npm install
```

Set up your `.env.local` file with your API URL:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Start the Next.js development server:
```bash
npm run dev
```

---

## 📂 Project Structure

* `/frontend` - Next.js application containing pages, contexts, and UI components.
  * `/src/app/book` - Dynamic routing for the booking interface.
  * `/src/app/provider` - Provider workspace for slot generation.
  * `/src/app/dashboard` - User dashboard for managing appointments.
* `/backend` - FastAPI application.
  * `/app/api` - RESTful route handlers (providers, bookings, auth, waitlist).
  * `/app/schemas` - Pydantic models for request/response validation.
  * `/app/db` - SQLAlchemy models and database session management.
* `/infra` - Infrastructure and database initialization scripts.

---

## 🤝 Contributing
Contributions, issues, and feature requests are welcome! Feel free to check the issues page.