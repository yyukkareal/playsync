"""
app/api/main.py
FastAPI entrypoint for PlaySync.

All database access is delegated to app.db.repository.
All parsing is delegated to app.parser.tmu_parser.
All calendar sync is delegated to app.services.google_calendar.
"""

from fastapi import FastAPI, HTTPException, Query

from app.db.repository import count_events, get_engine, get_events, upsert_events
from app.parser.tmu_parser import parse_events
from app.services.google_calendar import GoogleCalendarService

# ---------------------------------------------------------------------------
# Application
# ---------------------------------------------------------------------------

app = FastAPI(
    title="PlaySync API",
    description="Sync TMU timetable to Google Calendar",
    version="1.0.0",
)

# A single engine is created once at startup and reused across requests.
_engine = get_engine()


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@app.get("/", tags=["meta"], summary="Service info")
def root() -> dict:
    """Return basic service information."""
    return {"service": "PlaySync", "status": "running"}


@app.get("/health", tags=["meta"], summary="Health check")
def health() -> dict:
    """Lightweight liveness probe — returns 200 when the service is up."""
    return {"status": "ok"}


@app.get("/events", tags=["timetable"], summary="List timetable events")
def list_events(
    limit: int = Query(default=100, ge=1, le=1000, description="Maximum rows to return"),
    offset: int = Query(default=0, ge=0, description="Number of rows to skip"),
) -> list[dict]:
    """
    Return timetable events stored in the database.

    Supports pagination via **limit** and **offset**.
    """
    return get_events(_engine, limit=limit, offset=offset)


@app.get("/stats", tags=["timetable"], summary="Database statistics")
def stats() -> dict:
    """Return aggregate statistics about the stored timetable data."""
    total = count_events(_engine)
    return {"events": total}


@app.post("/ingest", tags=["timetable"], summary="Ingest timetable from Excel")
def ingest() -> dict:
    """
    Parse **timetable.xlsx** and upsert events into the database.

    - Duplicate events (matched by fingerprint) are silently skipped.
    - Returns the number of events parsed and the number actually inserted.
    """
    try:
        events = parse_events("timetable.xlsx")
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Parse error: {exc}") from exc

    try:
        inserted = upsert_events(_engine, events)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Database error: {exc}") from exc

    return {"parsed": len(events), "inserted": inserted}


@app.post("/sync", tags=["calendar"], summary="Sync events to Google Calendar")
def sync(
    limit: int = Query(
        default=1000,
        ge=1,
        le=5000,
        description="Maximum number of events to sync in one call",
    ),
) -> dict:
    """
    Push timetable events from the database to Google Calendar.

    Events are fetched in a single batch (controlled by **limit**) and
    created via the GoogleCalendarService. Existing calendar events are
    not de-duplicated here — that responsibility belongs to the service layer.
    """
    events = get_events(_engine, limit=limit, offset=0)

    if not events:
        return {"synced_events": 0}

    try:
        service = GoogleCalendarService()
        synced = service.create_events(events)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Calendar sync error: {exc}") from exc

    return {"synced_events": synced}