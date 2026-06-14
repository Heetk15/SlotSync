import jwt
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

# In production, this must be injected via environment variables
SECRET_KEY = "slotsync_architect_secret_key"
ALGORITHM = "HS256"

# FastAPI utility to automatically extract the Bearer token from headers
security = HTTPBearer()

def create_access_token(user_id: str) -> str:
    """Generates a signed JWT valid for 1 hour."""
    expire = datetime.now(timezone.utc) + timedelta(hours=1)
    to_encode = {"sub": user_id, "exp": expire}
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def verify_token(credentials: HTTPAuthorizationCredentials = Security(security)) -> str:
    """
    FastAPI Dependency: Decodes the JWT and returns the user_id.
    Prevents execution if the token is missing, tampered with, or expired.
    """
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token payload")
        return user_id
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token signature")