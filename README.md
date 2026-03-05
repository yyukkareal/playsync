# PlaySync

PlaySync is a lightweight tool that automatically syncs university timetables to **Google Calendar**.

Instead of manually entering every class, students can simply select their courses and let PlaySync generate the recurring calendar events.

The current MVP targets **Thuongmai University (TMU)**.

---

# Features

* Google OAuth login
* Select courses from university timetable
* Automatic Google Calendar sync
* Idempotent sync (no duplicate events)
* Update detection when timetable changes

---

# How it Works

1. User logs in with Google
2. User selects their courses
3. PlaySync generates recurring calendar events
4. Events are synced to the user's Google Calendar

Architecture overview:

User
↓
Google OAuth
↓
PlaySync Backend (FastAPI)
↓
PostgreSQL
↓
Google Calendar API

---

# Tech Stack

Backend:

* FastAPI
* PostgreSQL
* Google Calendar API
* Google OAuth (OpenID)

Other tools:

* Python
* psycopg
* dotenv

---

# Project Structure

```
app/
  api/
  db/
  parser/
  services/

scripts/
requirements.txt
README.md
```

Key modules:

* `parser/` — Parses university timetable files
* `db/` — Database models and repository layer
* `services/` — Google Calendar integration and sync logic
* `api/` — FastAPI routes

---

# Setup

Clone the repository:

```
git clone https://github.com/yyukkareal/playsync.git
cd playsync
```

Create virtual environment:

```
python -m venv venv
source venv/bin/activate
```

Install dependencies:

```
pip install -r requirements.txt
```

---

# Environment Variables

Create `.env` file:

```
DATABASE_URL=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://127.0.0.1:8000/auth/google/callback
TIMEZONE=Asia/Ho_Chi_Minh
```

---

# Run Server

```
PYTHONPATH=. uvicorn app.api.main:app --reload
```

Server runs at:

```
http://127.0.0.1:8000
```

API docs:

```
http://127.0.0.1:8000/docs
```

---

# API Overview

Login with Google:

```
GET /auth/google/login
```

Get user courses:

```
GET /api/users/{user_id}/courses
```

Set user courses:

```
POST /api/users/{user_id}/courses
```

Sync timetable:

```
POST /api/sync/{user_id}
```

Health check:

```
GET /health
```

---

# Database Overview

Core tables:

```
users
events
user_courses
calendar_mappings
sync_runs
```

Events are preloaded from the university timetable.

Users only select courses relevant to them.

---

# MVP Scope

Current MVP supports:

* Thuongmai University (TMU)
* Manual timetable ingestion by admin

Future roadmap:

* Multi-university support
* Course auto-detection
* Better UI
* Calendar preview before sync

---

# License

MIT License
