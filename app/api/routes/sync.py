from fastapi import APIRouter
from pydantic import BaseModel
from app.services.sync_service import run_sync

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
        "Parses the TMU timetable Excel file and synchronizes events "
        "to the Google Calendar of the specified user. "
        "Uses SHA-256 fingerprinting for idempotent sync — "
        "unchanged events are skipped, new ones created, modified ones updated."
    ),
)
def sync_calendar(user_id: int) -> SyncResult:
    """Trigger a full timetable → Google Calendar sync for `user_id`."""
    return run_sync(user_id)