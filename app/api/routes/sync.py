# app/api/routes/sync.py
import logging

from fastapi import APIRouter
from pydantic import BaseModel

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
def sync_calendar(user_id: int) -> SyncResult:
    """Trigger a timetable → Google Calendar sync for `user_id`."""
    return run_sync(user_id)