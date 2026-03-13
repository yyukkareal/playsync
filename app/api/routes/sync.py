# app/api/routes/sync.py
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.api.dependencies import get_current_user
from app.services.sync_service import run_sync

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["sync"])


class SyncResult(BaseModel):
    created_events: int
    updated_events: int
    skipped_events: int


@router.post(
    "/sync/{user_id}",
    response_model=SyncResult,
    summary="Sync timetable to Google Calendar",
    description=(
        "Syncs only the courses selected via `POST /api/users/{user_id}/courses`. "
        "If no courses are selected, falls back to syncing all events. "
        "Uses SHA-256 fingerprinting — unchanged events are skipped."
    ),
)
async def sync_calendar(
    user_id: int,
    current_user: int = Depends(get_current_user),
) -> SyncResult:
    if current_user != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only sync your own calendar.",
        )
    return await run_sync(user_id)