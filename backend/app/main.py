import subprocess
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.api.bookings import router as bookings_router
from app.api.admin import router as admin_router
from app.api.providers import router as providers_router
from app.api.auth import router as auth_router
from app.api.users import router as users_router
from app.core.redis import init_redis, close_redis

# Configure logging to see worker output in Render logs
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="SlotSync API", version="1.0.0")

# 1. CORS Configuration: Whitelist your Vercel deployment
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://slot-sync-ten.vercel.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. Include Routers
app.include_router(auth_router, prefix="/auth")
app.include_router(users_router, prefix="/users")
app.include_router(bookings_router, prefix="/bookings")
app.include_router(admin_router, prefix="/admin")
app.include_router(providers_router, prefix="/providers")

@app.on_event("startup")
async def startup_event():
    # Initialize Redis connection
    await init_redis()
    
    # Launch ARQ worker as a subprocess (The "Free-Tier DevOps Hack")
    try:
        subprocess.Popen(["arq", "app.worker.tasks.WorkerSettings"])
        logger.info("ARQ Worker process started successfully.")
    except Exception as e:
        logger.error(f"Failed to start ARQ worker: {e}")

@app.on_event("shutdown")
async def shutdown_event():
    await close_redis()

@app.get("/")
async def root():
    return {"message": "SlotSync API is operational"}