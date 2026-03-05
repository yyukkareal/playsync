"""
sync_service.py — PlaySync Timetable Synchronisation Orchestrator

Responsibilities:
  - Fetch events + existing GCal mapping status from the DB (via repository).
  - Decide whether each event should be created, updated, or skipped.
  - Delegate all Google API calls to GoogleCalendarService.
  - Record a sync_runs audit row (PENDING → SUCCESS | FAILED).

Design principle:
  PostgreSQL is the source of truth; Google Calendar is only a mirror.
  No GCal queries are made here — idempotency is owned by calendar_mappings.
"""

import logging
import time
from datetime import datetime, timezone
from typing import TypedDict

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
    """
    Return True if the event has changed since it was last synced.

    An event is considered stale (needs update) when:
      - It has never been synced (last_synced_at is None), OR
      - Its updated_at timestamp is newer than last_synced_at.

    This is an optimisation guard: if the DB row hasn't changed we skip the
    GCal API round-trip entirely and count the event as skipped.
    """
    last_synced_at: datetime | None = event.get("last_synced_at")
    if last_synced_at is None:
        # No mapping row yet — should be a create, not handled here.
        return True

    updated_at: datetime | None = event.get("updated_at")
    if updated_at is None:
        # No updated_at recorded; be conservative and treat as stale.
        return True

    # Normalise both timestamps to UTC-aware for safe comparison.
    def _utc(dt: datetime) -> datetime:
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)

    return _utc(updated_at) > _utc(last_synced_at)


def _handle_create(
    gcal: GoogleCalendarService,
    user_id: int,
    event: dict,
) -> None:
    created = gcal.create_event(event)
    google_event_id: str = created["id"]

    repository.insert_calendar_mapping(user_id, event["id"], google_event_id)

    # 👇 thêm dòng này
    repository.update_calendar_mapping_sync_time(user_id, event["id"])

def _handle_update(
    gcal: GoogleCalendarService,
    user_id: int,
    event: dict,
) -> None:
    """Update an existing GCal event and refresh last_synced_at."""
    google_event_id: str = event["google_event_id"]
    gcal.update_event(google_event_id, event)
    repository.update_calendar_mapping_sync_time(user_id, event["id"])
    logger.debug(
        "Updated GCal event '%s' (google_event_id=%s) for user %d.",
        event.get("course_name"), google_event_id, user_id,
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def run_sync(user_id: int, gcal=None):
    """
    Synchronise timetable events for *user_id* to Google Calendar.

    Algorithm
    ---------
    1. Open a sync_runs audit record (status=PENDING).
    2. Fetch every event row together with its calendar_mapping status.
    3. For each event:
       a. No google_event_id  → create in GCal, insert mapping row.
       b. google_event_id exists but event is stale → update in GCal.
       c. google_event_id exists and event is up-to-date → skip.
    4. Close the sync_runs record (status=SUCCESS or FAILED).
    5. Return a SyncSummary dict.

    Args:
        user_id: Primary key of the user whose calendar is being synced.

    Returns:
        SyncSummary with keys: created_events, updated_events, skipped_events.

    Raises:
        Re-raises any unexpected exception after marking the run as FAILED.
    """
    run_id: int = repository.create_sync_run(user_id)
    logger.info("Sync run %d started for user %d.", run_id, user_id)

    created = updated = skipped = 0
    wall_start = time.monotonic()

    try:
        if gcal is None:
            gcal = GoogleCalendarService()
        events: list[dict] = repository.get_events_with_mapping(user_id)

        for event in events:
            google_event_id: str | None = event.get("google_event_id")

            if google_event_id is None:
                # ── CREATE ──────────────────────────────────────────────────
                _handle_create(gcal, user_id, event)
                created += 1

            elif _is_stale(event):
                # ── UPDATE ──────────────────────────────────────────────────
                _handle_update(gcal, user_id, event)
                updated += 1

            else:
                # ── SKIP ────────────────────────────────────────────────────
                logger.debug(
                    "Skipping unchanged event '%s' (id=%d) for user %d.",
                    event.get("course_name"), event["id"], user_id,
                )
                skipped += 1

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
            run_id, run_time, created, updated, skipped,
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
        logger.exception(
            "Sync run %d FAILED after %.2fs (created=%d, updated=%d, skipped=%d).",
            run_id, run_time, created, updated, skipped,
        )
        raise

    return SyncSummary(
        created_events=created,
        updated_events=updated,
        skipped_events=skipped,
    )