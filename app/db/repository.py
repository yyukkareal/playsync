"""
repository.py — PlaySync Database Repository Layer

Responsibilities:
  - Execute parameterized SQL queries against PostgreSQL.
  - Return plain dicts to the service layer (no ORM objects).
  - No business logic; no Google API awareness.

Connection management:
  Assumes a module-level `get_connection()` helper exported from
  app.db.connection. Each function acquires a connection, executes its
  query, and releases the connection back to the pool.
"""

import logging
from typing import Any

import psycopg
from psycopg.rows import dict_row

from app.db.connection import get_connection

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _execute(
    sql: str,
    params: dict[str, Any] | None = None,
    *,
    fetch: str = "none",   # "none" | "one" | "all"
    commit: bool = False,
) -> Any:
    """
    Execute a parameterised query and return results as dict(s).

    Args:
        sql:    Parameterised SQL string (%(name)s style).
        params: Mapping of parameter names to values.
        fetch:  "none"  → return None
                "one"   → return a single dict or None
                "all"   → return a list of dicts
        commit: If True, commit after execution (for writes).

    Returns:
        None | dict | list[dict] depending on *fetch*.
    """
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(sql, params)

            if commit:
                conn.commit()

            if fetch == "one":
                row = cur.fetchone()
                return dict(row) if row else None
            if fetch == "all":
                return [dict(row) for row in cur.fetchall()]
            return None


# ---------------------------------------------------------------------------
# Events + calendar_mappings
# ---------------------------------------------------------------------------

def get_events_with_mapping(user_id: int) -> list[dict]:
    """
    Return all events LEFT-JOINed with calendar_mappings for *user_id*.

    Rows with no mapping yet will have google_event_id=None and
    last_synced_at=None — the service layer treats these as "needs create".

    Args:
        user_id: The user whose calendar is being synced.

    Returns:
        List of event dicts, each containing every events column plus
        google_event_id and last_synced_at from calendar_mappings.
    """
    sql = """
        SELECT
            e.*,
            m.google_event_id,
            m.last_synced_at
        FROM app.events e
        LEFT JOIN app.calendar_mappings m
            ON  e.id      = m.event_id
            AND m.user_id = %(user_id)s
    """
    rows: list[dict] = _execute(sql, {"user_id": user_id}, fetch="all")
    logger.debug(
        "get_events_with_mapping: fetched %d event(s) for user %d.",
        len(rows), user_id,
    )
    return rows


def insert_calendar_mapping(
    user_id: int,
    event_id: int,
    google_event_id: str,
) -> None:
    """
    Persist a new calendar_mappings row after a GCal event is created.

    Args:
        user_id:         Owner of the mapping.
        event_id:        FK to app.events.id.
        google_event_id: Opaque GCal event ID returned by the API.
    """
    sql = """
        INSERT INTO app.calendar_mappings
            (user_id, event_id, google_event_id, created_at)
        VALUES
            (%(user_id)s, %(event_id)s, %(google_event_id)s, NOW())
    """
    _execute(
        sql,
        {"user_id": user_id, "event_id": event_id, "google_event_id": google_event_id},
        commit=True,
    )
    logger.debug(
        "insert_calendar_mapping: user=%d event=%d gcal=%s",
        user_id, event_id, google_event_id,
    )


def update_calendar_mapping_sync_time(user_id: int, event_id: int) -> None:
    """
    Stamp last_synced_at = NOW() after a GCal event is successfully updated.

    Args:
        user_id:  Owner of the mapping.
        event_id: FK to app.events.id.
    """
    sql = """
        UPDATE app.calendar_mappings
        SET    last_synced_at = NOW()
        WHERE  user_id  = %(user_id)s
          AND  event_id = %(event_id)s
    """
    _execute(sql, {"user_id": user_id, "event_id": event_id}, commit=True)
    logger.debug(
        "update_calendar_mapping_sync_time: user=%d event=%d",
        user_id, event_id,
    )


# ---------------------------------------------------------------------------
# sync_runs audit log
# ---------------------------------------------------------------------------

def create_sync_run(user_id: int) -> int:
    """
    Open a new sync_runs audit record with status='PENDING'.

    Args:
        user_id: The user for whom the sync is being started.

    Returns:
        The auto-generated run_id (sync_runs.id).

    Raises:
        RuntimeError: If the INSERT does not return a row (should never happen).
    """
    sql = """
        INSERT INTO app.sync_runs (user_id, status, started_at)
        VALUES (%(user_id)s, 'PENDING', NOW())
        RETURNING id
    """
    row: dict | None = _execute(sql, {"user_id": user_id}, fetch="one", commit=True)
    if row is None:
        raise RuntimeError(
            f"create_sync_run: INSERT did not return a run_id for user {user_id}."
        )
    run_id: int = row["id"]
    logger.debug("create_sync_run: opened run_id=%d for user=%d.", run_id, user_id)
    return run_id


