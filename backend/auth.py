import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from database import get_db
import models

VALID_ROLES = {"owner", "store_keeper", "floor_supervisor", "dispatch", "buyer"}
ROLE_ALIASES = {"operator": "floor_supervisor"}

SECRET_KEY = os.getenv("JWT_SECRET_KEY")
if not SECRET_KEY:
    if os.getenv("APP_ENV", "development").lower() != "development":
        raise RuntimeError("JWT_SECRET_KEY must be configured outside development")
    SECRET_KEY = secrets.token_urlsafe(48)
if os.getenv("APP_ENV", "development").lower() != "development" and len(SECRET_KEY) < 32:
    raise RuntimeError("JWT_SECRET_KEY must contain at least 32 characters outside development")
ALGORITHM = "HS256"
security = HTTPBearer(auto_error=False)


def normalize_role(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    normalized = str(value).strip().lower()
    if not normalized:
        return None
    return ROLE_ALIASES.get(normalized, normalized)


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    derived = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 120000)
    return f"{salt}:{derived.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        salt, digest = stored_hash.split(":", 1)
        derived = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 120000)
        return hmac.compare_digest(derived.hex(), digest)
    except Exception:
        return False


def create_access_token(user: models.User) -> str:
    role = normalize_role(user.role) or user.role
    payload = {
        "sub": str(user.id),
        "email": user.email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
) -> models.User:
    if credentials is None or not credentials.credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")

    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token missing user identity")

    user = db.query(models.User).filter(models.User.id == int(user_id)).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User account no longer exists")

    return user


def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
) -> Optional[models.User]:
    if credentials is None or not credentials.credentials:
        return None

    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.PyJWTError:
        return None

    user_id = payload.get("sub")
    if user_id is None:
        return None

    return db.query(models.User).filter(models.User.id == int(user_id)).first()


def require_roles(*allowed_roles: str):
    allowed_set = {normalize_role(role) for role in allowed_roles if role}

    def dependency(current_user: models.User = Depends(get_current_user)) -> models.User:
        current_role = normalize_role(current_user.role)
        if current_role not in allowed_set:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"This action is restricted to: {', '.join(sorted(allowed_set))}",
            )
        return current_user

    return dependency
