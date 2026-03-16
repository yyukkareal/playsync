# app/api/routes/users.py
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.api.dependencies import get_current_user
from app.db.repository import get_user_courses, set_user_courses, add_user_course, course_exists, get_user_by_id

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["users"])


class CourseSelectionIn(BaseModel):
    course_codes: list[str]


class UserOut(BaseModel):
    id: int
    email: str
    full_name: str | None = None


class CourseDetail(BaseModel):
    code: str
    name: str | None = None


class CourseSelectionOut(BaseModel):
    user_id: int
    courses: list[CourseDetail]


class CourseAddIn(BaseModel):
    course_code: str


class CourseAddOut(BaseModel):
    user_id: int
    course_code: str
    message: str


def _require_self(user_id: int, current_user: int) -> None:
    if current_user != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only access your own data.",
        )


# ---------------------------------------------------------------------------
# /me endpoints — identity from JWT, no user_id in path
# ---------------------------------------------------------------------------

@router.get(
    "/users/me",
    response_model=UserOut,
    summary="Get my user profile",
)
def get_my_profile(current_user: int = Depends(get_current_user)) -> UserOut:
    user = get_user_by_id(current_user)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    return UserOut(
        id=user["id"],
        email=user["email"],
        full_name=user.get("full_name"),
    )


@router.get(
    "/users/me/courses",
    response_model=CourseSelectionOut,
    summary="Get my selected courses",
)
def get_my_courses(current_user: int = Depends(get_current_user)) -> CourseSelectionOut:
    rows = get_user_courses(current_user)
    courses = [
        CourseDetail(code=r["course_code"], name=r.get("course_name") or "Không rõ tên môn") 
        for r in rows
    ]
    logger.info("get_my_courses: user=%d has %d course(s).", current_user, len(courses))
    return CourseSelectionOut(user_id=current_user, courses=courses)


@router.post(
    "/users/me/courses",
    response_model=CourseAddOut,
    summary="Add a single course to my selection",
    description="Add one course by code. Duplicate codes are silently ignored.",
)
def add_my_course(
    body: CourseAddIn,
    current_user: int = Depends(get_current_user),
) -> CourseAddOut:
    code = body.course_code.strip().upper()
    if not code:
        raise HTTPException(status_code=400, detail="course_code must not be empty.")
    if not course_exists(code):
        raise HTTPException(status_code=404, detail=f"Mã môn '{code}' không tồn tại trong hệ thống.")
    add_user_course(current_user, code)
    logger.info("add_my_course: user=%d added course=%s.", current_user, code)
    return CourseAddOut(user_id=current_user, course_code=code, message="Course added.")


@router.delete(
    "/users/me/courses/{course_code}",
    summary="Remove a course from my selection",
)
def remove_my_course(
    course_code: str,
    current_user: int = Depends(get_current_user),
) -> dict:
    from app.db.repository import remove_user_course
    remove_user_course(current_user, course_code.strip().upper())
    logger.info("remove_my_course: user=%d removed course=%s.", current_user, course_code)
    return {"message": f"Course {course_code.upper()} removed."}


# ---------------------------------------------------------------------------
# Legacy /users/{user_id}/courses endpoints
# ---------------------------------------------------------------------------

@router.get(
    "/users/{user_id}/courses",
    response_model=CourseSelectionOut,
    summary="Get user's selected courses",
)
def get_courses(
    user_id: int,
    current_user: int = Depends(get_current_user),
) -> CourseSelectionOut:
    _require_self(user_id, current_user)
    rows = get_user_courses(user_id)
    courses = [
        CourseDetail(code=r["course_code"], name=r.get("course_name") or "Không rõ tên môn") 
        for r in rows
    ]
    logger.info("get_courses: user=%d has %d course(s).", user_id, len(courses))
    return CourseSelectionOut(user_id=user_id, courses=courses)


@router.post(
    "/users/{user_id}/courses",
    response_model=CourseSelectionOut,
    summary="Set user's course selection (replace all)",
)
def set_courses(
    user_id: int,
    body: CourseSelectionIn,
    current_user: int = Depends(get_current_user),
) -> CourseSelectionOut:
    _require_self(user_id, current_user)
    codes = [c.strip().upper() for c in body.course_codes if c.strip()]
    set_user_courses(user_id, codes)
    
    # Lấy lại data từ DB sau khi set để đảm bảo đồng bộ tên môn
    rows = get_user_courses(user_id)
    courses = [
        CourseDetail(code=r["course_code"], name=r.get("course_name") or "Không rõ tên môn") 
        for r in rows
    ]
    
    logger.info("set_courses: user=%d saved %d course(s).", user_id, len(codes))
    return CourseSelectionOut(user_id=user_id, courses=courses)