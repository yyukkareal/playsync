import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

from fastapi import FastAPI
from app.api.routes.sync import router as sync_router
from app.api.routes.events import router as events_router
from app.api.routes.users import router as users_router
from app.api.auth import router as auth_router

app = FastAPI(
    title="PlaySync",
    description="Sync TMU university timetable to Google Calendar.",
    version="0.1.0",
)

app.include_router(auth_router)
app.include_router(sync_router)
app.include_router(events_router)
app.include_router(users_router)


@app.get("/health", tags=["infra"])
def health():
    return {"status": "ok"}