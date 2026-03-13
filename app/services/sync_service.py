"""
sync_service.py — PlaySync Timetable Synchronisation Orchestrator

Responsibilities:
  - Fetch the user's refresh token from DB to build a per-user GCal client.
  - Fetch events + existing GCal mapping status from the DB (via repository).
  - Decide whether each event should be created, updated, or skipped.
  - Delegate all Google API calls to GoogleCalendarService.
  - Record a sync_runs audit row (PENDING → SUCCESS | FAILED).
"""

import asyncio
import logging
import time
from datetime import datetime, timezone
from typing import Literal, TypedDict

from app.db import repository
from app.services.google_calendar import GoogleCalendarService

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Types
# ---------------------------------------------------------------------------

class SyncSummary(TypedDict):
    created_events: int
    updated_events: int
    skipped_events: int


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _is_stale(event: dict) -> bool:
    last_synced_at: datetime | None = event.get("last_synced_at")
    if last_synced_at is None:
        return True

    updated_at: datetime | None = event.get("updated_at")
    if updated_at is None:
        return True

    def _utc(dt: datetime) -> datetime:
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)

    return _utc(updated_at) > _utc(last_synced_at)


def _handle_create(gcal: GoogleCalendarService, user_id: int, event: dict) -> None:
    created = gcal.create_event(event)
    google_event_id: str = created["id"]
    repository.insert_calendar_mapping(user_id, event["id"], google_event_id)
    repository.update_calendar_mapping_sync_time(user_id, event["id"])


def _handle_update(gcal: GoogleCalendarService, user_id: int, event: dict) -> None:
    google_event_id: str = event["google_event_id"]
    gcal.update_event(google_event_id, event)
    repository.update_calendar_mapping_sync_time(user_id, event["id"])
    logger.debug("Updated GCal event '%s' (google_event_id=%s) for user %d.",
                 event.get("course_name"), google_event_id, user_id)


async def _create_task(
    gcal: GoogleCalendarService,
    user_id: int,
    event: dict,
) -> Literal["created"]:
    await asyncio.to_thread(_handle_create, gcal, user_id, event)
    return "created"


async def _update_task(
    gcal: GoogleCalendarService,
    user_id: int,
    event: dict,
) -> Literal["updated"]:
    await asyncio.to_thread(_handle_update, gcal, user_id, event)
    return "updated"


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def run_sync(user_id: int, gcal=None) -> SyncSummary:
    """
    Synchronise timetable events for *user_id* to their Google Calendar.

    Fetches the user's refresh token from DB to authenticate as that user,
    so events are synced to their own calendar — not a shared service account.
    """
    run_id: int = repository.create_sync_run(user_id)
    logger.info("Sync run %d started for user %d.", run_id, user_id)

    created = updated = skipped = 0
    wall_start = time.monotonic()

    try:
        if gcal is None:
            # Fetch this user's refresh token and build a per-user GCal client
            user = repository.get_user_by_id(user_id)
            if user is None:
                raise ValueError(f"User {user_id} not found.")

            refresh_token: str | None = user.get("google_refresh_token")
            if not refresh_token:
                raise ValueError(
                    f"User {user_id} has no refresh token. "
                    "They need to re-authenticate via /auth/google/login."
                )

            gcal = GoogleCalendarService(refresh_token=refresh_token)

        events: list[dict] = repository.get_events_with_mapping_filtered(user_id)

        tasks = []

        for event in events:
            google_event_id: str | None = event.get("google_event_id")

            if google_event_id is None:
                tasks.append(_create_task(gcal, user_id, event))
            elif _is_stale(event):
                tasks.append(_update_task(gcal, user_id, event))
            else:
                logger.debug(
                    "Skipping unchanged event '%s' (id=%d) for user %d.",
                    event.get("course_name"),
                    event["id"],
                    user_id,
                )
                skipped += 1

        if tasks:
            results = await asyncio.gather(*tasks)
            created = sum(1 for r in results if r == "created")
            updated = sum(1 for r in results if r == "updated")

        run_time = time.monotonic() - wall_start
        repository.finish_sync_run(
            run_id,
            status="SUCCESS",
            created=created,
            updated=updated,
            skipped=skipped,
        )
        logger.info(
            "Sync run %d finished in %.2fs — created=%d, updated=%d, skipped=%d.",
            run_id,
            run_time,
            created,
            updated,
            skipped,
        )

    except Exception:
        run_time = time.monotonic() - wall_start
        repository.finish_sync_run(
            run_id,
            status="FAILED",
            created=created,
            updated=updated,
            skipped=skipped,
        )
        logger.exception("Sync run %d FAILED after %.2fs.", run_id, run_time)
        raise

    return SyncSummary(
        created_events=created,
        updated_events=updated,
        skipped_events=skipped,
    )