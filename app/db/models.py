# app/api/routes/events.py
import logging
from datetime import date, time

from fastapi import APIRouter, Query
from pydantic import BaseModel

from app.db.repository import get_all_events, search_courses

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
    instructor: str | None = None
    duration: int | None = None
    fingerprint: str


class ScheduleOut(BaseModel):
    weekday: int
    start_time: time
    end_time: time
    room: str


class CourseSearchResult(BaseModel):
    course_code: str
    course_name: str
    schedules: list[ScheduleOut]


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


@router.get(
    "/courses/search",
    response_model=list[CourseSearchResult],
    summary="Search courses by name or code",
    description=(
        "Search for courses by name or code (case-insensitive, partial match). "
        "Returns distinct classes grouped with their schedules. "
        "Use the returned `course_code` to add to user's selection."
    ),
)
def search_courses_endpoint(
    q: str = Query(
        min_length=1,
        description="Search query, e.g. 'quản trị' or 'MIS'",
    )
) -> list[CourseSearchResult]:
    results = search_courses(q)
    logger.info("search_courses: query=%r returned %d result(s).", q, len(results))
    return results