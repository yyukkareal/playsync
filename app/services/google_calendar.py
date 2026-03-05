"""
google_calendar.py — PlaySync Google Calendar API Adapter

Responsibilities:
  - Initialize the Google Calendar API client via OAuth env vars.
  - Convert internal event dicts into Google Calendar event payloads.
  - Create, update, and delete Google Calendar events.

Non-goals:
  - No sync logic, no deduplication, no DB access.
  - Never queries Google Calendar to detect existing events.
  - Idempotency is owned by sync_service.py + calendar_mappings table.
"""

import os
import logging
from datetime import date, time, datetime, timezone

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

logger = logging.getLogger(__name__)

TIMEZONE = "Asia/Ho_Chi_Minh"
SCOPES = ["https://www.googleapis.com/auth/calendar"]


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _require_env(name: str) -> str:
    """Return an environment variable or raise if absent."""
    value = os.getenv(name)
    if not value:
        raise EnvironmentError(
            f"Required environment variable '{name}' is not set."
        )
    return value


def _require_field(event: dict, field: str):
    """Return a field from the event dict or raise if missing/None."""
    value = event.get(field)
    if value is None:
        raise ValueError(f"Event is missing required field: '{field}'")
    return value


def _format_datetime(d: date, t: time) -> str:
    """Combine a date and time into an RFC3339-style local datetime string."""
    dt = datetime.combine(d, t)
    return dt.strftime("%Y-%m-%dT%H:%M:%S")


def _format_rrule_until(end_date: date) -> str:
    """Format end_date as YYYYMMDD for use in RRULE UNTIL."""
    return end_date.strftime("%Y%m%dT235959Z")


def _build_description(course_code: str | None, instructor: str | None) -> str:
    parts = []
    if course_code:
        parts.append(f"Course code: {course_code}")
    if instructor:
        parts.append(f"Instructor:  {instructor}")
    return "\n".join(parts)


# ---------------------------------------------------------------------------
# GoogleCalendarService
# ---------------------------------------------------------------------------

