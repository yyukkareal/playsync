# PlaySync Production Deployment Checklist

## 1. Backend (FastAPI on Railway)
- [ ] Set `DATABASE_URL` (Railway Postgres).
- [ ] Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
- [ ] Set `GOOGLE_REDIRECT_URI` to backend callback URL.
- [ ] Set `FRONTEND_URL` for redirect and CORS (Vercel URL).
- [ ] Verify `requirements.txt` is complete.
- [ ] Fix hardcoded CORS in `app/api/main.py` to use `FRONTEND_URL`.
- [ ] Confirm uvicorn command: `uvicorn app.api.main:app --host 0.0.0.0 --port $PORT`.

## 2. Database (Postgres on Railway)
- [ ] Run `.sql` migrations in `migrations/` folder.
- [ ] Verify database connectivity from backend.

## 3. Frontend (Next.js on Vercel)
- [ ] Set `NEXT_PUBLIC_API_URL` to backend Railway URL.
- [ ] Verify `npm run build` succeeds locally.
- [ ] Ensure `Root Directory` is set to `client/` in Vercel settings.

## 4. Google OAuth
- [ ] Update **Authorized Redirect URIs** in Google Console.
- [ ] Set **User Type** to External (Production).
- [ ] Complete OAuth Consent Screen branding (for prod).

## 5. Security & Maintenance
- [ ] Remove `sqlalchemy` from `requirements.txt` (not used).
- [ ] Replace `app/db/models.py` content with actual models or remove if redundant.
- [ ] Check for hardcoded secrets or sensitive credentials.
