import logging
from fastapi import APIRouter, Query, Depends
from pydantic import BaseModel

from app.api.dependencies import get_current_user
from app.db.repository import get_all_events

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["courses"])

class ScheduleOut(BaseModel):
    weekday: int
    start_time: str
    end_time: str
    room: str

class CourseResult(BaseModel):
    course_code: str
    course_name: str
    schedules: list[ScheduleOut]

@router.get(
    "/courses/search",
    response_model=list[CourseResult],
    summary="Search courses by name or code",
)
def search_courses(
    q: str = Query(..., min_length=1, description="Search keyword"),
    current_user: int = Depends(get_current_user),
) -> list[CourseResult]:
    # Lấy toàn bộ events từ DB
    all_events = get_all_events()
    keyword = q.strip().lower()
    
    courses_dict = {}
    
    for row in all_events:
        # Xử lý linh hoạt cả định dạng dict-like (sqlite3.Row) và object-like (SQLAlchemy)
        try:
            code = row["course_code"]
            name = row["course_name"]
            st = row["start_time"]
            et = row["end_time"]
            room = row["room"]
            weekday = row["weekday"]
        except TypeError:
            code = getattr(row, "course_code", "")
            name = getattr(row, "course_name", "")
            st = getattr(row, "start_time", "")
            et = getattr(row, "end_time", "")
            room = getattr(row, "room", "")
            weekday = getattr(row, "weekday", 1)
            
        # Kiểm tra logic Search
        if keyword in code.lower() or keyword in name.lower():
            if code not in courses_dict:
                courses_dict[code] = {
                    "course_code": code,
                    "course_name": name,
                    "schedules": []
                }
            
            # Format time chuẩn HH:MM cho Frontend
            st_str = st.strftime("%H:%M") if hasattr(st, "strftime") else str(st)[:5]
            et_str = et.strftime("%H:%M") if hasattr(et, "strftime") else str(et)[:5]
            
            sched = {
                "weekday": weekday,
                "start_time": st_str,
                "end_time": et_str,
                "room": room
            }
            
            # Tránh duplicate các lịch học bị lặp
            if sched not in courses_dict[code]["schedules"]:
                courses_dict[code]["schedules"].append(sched)

    results = list(courses_dict.values())
    
    # Sort data theo mã môn để UI hiển thị gọn gàng
    results.sort(key=lambda x: x["course_code"])
    
    logger.info("search_courses: found %d courses for query '%s'", len(results), q)
    return results