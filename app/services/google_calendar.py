"""
app/services/google_calendar.py
Google Calendar integration service for PlaySync.

Receives plain event dictionaries from the repository layer and pushes
them to Google Calendar as weekly recurring events.

Sync is idempotent: the fingerprint of each timetable event is stored in
the Google Calendar event's extendedProperties so that events already
synced are never created twice.

Required environment variables:
    GOOGLE_CLIENT_ID
    GOOGLE_CLIENT_SECRET
    GOOGLE_REDIRECT_URI
    GOOGLE_ACCESS_TOKEN      – OAuth access token for the authenticated user
    GOOGLE_REFRESH_TOKEN     – OAuth refresh token
    GOOGLE_CALENDAR_ID       – Target calendar (defaults to "primary")
"""

import os
import sys
from datetime import date, datetime, time
from typing import Any

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

SCOPES = ["https://www.googleapis.com/auth/calendar"]
DEFAULT_TIMEZONE = "Asia/Ho_Chi_Minh"

# RFC 5545 weekday codes keyed by TMU numeric weekday (2 = Mon … 7 = Sat).
# Cập nhật mapping để khớp với dữ liệu thực tế (1 = Mon, 2 = Tue, ...)
_WEEKDAY_MAP: dict[str | int, str] = {
    1: "MO", "1": "MO",
    2: "TU", "2": "TU",
    3: "WE", "3": "WE",
    4: "TH", "4": "TH",
    5: "FR", "5": "FR",
    6: "SA", "6": "SA",
    7: "SU", "7": "SU",
}

# Namespace key used in Google Calendar extendedProperties to store the
# timetable fingerprint so we can detect already-synced events.
_FINGERPRINT_KEY = "playsync_fingerprint"


# ---------------------------------------------------------------------------
# Service class
# ---------------------------------------------------------------------------

