# app/api/main.py

from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel
from typing import Any

from app.services.sync_service import run_sync
from app.db import repository

app = FastAPI(
    title="PlaySync API",
    description="Minimal FastAPI entrypoint for the PlaySync backend.",
    version="1.0.0"
)


class SyncResponse(BaseModel):
    """
    Pydantic model representing the result of a synchronization run.
    """
    created_events: int
    updated_events: int
    skipped_events: int


@app.get("/", response_model=dict[str, str])
async def root() -> dict[str, str]:
    """
    Return basic service information.

    Returns:
        dict[str, str]: Service name and its current status.
    """
    return {
        "service": "PlaySync",
        "status": "running"
    }


@app.get("/health", response_model=dict[str, str])
async def health_check() -> dict[str, str]:
    """
    Health check endpoint used by uptime monitors.

    Returns:
        dict[str, str]: A simple dictionary confirming the API is operational.
    """
    return {
        "status": "ok"
    }


@app.get("/events", response_model=list[dict[str, Any]])
async def get_events(
    limit: int = Query(100, description="Maximum rows returned"),
    offset: int = Query(0, description="Pagination offset")
) -> list[dict[str, Any]]:
    """
    Return timetable events stored in PostgreSQL.

    Args:
        limit (int): Maximum number of records to return. Defaults to 100.
        offset (int): Number of records to skip for pagination. Defaults to 0.

    Returns:
        list[dict[str, Any]]: A list of event records from the database.

    Raises:
        HTTPException: If the database repository fails to fetch events.
    """
    try:
        events = repository.get_events(limit=limit, offset=offset)
        return events
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch events: {str(e)}")


@app.get("/stats", response_model=dict[str, int])
async def get_stats() -> dict[str, int]:
    """
    Return high-level database statistics.

    Returns:
        dict[str, int]: Aggregated statistics such as total events and mappings.

    Raises:
        HTTPException: If the database repository fails to fetch statistics.
    """
    try:
        # Assuming repository functions based on the implementation description
        events_count = repository.count_events()
        mappings_count = repository.count_mappings()
        return {
            "total_events": events_count,
            "total_mappings": mappings_count
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch stats: {str(e)}")


@app.post("/sync/{user_id}", response_model=SyncResponse)
async def trigger_sync(user_id: str) -> SyncResponse:
    """
    Trigger timetable synchronization for a specific user.

    Args:
        user_id (str): The unique identifier of the user to sync.

    Returns:
        SyncResponse: A summary of the synchronization outcome (created, updated, and skipped events).

    Raises:
        HTTPException: If the synchronization process fails.
    """
    try:
        result = run_sync(user_id)
        # Ensuring the service returns a dict compatible with the Pydantic model
        return SyncResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sync failed for user {user_id}: {str(e)}")