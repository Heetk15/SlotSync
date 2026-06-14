from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from app.api.bookings import router as bookings_router
from app.core.redis import init_redis, close_redis
from app.core.security import create_access_token

app = FastAPI(title="SlotSync API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    await init_redis()

@app.on_event("shutdown")
async def shutdown_event():
    await close_redis()

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