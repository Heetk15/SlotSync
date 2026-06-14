import subprocess
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.bookings import router as bookings_router
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
app.include_router(bookings_router, prefix="/bookings")

@app.on_event("startup")
async def startup_event():
    # Initialize Redis connection
    await init_redis()
    
    # Launch ARQ worker as a subprocess (The "Free-Tier DevOps Hack")
    # This runs the worker in parallel within the same Render container
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