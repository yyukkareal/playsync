-- Migration: add app.user_courses
-- Database: tmu_timetable_db
-- Run once: psql -d tmu_timetable_db -f migrations/add_user_courses.sql

CREATE TABLE IF NOT EXISTS app.user_courses (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL,
    course_code TEXT    NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (user_id, course_code)
);


CREATE INDEX IF NOT EXISTS idx_user_courses_user_id
    ON app.user_courses (user_id);