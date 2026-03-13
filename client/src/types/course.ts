// src/types/course.ts
export interface Schedule {
  weekday: number;
  start_time: string;
  end_time: string;
  room: string;
}

// Course as returned by /api/courses/search
export interface Course {
  course_code: string;
  course_name: string;
  schedules?: Schedule[];
}

// User's selected course, as returned by /api/users/me/courses
export interface SelectedCourse {
  code: string;
  name: string;
}

// Full timetable event, matching EventOut in backend
export interface Event {
  id: number;
  course_code: string;
  course_name: string;
  weekday: number;
  start_time: string;
  end_time: string;
  room: string;
  start_date: string;
  end_date: string;
  instructor?: string | null;
  duration?: number | null;
  fingerprint: string;
}

export interface SyncResult {
  created_events: number;
  updated_events: number;
  skipped_events: number;
}