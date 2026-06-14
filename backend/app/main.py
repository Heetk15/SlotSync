import subprocess
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from app.api.bookings import router as bookings_router
from app.core.redis import init_redis, close_redis
from app.core.security import create_access_token

app = FastAPI(title="SlotSync API", version="1.0.0")

# Be sure to keep your Vercel URL here!
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://slot-sync-ten.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    await init_redis()
    # DEV-OPS HACK: Launch the ARQ worker as a parallel background process 
    # inside this same free container so we don't have to pay for a worker instance.
    subprocess.Popen(["arq", "app.worker.tasks.WorkerSettings"])

@app.on_event("shutdown")
async def shutdown_event():
    await close_redis()

# ... (keep the rest of your routes below) ...

# --- MINIMAL JWT AUTHENTICATION ENDPOINT ---
class LoginRequest(BaseModel):
    user_id: str

@app.post("/auth/token")
async def login(request: LoginRequest):
    """Exchanges a user identifier for a short-lived cryptographic JWT."""
    token = create_access_token(request.user_id)
    return {"access_token": token, "token_type": "bearer"}

app.include_router(bookings_router)

@app.get("/health")
async def health_check():
    return {"status": "operational"}