# PlaySync Deployment Guide

This guide describes how to deploy the PlaySync application to production.

## 1. Prerequisites
- [Railway](https://railway.app/) account for Backend and Database.
- [Vercel](https://vercel.com/) account for Frontend.
- [Google Cloud Console](https://console.cloud.google.com/) for OAuth 2.0 credentials.

---

## 2. Google OAuth Configuration
1. Go to **APIs & Services > Credentials**.
2. Create an **OAuth 2.0 Client ID**.
3. Add **Authorized Redirect URIs**:
   - `https://your-backend-on-railway.app/auth/google/callback`
   - `http://localhost:8000/auth/google/callback` (for dev)

---

## 3. Database & Backend (Railway)

### A. Create PostgreSQL Database
1. Create a new project on Railway.
2. Select **Provision PostgreSQL**.
3. Copy the `DATABASE_URL` from the **Variables** tab.

### B. Deploy Backend
1. Connect your GitHub repository to a new Railway service.
2. Railway will automatically detect the `Dockerfile`.
3. Set the following environment variables in Railway:
   - `DATABASE_URL`: (provided by Railway)
   - `GOOGLE_CLIENT_ID`: Your Google OAuth Client ID.
   - `GOOGLE_CLIENT_SECRET`: Your Google OAuth Client Secret.
   - `GOOGLE_REDIRECT_URI`: `https://your-backend-on-railway.app/auth/google/callback`
   - `FRONTEND_URL`: `https://your-frontend-on-vercel.app`
   - `PYTHONUNBUFFERED`: `1`

### C. Run Migrations
Run the initial schema in the Railway database using the SQL files in the `migrations/` folder. You can use the Railway SQL editor or any DB client.

---

## 4. Frontend (Vercel)

1. Connect your GitHub repository to Vercel.
2. Set the **Root Directory** to `client/`.
3. Set the following environment variables in Vercel:
   - `NEXT_PUBLIC_API_URL`: `https://your-backend-on-railway.app`
4. Click **Deploy**.

---

## 5. Connecting Services
Once both services are up, ensure:
1. `FRONTEND_URL` in Railway matches the Vercel URL.
2. `GOOGLE_REDIRECT_URI` in Google Console matches the Railway backend URL.
3. `NEXT_PUBLIC_API_URL` in Vercel matches the Railway backend URL.
