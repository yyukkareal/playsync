"""
app/db/repository.py
Database access layer for PlaySync timetable events.
All database interaction is isolated here — the API layer must not execute raw SQL.
"""

import os
from typing import Any

import sqlalchemy as sa
from sqlalchemy import create_engine
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.db.models import Event


# ---------------------------------------------------------------------------
# Engine
# ---------------------------------------------------------------------------

def get_engine() -> Engine:
    """Create and return a SQLAlchemy engine using the DATABASE_URL env var."""
    database_url = os.environ["DATABASE_URL"]
    return create_engine(database_url, pool_pre_ping=True)


# ---------------------------------------------------------------------------
# Read
# ---------------------------------------------------------------------------

def get_events(
    engine: Engine,
    limit: int = 100,
    offset: int = 0,
) -> list[dict[str, Any]]:
    """
    Return timetable events from the database.

    Rows are ordered by id; pagination is controlled by *limit* and *offset*.
    Returns a list of JSON-serialisable dictionaries.
    """
    with Session(engine) as session:
        rows = (
            session.query(Event)
            .order_by(Event.id)
            .limit(limit)
            .offset(offset)
            .all()
        )
        return [_event_to_dict(row) for row in rows]


def count_events(engine: Engine) -> int:
    """Return the total number of events stored in the database."""
    with Session(engine) as session:
        return session.query(sa.func.count(Event.id)).scalar()


# ---------------------------------------------------------------------------
# Write
# ---------------------------------------------------------------------------

def upsert_events(engine: Engine, events: list) -> int:
    """
    Insert AcademicEvent objects parsed from the Excel timetable into
    app.events.

    Uses ON CONFLICT (fingerprint) DO NOTHING so that re-running the
    importer is fully idempotent — duplicate rows are silently skipped.

    Returns the number of rows actually inserted.
    """
    if not events:
        return 0

    rows = [_academic_event_to_row(e) for e in events]

    stmt = (
        pg_insert(Event.__table__)
        .values(rows)
        .on_conflict_do_nothing(index_elements=["fingerprint"])
    )

    with engine.begin() as conn:
        result = conn.execute(stmt)
        return result.rowcount


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------

def _event_to_dict(event: Event) -> dict[str, Any]:
    """Serialise an Event ORM instance to a plain dictionary."""
    return {
        "id":          event.id,
        "course_code": event.course_code,
        "course_name": event.course_name,
        "weekday":     event.weekday,
        "start_time":  str(event.start_time) if event.start_time else None,
        "end_time":    str(event.end_time)   if event.end_time   else None,
        "room":        event.room,
        "start_date":  event.start_date.isoformat() if event.start_date else None,
        "end_date":    event.end_date.isoformat()   if event.end_date   else None,
        "fingerprint": event.fingerprint,
        "instructor":  event.instructor,
        "duration":    event.duration,
    }


def _academic_event_to_row(event) -> dict[str, Any]:
    """
    Convert an AcademicEvent (parser domain object) into a flat dictionary
    whose keys match exactly the columns in app.events.
    """
    return {
        "course_code": event.course_code,
        "course_name": event.course_name,
        "weekday":     event.weekday,
        "start_time":  event.start_time,
        "end_time":    event.end_time,
        "room":        event.room,
        "start_date":  event.start_date,
        "end_date":    event.end_date,
        "fingerprint": event.fingerprint,
        "instructor":  getattr(event, "instructor", None),
        "duration":    getattr(event, "duration",   None),
    }