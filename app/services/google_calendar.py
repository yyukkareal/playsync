"""
google_calendar.py — PlaySync Google Calendar API Adapter

Responsibilities:
  - Initialize the Google Calendar API client using a per-user refresh token.
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
    value = os.getenv(name)
    if not value:
        raise EnvironmentError(f"Required environment variable '{name}' is not set.")
    return value


def _require_field(event: dict, field: str):
    value = event.get(field)
    if value is None:
        raise ValueError(f"Event is missing required field: '{field}'")
    return value


def _format_datetime(d: date, t: time) -> str:
    return datetime.combine(d, t).strftime("%Y-%m-%dT%H:%M:%S")


def _format_rrule_until(end_date: date) -> str:
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

    Accepts a per-user refresh_token so each user's events are synced
    to their own Google Calendar, not a shared service account calendar.
    """

    def __init__(self, refresh_token: str) -> None:
        """
        Args:
            refresh_token: The user's OAuth2 refresh token from app.users.
        """
        self._calendar_id = "primary"  # always sync to the user's primary calendar
        self._service = self._build_service(refresh_token)

    # ------------------------------------------------------------------
    # Client initialisation
    # ------------------------------------------------------------------

    def _build_service(self, refresh_token: str):
        """Build an authenticated Calendar client for the given refresh_token."""
        creds = Credentials(
            token=None,  # will be refreshed automatically on first API call
            refresh_token=refresh_token,
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
        course_name: str       = _require_field(event, "course_name")
        course_code: str       = _require_field(event, "course_code")
        instructor: str | None = event.get("instructor")
        room: str              = _require_field(event, "room")
        start_date: date       = _require_field(event, "start_date")
        end_date: date         = _require_field(event, "end_date")
        start_time: time       = _require_field(event, "start_time")
        end_time: time         = _require_field(event, "end_time")
        fingerprint: str       = _require_field(event, "fingerprint")

        if end_date < start_date:
            raise ValueError(
                f"end_date ({end_date}) must not be before start_date ({start_date})."
            )

        start_dt = _format_datetime(start_date, start_time)
        end_dt   = _format_datetime(start_date, end_time)
        until    = _format_rrule_until(end_date)

        return {
            "summary": course_name,
            "location": room,
            "description": _build_description(course_code, instructor),
            "start": {"dateTime": start_dt, "timeZone": TIMEZONE},
            "end":   {"dateTime": end_dt,   "timeZone": TIMEZONE},
            "recurrence": [f"RRULE:FREQ=WEEKLY;UNTIL={until}"],
            "extendedProperties": {
                "private": {"playsync_fingerprint": fingerprint},
            },
        }

    def create_event(self, event: dict) -> dict:
        body = self.build_event_body(event)
        try:
            created = (
                self._service.events()
                .insert(calendarId=self._calendar_id, body=body)
                .execute()
            )
        except HttpError as exc:
            logger.error("Failed to create GCal event for course '%s': %s",
                         event.get("course_code"), exc)
            raise

        logger.info("Created GCal event '%s' (id=%s) for course %s",
                    created.get("summary"), created.get("id"), event.get("course_code"))
        return created

    def update_event(self, google_event_id: str, event: dict) -> dict:
        if not google_event_id:
            raise ValueError("google_event_id must not be empty.")

        body = self.build_event_body(event)
        try:
            updated = (
                self._service.events()
                .update(calendarId=self._calendar_id, eventId=google_event_id, body=body)
                .execute()
            )
        except HttpError as exc:
            logger.error("Failed to update GCal event '%s' for course '%s': %s",
                         google_event_id, event.get("course_code"), exc)
            raise

        logger.info("Updated GCal event '%s' (id=%s) for course %s",
                    updated.get("summary"), updated.get("id"), event.get("course_code"))
        return updated

    def delete_event(self, google_event_id: str) -> None:
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
                logger.warning("GCal event '%s' already deleted (410 Gone).", google_event_id)
            else:
                logger.error("Failed to delete GCal event '%s': %s", google_event_id, exc)
                raise