import time
import logging
from fastapi import Request, HTTPException
from app.core.redis import get_redis

logger = logging.getLogger("rate_limiter")

# --- THE ATOMIC LUA SCRIPT ---
# This executes entirely within Redis. It guarantees that checking the bucket
# and removing a token happens as a single, uninterruptible operation.
TOKEN_BUCKET_SCRIPT = """
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refill_rate = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local requested = 1

local bucket = redis.call("HMGET", key, "tokens", "last_refill")
local tokens = tonumber(bucket[1])
local last_refill = tonumber(bucket[2])

if not tokens or not last_refill then
    tokens = capacity
    last_refill = now
else
    -- Calculate how many tokens to add based on time passed
    local time_passed = math.max(0, now - last_refill)
    local refill_amount = math.floor(time_passed * refill_rate)
    
    if refill_amount > 0 then
        tokens = math.min(capacity, tokens + refill_amount)
        last_refill = now
    end
end

if tokens >= requested then
    tokens = tokens - requested
    redis.call("HMSET", key, "tokens", tokens, "last_refill", last_refill)
    -- Set TTL to prevent memory leaks (capacity / refill_rate = seconds to fill)
    redis.call("EXPIRE", key, math.ceil(capacity / refill_rate))
    return 1 -- Allowed
else
    return 0 -- Rejected
end
"""

async def check_rate_limit(request: Request):
    """
    FastAPI Dependency: Evaluates the request against the Redis Token Bucket.
    Configured for 5 requests per second capacity.
    """
    # 1. Identify the client (In production, use X-Forwarded-For if behind a proxy)
    client_ip = request.client.host if request.client else "unknown"
    key = f"rate_limit:bucket:{client_ip}"
    
    # Bucket Configuration
    capacity = 5        # Max burst size
    refill_rate = 1     # Tokens added per second
    now = int(time.time())

    try:
        redis = await get_redis()
        # Execute the Lua script atomically
        allowed = await redis.eval(
            TOKEN_BUCKET_SCRIPT, 
            1,          # Number of keys
            key,        # KEYS[1]
            capacity,   # ARGV[1]
            refill_rate,# ARGV[2]
            now         # ARGV[3]
        )
        
        if not allowed:
            logger.warning(f"Rate limit exceeded for IP: {client_ip}")
            raise HTTPException(status_code=429, detail="Too Many Requests. Please slow down.")
            
    except HTTPException:
        raise # Re-raise the 429 so FastAPI handles it
    except Exception as e:
        # FAIL-OPEN STRATEGY: If Redis drops, log it but don't block the user
        logger.error(f"Rate Limiter Failure (Failing Open): {str(e)}")