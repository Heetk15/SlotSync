from fastapi import FastAPI
from app.api.bookings import router as bookings_router
from app.core.redis import init_redis, close_redis

app = FastAPI(title="SlotSync API", version="1.0.0")

@app.on_event("startup")
async def startup_event():
    await init_redis()

@app.on_event("shutdown")
async def shutdown_event():
    await close_redis()

app.include_router(bookings_router)

@app.get("/health")
async def health_check():
    return {"status": "operational"}