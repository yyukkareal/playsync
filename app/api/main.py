# app/api/main.py
import logging

from dotenv import load_dotenv
load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes.sync import router as sync_router
from app.api.routes.events import router as events_router
from app.api.routes.users import router as users_router
from app.api.auth import router as auth_router

app = FastAPI(
    title="PlaySync",
    description="Sync TMU university timetable to Google Calendar.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(sync_router)
app.include_router(events_router)
app.include_router(users_router)


@app.get("/health", tags=["infra"])
def health():
    return {"status": "ok"}