def finish_sync_run(
    run_id: int,
    status: str,
    created: int,
    updated: int,
    skipped: int,
) -> None:
    """
    Close a sync_runs record with final counts and a terminal status.

    Args:
        run_id:  The sync_runs.id returned by create_sync_run.
        status:  Terminal status string — 'SUCCESS' or 'FAILED'.
        created: Number of GCal events created during this run.
        updated: Number of GCal events updated during this run.
        skipped: Number of events skipped (no change detected).
    """
    sql = """
        UPDATE app.sync_runs
        SET
            status         = %(status)s,
            created_events = %(created)s,
            updated_events = %(updated)s,
            skipped_events = %(skipped)s,
            finished_at    = NOW()
        WHERE id = %(run_id)s
    """
    _execute(
        sql,
        {
            "run_id":  run_id,
            "status":  status,
            "created": created,
            "updated": updated,
            "skipped": skipped,
        },
        commit=True,
    )
    logger.debug(
        "finish_sync_run: run_id=%d status=%s (created=%d updated=%d skipped=%d).",
        run_id, status, created, updated, skipped,
    )

# ---------------------------------------------------------------------------
# Events queries
# ---------------------------------------------------------------------------

def get_all_events(course_code: str | None = None) -> list[dict]:
    """
    Return events from app.events, optionally filtered by course_code.

    Args:
        course_code: If provided, only return events matching this code (case-insensitive).

    Returns:
        List of event dicts.
    """
    if course_code:
        sql = "SELECT * FROM app.events WHERE LOWER(course_code) = LOWER(%(course_code)s) ORDER BY start_date, weekday, start_time"
        rows = _execute(sql, {"course_code": course_code}, fetch="all")
    else:
        sql = "SELECT * FROM app.events ORDER BY start_date, weekday, start_time"
        rows = _execute(sql, fetch="all")
    logger.debug("get_all_events: returned %d row(s).", len(rows))
    return rows


# ---------------------------------------------------------------------------
# User course selection
# ---------------------------------------------------------------------------

def get_user_courses(user_id: int) -> list[dict]:
    """
    Return the list of course_codes selected by user_id.

    Args:
        user_id: Target user.

    Returns:
        List of dicts with keys: id, user_id, course_code, created_at.
    """
    sql = """
        SELECT id, user_id, course_code, created_at
        FROM app.user_courses
        WHERE user_id = %(user_id)s
        ORDER BY course_code
    """
    rows = _execute(sql, {"user_id": user_id}, fetch="all")
    logger.debug("get_user_courses: user=%d has %d course(s).", user_id, len(rows))
    return rows


def set_user_courses(user_id: int, course_codes: list[str]) -> None:
    """
    Replace the full course selection for user_id (delete-then-insert).

    Args:
        user_id:      Target user.
        course_codes: New set of course codes. Pass [] to clear all.
    """
    delete_sql = "DELETE FROM app.user_courses WHERE user_id = %(user_id)s"
    _execute(delete_sql, {"user_id": user_id}, commit=True)

    if course_codes:
        insert_sql = """
            INSERT INTO app.user_courses (user_id, course_code, created_at)
            VALUES (%(user_id)s, %(course_code)s, NOW())
            ON CONFLICT (user_id, course_code) DO NOTHING
        """
        for code in course_codes:
            _execute(insert_sql, {"user_id": user_id, "course_code": code}, commit=True)

    logger.info("set_user_courses: user=%d → %d course(s) saved.", user_id, len(course_codes))


def get_events_with_mapping_filtered(user_id: int) -> list[dict]:
    """
    Like get_events_with_mapping but scoped to user's selected courses.

    If the user has no courses saved, falls back to all events
    (same behaviour as original get_events_with_mapping).

    Args:
        user_id: The user whose calendar is being synced.

    Returns:
        List of event dicts joined with calendar_mappings for user_id.
    """
    sql = """
        SELECT
            e.*,
            m.google_event_id,
            m.last_synced_at
        FROM app.events e
        JOIN app.user_courses uc
            ON  LOWER(e.course_code) = LOWER(uc.course_code)
            AND uc.user_id = %(user_id)s
        LEFT JOIN app.calendar_mappings m
            ON  e.id      = m.event_id
            AND m.user_id = %(user_id)s
    """
    rows = _execute(sql, {"user_id": user_id}, fetch="all")
    logger.debug(
        "get_events_with_mapping_filtered: fetched %d event(s) for user %d.",
        len(rows), user_id,
    )
    return rows