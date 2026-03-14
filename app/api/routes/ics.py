"""
ics.py — PlaySync iCalendar Export

Generates a .ics file (RFC 5545) containing all timetable events
for the authenticated user. Compatible with Apple Calendar, Google
Calendar, and Outlook - no OAuth required.
"""

import logging
from datetime import date, datetime, time
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response

from app.api.dependencies import get_current_user
from app.db import repository

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["ics"])

TZ = ZoneInfo("Asia/Ho_Chi_Minh")


def _fmt_dt(d: date, t: time) -> str:
    """Format date + time to iCal DTSTART/DTEND string."""
    dt = datetime.combine(d, t, tzinfo=TZ)
    return dt.strftime("%Y%m%dT%H%M%S")


def _fmt_date(d: date) -> str:
    return d.strftime("%Y%m%d")


def _escape(text: str) -> str:
    """Escape iCal text field per RFC 5545."""
    return (
        text.replace("\\", "\\\\")
        .replace(";", "\\;")
        .replace(",", "\\,")
        .replace("\n", "\\n")
    )


def _build_ics(events: list[dict]) -> str:
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//PlaySync//TMU Schedule//VI",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "X-WR-CALNAME:Lich hoc TMU",
        "X-WR-TIMEZONE:Asia/Ho_Chi_Minh",
    ]

    for e in events:
        uid = f"{e['course_code']}_{e['id']}@playsync"
        summary = _escape(e.get("course_name", ""))
        location = _escape(e.get("room", ""))
        dtstart = _fmt_dt(e["start_date"], e["start_time"])
        dtend = _fmt_dt(e["start_date"], e["end_time"])
        until = _fmt_date(e["end_date"]) + "T170000Z"
        updated_at = e.get("updated_at") or datetime.now(TZ)
        dtstamp = (
            updated_at.strftime("%Y%m%dT%H%M%SZ")
            if hasattr(updated_at, "strftime")
            else datetime.now(TZ).strftime("%Y%m%dT%H%M%SZ")
        )

        lines += [
            "BEGIN:VEVENT",
            f"UID:{uid}",
            f"SUMMARY:{summary}",
            f"DTSTART;TZID=Asia/Ho_Chi_Minh:{dtstart}",
            f"DTEND;TZID=Asia/Ho_Chi_Minh:{dtend}",
            f"RRULE:FREQ=WEEKLY;UNTIL={until}",
            f"LOCATION:{location}",
            f"DTSTAMP:{dtstamp}",
            "END:VEVENT",
        ]

    lines.append("END:VCALENDAR")
    return "\r\n".join(lines) + "\r\n"


@router.get(
    "/ics/{user_id}",
    summary="Export timetable as .ics file",
    description=(
        "Returns an iCalendar (.ics) file for the user's selected courses. "
        "Compatible with Apple Calendar, Google Calendar, and Outlook."
    ),
    response_class=Response,
)
async def export_ics(
    user_id: int,
    current_user: int = Depends(get_current_user),
) -> Response:
    if current_user != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only export your own calendar.",
        )

    events: list[dict] = repository.get_events_with_mapping_filtered(user_id)

    if not events:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No events found. Add courses first.",
        )

    ics_content = _build_ics(events)

    return Response(
        content=ics_content,
        media_type="text/calendar; charset=utf-8",
        headers={
            "Content-Disposition": 'attachment; filename="playsync.ics"',
            "Cache-Control": "no-store",
        },
    )
