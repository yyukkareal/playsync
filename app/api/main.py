import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

from fastapi import FastAPI
from app.api.routes.sync import router as sync_router

app = FastAPI(
    title="PlaySync",
    description="Sync TMU university timetable to Google Calendar.",
    version="0.1.0",
)

app.include_router(sync_router)


@app.get("/health", tags=["infra"])
def health():
    return {"status": "ok"}