class GoogleCalendarService:
    """Synchronize TMU timetable events with Google Calendar."""

    # ------------------------------------------------------------------
    # Initialisation
    # ------------------------------------------------------------------

    def __init__(self) -> None:
        """
        Build the Google Calendar API client from OAuth 2.0 credentials
        sourced entirely from environment variables.
        """
        creds = Credentials(
            token=os.environ["GOOGLE_ACCESS_TOKEN"],
            refresh_token=os.environ["GOOGLE_REFRESH_TOKEN"],
            token_uri="https://oauth2.googleapis.com/token",
            client_id=os.environ["GOOGLE_CLIENT_ID"],
            client_secret=os.environ["GOOGLE_CLIENT_SECRET"],
            scopes=SCOPES,
        )
        self._service = build("calendar", "v3", credentials=creds)
        self._calendar_id = os.environ.get("GOOGLE_CALENDAR_ID", "primary")

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def build_event_body(
        self,
        event: dict[str, Any],
        timezone: str = DEFAULT_TIMEZONE,
    ) -> dict[str, Any]:
        """
        Convert a timetable event dictionary into a Google Calendar
        event payload.

        - start/end datetimes are anchored on *start_date* (first occurrence)
        - The RRULE repeats weekly on the correct weekday until *end_date*
        - The event fingerprint is stored in extendedProperties so that
          subsequent sync runs can detect and skip this event
        """
        rfc_day = _WEEKDAY_MAP.get(event["weekday"])
        if rfc_day is None:
            raise ValueError(
                f"Unknown weekday '{event['weekday']}'. "
                f"Expected one of {sorted(set(_WEEKDAY_MAP.values()))}."
            )

        start_date = _to_date(event["start_date"])
        end_date   = _to_date(event["end_date"])
        start_time = _to_time(event["start_time"])
        end_time   = _to_time(event["end_time"])

        start_dt = datetime.combine(start_date, start_time)
        end_dt   = datetime.combine(start_date, end_time)
        until    = end_date.strftime("%Y%m%d")

        description_parts = []
        if event.get("course_code"):
            description_parts.append(f"Course code: {event['course_code']}")
        if event.get("instructor"):
            description_parts.append(f"Instructor: {event['instructor']}")

        return {
            "summary": event.get("course_name", ""),
            "location": event.get("room", ""),
            "description": "\n".join(description_parts),
            "start": {
                "dateTime": start_dt.isoformat(),
                "timeZone": timezone,
            },
            "end": {
                "dateTime": end_dt.isoformat(),
                "timeZone": timezone,
            },
            "recurrence": [
                f"RRULE:FREQ=WEEKLY;BYDAY={rfc_day};UNTIL={until}"
            ],
            "extendedProperties": {
                "private": {
                    _FINGERPRINT_KEY: event.get("fingerprint", ""),
                }
            },
        }

    def create_recurring_event(
        self,
        event: dict[str, Any],
        timezone: str = DEFAULT_TIMEZONE,
    ) -> dict[str, Any]:
        """
        Insert a single recurring event into Google Calendar.

        Returns the created event resource dictionary.
        """
        body = self.build_event_body(event, timezone=timezone)
        return (
            self._service.events()
            .insert(calendarId=self._calendar_id, body=body)
            .execute()
        )

    def sync_events(
        self,
        events: list[dict[str, Any]],
        timezone: str = DEFAULT_TIMEZONE,
    ) -> int:
        """
        Synchronize a list of timetable events to Google Calendar.

        Idempotency strategy:
        1. Fetch all fingerprints already stored in this calendar.
        2. Deduplicate the incoming list by fingerprint (one event per
           unique slot — identical rows from the Excel file are collapsed).
        3. Skip any event whose fingerprint already exists in the calendar.
        4. Create recurring events only for new fingerprints.

        Returns the number of events newly created in this run.
        """
        if not events:
            return 0

        existing_fingerprints = self._fetch_existing_fingerprints()

        # Deduplicate incoming events by fingerprint.
        unique_events: dict[str, dict[str, Any]] = {}
        for event in events:
            fp = event.get("fingerprint", "")
            if fp:
                unique_events[fp] = event

        synced = 0
        for fingerprint, event in unique_events.items():
            if fingerprint in existing_fingerprints:
                continue  # already synced in a previous run

            try:
                self.create_recurring_event(event, timezone=timezone)
                synced += 1
            except HttpError as exc:
                _warn(f"Google API error for fingerprint {fingerprint}: {exc}")
            except (KeyError, ValueError) as exc:
                _warn(f"Skipping malformed event {fingerprint}: {exc}")

        return synced

    # Alias used by the /sync endpoint in main.py
    def create_events(self, events: list[dict[str, Any]]) -> int:
        return self.sync_events(events)

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _fetch_existing_fingerprints(self) -> set[str]:
        """
        Retrieve every PlaySync fingerprint already stored in the target
        calendar by querying extendedProperties with pagination.
        """
        fingerprints: set[str] = set()
        page_token: str | None = None
        filter_str = f"{_FINGERPRINT_KEY}="

        while True:
            try:
                response = (
                    self._service.events()
                    .list(
                        calendarId=self._calendar_id,
                        privateExtendedProperty=filter_str,
                        fields=(
                            "nextPageToken,"
                            "items(extendedProperties/private)"
                        ),
                        pageToken=page_token,
                        maxResults=2500,
                    )
                    .execute()
                )
            except HttpError as exc:
                _warn(f"Could not fetch existing fingerprints: {exc}")
                break

            for item in response.get("items", []):
                fp = (
                    item.get("extendedProperties", {})
                    .get("private", {})
                    .get(_FINGERPRINT_KEY, "")
                )
                if fp:
                    fingerprints.add(fp)

            page_token = response.get("nextPageToken")
            if not page_token:
                break

        return fingerprints


# ---------------------------------------------------------------------------
# Module-level helpers
# ---------------------------------------------------------------------------

def _to_date(value) -> date:
    """Coerce an ISO string or date/datetime object to a plain date."""
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    return date.fromisoformat(str(value))


def _to_time(value) -> time:
    """Coerce an HH:MM or HH:MM:SS string (or time object) to time."""
    if isinstance(value, time):
        return value
    return time.fromisoformat(str(value))


def _warn(message: str) -> None:
    print(f"[PlaySync WARNING] {message}", file=sys.stderr)