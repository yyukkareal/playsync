# app/api/auth.py
"""
Google OAuth2 authentication router for PlaySync.

Flow:
  1. GET /auth/google/login        → redirect user to Google consent screen
  2. GET /auth/google/callback     → exchange code for tokens, upsert user, return user_id
"""
import logging
import os

import jwt
import requests
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import RedirectResponse

from app.db.repository import upsert_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])

# ---------------------------------------------------------------------------
# OAuth config — all values must be set in environment
# ---------------------------------------------------------------------------
CLIENT_ID     = os.environ["GOOGLE_CLIENT_ID"]
CLIENT_SECRET = os.environ["GOOGLE_CLIENT_SECRET"]
REDIRECT_URI  = os.environ["GOOGLE_REDIRECT_URI"]

SCOPES = " ".join([
    "openid",
    "email",
    "https://www.googleapis.com/auth/calendar",
])

GOOGLE_AUTH_URL  = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get(
    "/google/login",
    summary="Initiate Google OAuth login",
    description=(
        "Redirects the user to Google's OAuth consent screen. "
        "Requests `offline` access so a refresh token is issued, "
        "enabling background Calendar sync without re-authentication."
    ),
)
def google_login() -> RedirectResponse:
    params = {
        "client_id":     CLIENT_ID,
        "redirect_uri":  REDIRECT_URI,
        "response_type": "code",
        "scope":         SCOPES,
        "access_type":   "offline",
        "prompt":        "consent",   # force refresh_token on every consent
    }
    query_string = "&".join(f"{k}={requests.utils.quote(v)}" for k, v in params.items())
    url = f"{GOOGLE_AUTH_URL}?{query_string}"
    logger.info("google_login: redirecting to Google consent screen.")
    return RedirectResponse(url)


@router.get(
    "/google/callback",
    summary="Handle Google OAuth callback",
    description=(
        "Receives the authorization `code` from Google, exchanges it for "
        "access + refresh tokens, decodes the `id_token` to extract the "
        "user's identity, and upserts a row in `app.users`. "
        "Returns `user_id` for use in subsequent API calls."
    ),
)
def google_callback(
    code: str = Query(..., description="Authorization code returned by Google"),
) -> dict:
    # ── 1. Exchange code for tokens ─────────────────────────────────────────
    token_resp = requests.post(
        GOOGLE_TOKEN_URL,
        data={
            "code":          code,
            "client_id":     CLIENT_ID,
            "client_secret": CLIENT_SECRET,
            "redirect_uri":  REDIRECT_URI,
            "grant_type":    "authorization_code",
        },
        timeout=10,
    )

    if not token_resp.ok:
        logger.error("google_callback: token exchange failed — %s", token_resp.text)
        raise HTTPException(status_code=400, detail="Token exchange with Google failed.")

    token_data: dict = token_resp.json()
    access_token:  str       = token_data.get("access_token", "")
    refresh_token: str | None = token_data.get("refresh_token")
    id_token_raw:  str       = token_data.get("id_token", "")

    if not refresh_token:
        # Google only issues refresh_token on first consent or with prompt=consent.
        # If missing here it means the user already granted access previously
        # and the flow was called without prompt=consent.
        logger.warning("google_callback: no refresh_token in response for this auth code.")
        raise HTTPException(
            status_code=400,
            detail="No refresh_token returned. Re-authorise via /auth/google/login.",
        )

    # ── 2. Decode id_token (no signature verification — we just issued it) ──
    try:
        claims: dict = jwt.decode(
            id_token_raw,
            options={"verify_signature": False},
            algorithms=["RS256"],
        )
    except jwt.DecodeError as exc:
        logger.error("google_callback: id_token decode failed — %s", exc)
        raise HTTPException(status_code=400, detail="Invalid id_token from Google.") from exc

    google_sub: str = claims["sub"]
    email:      str = claims["email"]

    # ── 3. Upsert user ───────────────────────────────────────────────────────
    user_id: int = upsert_user(
        google_sub=google_sub,
        email=email,
        refresh_token=refresh_token,
    )

    logger.info("google_callback: authenticated user_id=%d email=%s", user_id, email)
    return {"user_id": user_id, "email": email}