class GoogleCalendarService:
    """
    Thin adapter around the Google Calendar API.

    All methods accept/return plain dicts; no ORM models or DB calls here.
    """

    def __init__(self) -> None:
        self._calendar_id = _require_env("GOOGLE_CALENDAR_ID")
        self._service = self._build_service()

    # ------------------------------------------------------------------
    # Client initialisation
    # ------------------------------------------------------------------

    def _build_service(self):
        """Build and return an authenticated Google Calendar API client."""
        creds = Credentials(
            token=_require_env("GOOGLE_ACCESS_TOKEN"),
            refresh_token=_require_env("GOOGLE_REFRESH_TOKEN"),
            client_id=_require_env("GOOGLE_CLIENT_ID"),
            client_secret=_require_env("GOOGLE_CLIENT_SECRET"),
            token_uri="https://oauth2.googleapis.com/token",
            scopes=SCOPES,
        )
        return build("calendar", "v3", credentials=creds, cache_discovery=False)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def build_event_body(self, event: dict) -> dict:
        """
        Convert an internal event dict into a Google Calendar event payload.

        The event is created as a weekly recurring event that repeats until
        event['end_date']. The fingerprint is stored in extendedProperties
        so sync_service.py can detect stale mappings without querying GCal.

        Args:
            event: Internal event dict matching the events DB schema.

        Returns:
            A dict ready to be passed to the Google Calendar API.

        Raises:
            ValueError: If any required field is missing.
        """
        # --- required fields ---
        course_name: str  = _require_field(event, "course_name")
        course_code: str  = _require_field(event, "course_code")
        instructor: str | None = event.get("instructor")
        room: str         = _require_field(event, "room")
        start_date: date  = _require_field(event, "start_date")
        end_date: date    = _require_field(event, "end_date")
        start_time: time  = _require_field(event, "start_time")
        end_time: time    = _require_field(event, "end_time")
        fingerprint: str  = _require_field(event, "fingerprint")

        if end_date < start_date:
            raise ValueError(
                f"end_date ({end_date}) must not be before start_date ({start_date})."
            )

        start_dt = _format_datetime(start_date, start_time)
        end_dt   = _format_datetime(start_date, end_time)   # same day; RRULE handles recurrence
        until    = _format_rrule_until(end_date)

        return {
            "summary": course_name,
            "location": room,
            "description": _build_description(course_code, instructor),
            "start": {
                "dateTime": start_dt,
                "timeZone": TIMEZONE,
            },
            "end": {
                "dateTime": end_dt,
                "timeZone": TIMEZONE,
            },
            "recurrence": [
                f"RRULE:FREQ=WEEKLY;UNTIL={until}",
            ],
            "extendedProperties": {
                "private": {
                    "playsync_fingerprint": fingerprint,
                },
            },
        }

    def create_event(self, event: dict) -> dict:
        """
        Create a new Google Calendar event from an internal event dict.

        Args:
            event: Internal event dict.

        Returns:
            The created Google Calendar event resource (dict).

        Raises:
            ValueError: If required fields are missing.
            googleapiclient.errors.HttpError: On API failure.
        """
        body = self.build_event_body(event)
        try:
            created = (
                self._service.events()
                .insert(calendarId=self._calendar_id, body=body)
                .execute()
            )
        except HttpError as exc:
            logger.error(
                "Failed to create GCal event for course '%s': %s",
                event.get("course_code"), exc,
            )
            raise

        logger.info(
            "Created GCal event '%s' (id=%s) for course %s",
            created.get("summary"),
            created.get("id"),
            event.get("course_code"),
        )
        return created

    def update_event(self, google_event_id: str, event: dict) -> dict:
        """
        Update an existing Google Calendar event.

        Uses a full PUT (events.update) rather than a PATCH so that stale
        fields from a previous sync round are always overwritten cleanly.

        Args:
            google_event_id: The GCal event ID stored in calendar_mappings.
            event: Updated internal event dict.

        Returns:
            The updated Google Calendar event resource (dict).

        Raises:
            ValueError: If required fields are missing.
            googleapiclient.errors.HttpError: On API failure.
        """
        if not google_event_id:
            raise ValueError("google_event_id must not be empty.")

        body = self.build_event_body(event)
        try:
            updated = (
                self._service.events()
                .update(
                    calendarId=self._calendar_id,
                    eventId=google_event_id,
                    body=body,
                )
                .execute()
            )
        except HttpError as exc:
            logger.error(
                "Failed to update GCal event '%s' for course '%s': %s",
                google_event_id, event.get("course_code"), exc,
            )
            raise

        logger.info(
            "Updated GCal event '%s' (id=%s) for course %s",
            updated.get("summary"),
            updated.get("id"),
            event.get("course_code"),
        )
        return updated

    def delete_event(self, google_event_id: str) -> None:
        """
        Delete a Google Calendar event by its GCal event ID.

        Silently ignores 410 Gone responses — the event was already deleted.

        Args:
            google_event_id: The GCal event ID stored in calendar_mappings.

        Raises:
            ValueError: If google_event_id is empty.
            googleapiclient.errors.HttpError: On unexpected API failure.
        """
        if not google_event_id:
            raise ValueError("google_event_id must not be empty.")

        try:
            (
                self._service.events()
                .delete(calendarId=self._calendar_id, eventId=google_event_id)
                .execute()
            )
            logger.info("Deleted GCal event id=%s", google_event_id)
        except HttpError as exc:
            if exc.resp.status == 410:
                # Already gone — treat as success so mappings can be cleaned up.
                logger.warning(
                    "GCal event '%s' was already deleted (410 Gone).", google_event_id
                )
            else:
                logger.error(
                    "Failed to delete GCal event '%s': %s", google_event_id, exc
                )
                raise