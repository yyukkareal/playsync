# app/api/routes/users.py
import logging

from fastapi import APIRouter
from pydantic import BaseModel

from app.db.repository import get_user_courses, set_user_courses

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["users"])


class CourseSelectionIn(BaseModel):
    course_codes: list[str]


class CourseSelectionOut(BaseModel):
    user_id: int
    course_codes: list[str]


@router.get(
    "/users/{user_id}/courses",
    response_model=CourseSelectionOut,
    summary="Get user's selected courses",
    description="Return the list of course codes this user has selected for Google Calendar sync.",
)
def get_courses(user_id: int) -> CourseSelectionOut:
    rows = get_user_courses(user_id)
    codes = [r["course_code"] for r in rows]
    logger.info("get_courses: user=%d has %d course(s).", user_id, len(codes))
    return CourseSelectionOut(user_id=user_id, course_codes=codes)


@router.post(
    "/users/{user_id}/courses",
    response_model=CourseSelectionOut,
    summary="Set user's course selection",
    description=(
        "Replace the user's course selection with the provided list. "
        "Pass an empty list to clear all. "
        "After saving, trigger `POST /api/sync/{user_id}` to sync only these courses."
    ),
)
def set_courses(user_id: int, body: CourseSelectionIn) -> CourseSelectionOut:
    codes = [c.strip().upper() for c in body.course_codes if c.strip()]
    set_user_courses(user_id, codes)
    logger.info("set_courses: user=%d saved %d course(s).", user_id, len(codes))
    return CourseSelectionOut(user_id=user_id, course_codes=codes)