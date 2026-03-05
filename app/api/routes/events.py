# app/api/routes/events.py
import logging
from datetime import date, time

from fastapi import APIRouter, Query
from pydantic import BaseModel

from app.db.repository import get_all_events

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["events"])


class EventOut(BaseModel):
    id: int
    course_code: str
    course_name: str
    weekday: int
    start_time: time
    end_time: time
    room: str
    start_date: date
    end_date: date
    instructor: str
    duration: int
    fingerprint: str


@router.get(
    "/events",
    response_model=list[EventOut],
    summary="List timetable events",
    description=(
        "Return all events stored in the timetable. "
        "Optionally filter by `course_code` (case-insensitive). "
        "Useful for letting users browse available courses before selecting them."
    ),
)
def list_events(
    course_code: str | None = Query(
        default=None,
        description="Filter by course code, e.g. MIS101",
    )
) -> list[EventOut]:
    rows = get_all_events(course_code=course_code)
    logger.info("list_events: returning %d event(s) (filter=%s).", len(rows), course_code)
    return rows