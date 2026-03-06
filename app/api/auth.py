# app/api/auth.py
"""
Google OAuth2 authentication router for PlaySync.

Flow:
  1. GET /auth/google/login        → redirect user to Google consent screen
  2. GET /auth/google/callback     → exchange code for tokens, upsert user,
                                     return signed JWT + user_id
"""
import logging
import os

import jwt
import requests
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import RedirectResponse

from app.api.dependencies import create_access_token
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
        "prompt":        "consent",
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
        "user's identity, upserts a row in `app.users`, and returns a "
        "signed JWT for use in subsequent API calls."
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
    refresh_token: str | None = token_data.get("refresh_token")
    id_token_raw:  str        = token_data.get("id_token", "")

    if not refresh_token:
        logger.warning("google_callback: no refresh_token in response.")
        raise HTTPException(
            status_code=400,
            detail="No refresh_token returned. Re-authorise via /auth/google/login.",
        )

    # ── 2. Decode id_token ───────────────────────────────────────────────────
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

    # ── 4. Issue PlaySync JWT ────────────────────────────────────────────────
    access_token: str = create_access_token(user_id)

    logger.info("google_callback: issued JWT for user_id=%d email=%s", user_id, email)

    # ── 5. Redirect to frontend with token ───────────────────────────────────
    frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
    redirect_url = f"{frontend_url}/callback?token={access_token}&user_id={user_id}"
    return RedirectResponse(url=redirect_url)