import jwt
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from passlib.context import CryptContext
from fastapi import Depends

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# In production, this must be injected via environment variables
SECRET_KEY = "slotsync_architect_secret_key"
ALGORITHM = "HS256"

# FastAPI utility to automatically extract the Bearer token from headers
security = HTTPBearer()

def create_access_token(user_id: str, role: str = "USER") -> str:
    """Generates a signed JWT valid for 1 hour."""
    expire = datetime.now(timezone.utc) + timedelta(hours=1)
    to_encode = {"sub": user_id, "role": role, "exp": expire}
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def verify_token(credentials: HTTPAuthorizationCredentials = Security(security)) -> dict:
    """
    FastAPI Dependency: Decodes the JWT and returns the user_id and role.
    Prevents execution if the token is missing, tampered with, or expired.
    """
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        role = payload.get("role", "USER")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token payload")
        return {"user_id": user_id, "role": role}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token signature")

def get_current_user_id(token_data: dict = Depends(verify_token)) -> str:
    return token_data["user_id"]

def verify_admin(token_data: dict = Depends(verify_token)) -> str:
    if token_data.get("role") != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin privileges required")
    return token_data["user_id"]

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)