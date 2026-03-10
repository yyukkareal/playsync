# app/api/dependencies.py
"""
JWT helpers and FastAPI dependency for PlaySync.

Usage in routes:
    from app.api.dependencies import get_current_user

    @router.get("/api/users/{user_id}/courses")
    def get_courses(user_id: int, current_user: int = Depends(get_current_user)):
        if current_user != user_id:
            raise HTTPException(status_code=403, detail="Forbidden")
        ...
"""
import os
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

JWT_SECRET: str = os.environ["JWT_SECRET"]
JWT_ALGORITHM: str = "HS256"
JWT_EXPIRE_HOURS: int = 72  # 3 days — reasonable for an MVP session

_bearer_scheme = HTTPBearer()

# ---------------------------------------------------------------------------
# Token creation
# ---------------------------------------------------------------------------

def create_access_token(user_id: int) -> str:
    """Sign and return a JWT containing only user_id."""
    now = datetime.now(tz=timezone.utc)
    payload = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + timedelta(hours=JWT_EXPIRE_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def create_access_token_with_claims(user_id: int, extra: dict) -> str:
    """
    Sign and return a JWT with additional claims (e.g. email, name).

    Args:
        user_id: The app.users.id — stored in 'sub'.
        extra:   Dict of extra claims merged into the payload.

    Returns:
        A signed JWT string ready to be returned to the client.
    """
    now = datetime.now(tz=timezone.utc)
    payload = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + timedelta(hours=JWT_EXPIRE_HOURS),
        **extra,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


# ---------------------------------------------------------------------------
# FastAPI dependency
# ---------------------------------------------------------------------------

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme),
) -> int:
    """
    FastAPI dependency — extract and verify a Bearer JWT.

    Raises HTTP 401 if the token is missing, expired, or tampered with.

    Returns:
        The user_id (int) embedded in the token's 'sub' claim.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token. Please log in again.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(
            credentials.credentials,
            JWT_SECRET,
            algorithms=[JWT_ALGORITHM],
        )
        user_id_str: str | None = payload.get("sub")
        if user_id_str is None:
            raise credentials_exception
        return int(user_id_str)
    except (jwt.ExpiredSignatureError, jwt.DecodeError, ValueError):
        raise credentials_exception