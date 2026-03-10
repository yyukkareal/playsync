-- Migration: add full_name column to app.users
ALTER TABLE app.users
    ADD COLUMN IF NOT EXISTS full_name TEXT;
