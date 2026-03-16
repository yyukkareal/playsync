'use client';

import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { clearToken, fetchAPI } from '@/lib/api';
import { useCourses } from '@/hooks/useCourses';
import { SearchBox } from '@/components/courses/SearchBox';
import type { Course, SelectedCourse } from '@/types/course';
import { isAppleDevice } from '@/lib/device';

function getDisplayName(): string {
  if (typeof window === 'undefined') return '';
  try {
    const token = localStorage.getItem('playsync_token');
    if (!token) return '';
    const payload = JSON.parse(atob(token.split('.')[1]));
    const name: string = payload.name ?? '';
    const email: string = payload.email ?? '';
    // Use name only if it looks like a real name (not an email address)
    if (name && !name.includes('@')) {
      return name;
    }
    // Fallback to email prefix
    return email.split('@')[0];
  } catch {
    return '';
  }
}

const COURSE_COLORS = [
  'bg-blue-100 text-blue-800',
  'bg-green-100 text-green-800',
  'bg-amber-100 text-amber-800',
  'bg-pink-100 text-pink-800',
  'bg-violet-100 text-violet-800',
];

const WEEKDAY_LABEL: Record<string, string> = {
  '2': 'T2',
  '3': 'T3',
  '4': 'T4',
  '5': 'T5',
  '6': 'T6',
  '7': 'T7',
  '8': 'CN',
};

const DAY_ORDER = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

function SyncSuccessView({
  courses,
  syncResult,
  scheduledCourses,
  isApple,
  onAddMore,
}: {
  courses: SelectedCourse[];
  syncResult: { created: number; updated: number };
  scheduledCourses: Array<{
    name: string;
    weekday: string;
    start_time: string;
    end_time: string;
  }>;
  isApple: boolean;
  onAddMore: () => void;
}) {
  const colorMap = Object.fromEntries(
    courses.map((c, i) => [c.name, COURSE_COLORS[i % COURSE_COLORS.length]]),
  );

  const grouped = scheduledCourses.reduce<
    Record<string, typeof scheduledCourses>
  >((acc, e) => {
    if (!acc[e.weekday]) acc[e.weekday] = [];
    acc[e.weekday].push(e);
    return acc;
  }, {});
  const sortedDays = DAY_ORDER.filter((d) => grouped[d]);

  return (
    <div className="space-y-6">
      <div
        className="flex items-center gap-3 rounded-xl bg-green-50 p-4"
        style={{ animation: 'springIn 0.45s cubic-bezier(0.34,1.56,0.64,1) both' }}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#166534"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div>
          <div className="text-sm font-medium text-green-800">
            Lịch đã đồng bộ
          </div>
          <div className="text-xs text-green-700 opacity-80">
            {syncResult.created} sự kiện mới · {syncResult.updated} cập nhật
          </div>
        </div>
      </div>

      {sortedDays.length > 0 ? (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Lịch học của bạn
          </p>
          {sortedDays.map((day, index) => (
            <div
              key={day}
              className="flex gap-3"
              style={{
                animation: 'springIn 0.45s cubic-bezier(0.34,1.56,0.64,1) both',
                animationDelay: `${index * 0.08}s`,
              }}
            >
              <div className="w-6 shrink-0 pt-0.5 text-xs font-medium text-slate-400">
                {day}
              </div>
              <div className="flex flex-1 flex-col gap-1.5">
                {grouped[day]
                  .sort((a, b) => a.start_time.localeCompare(b.start_time))
                  .map((e, i) => (
                    <div
                      key={i}
                      className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium ${
                        colorMap[e.name] ?? 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      <span>{e.name}</span>
                      <span className="opacity-75">
                        {e.start_time}–{e.end_time}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="space-y-2">
        <button
          type="button"
          onClick={() => {
            if (isApple) {
              window.location.href = 'calshow://';
            } else {
              window.open('https://calendar.google.com', '_blank');
            }
          }}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 text-sm font-medium text-white hover:bg-slate-800"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <rect x="1" y="3" width="14" height="12" rx="2" />
            <line x1="5" y1="1" x2="5" y2="5" />
            <line x1="11" y1="1" x2="11" y2="5" />
            <line x1="1" y1="7" x2="15" y2="7" />
          </svg>
          {isApple ? 'Mở Apple Calendar' : 'Mở Google Calendar'}
        </button>
        <button
          type="button"
          onClick={onAddMore}
          className="h-10 w-full rounded-xl border border-slate-200 text-sm text-slate-500 hover:bg-slate-50"
        >
          Thêm môn khác
        </button>
      </div>
    </div>
  );
}

export default function CoursesDashboardPage() {
  if (process.env.NODE_ENV !== 'production') {
    console.count('[render] CoursesDashboardPage');
  }

  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [isApple, setIsApple] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [addingCode, setAddingCode] = useState<string | null>(null);
  const [removingCode, setRemovingCode] = useState<string | null>(null);
  const [ripples, setRipples] = useState<Array<{ id: number; x: number; y: number }>>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    created: number;
    updated: number;
  } | null>(null);
  const [scheduledCourses, setScheduledCourses] = useState<
    Array<{
      name: string;
      weekday: string;
      start_time: string;
      end_time: string;
    }>
  >([]);
  const [courseSchedules, setCourseSchedules] = useState<Map<string, Course>>(
    new Map(),
  );

  const { courses, loading, addCourse, removeCourse } = useCourses();

  const selectedCourseCodes = useMemo(
    () => new Set(courses.map((c) => c.code)),
    [courses],
  );

  // Simple auth guard based on presence of token in storage
  useEffect(() => {
    setMounted(true);
    setIsApple(isAppleDevice());
    setDisplayName(getDisplayName());
    const token = typeof window !== 'undefined'
      ? localStorage.getItem('playsync_token')
      : null;
    if (!token) {
      router.replace('/');
    }
  }, [router]);

  const handleSelect = async (course: Course) => {
    setAddingCode(course.course_code);
    const result = await addCourse(course.course_code, course.course_name);
    if (result.success) {
      setCourseSchedules((prev) => new Map(prev).set(course.course_code, course));
    } else {
      toast.error(result.message || 'Có lỗi xảy ra khi thêm môn học.');
    }
    setAddingCode(null);
  };

  const handleRemove = async (code: string) => {
    setRemovingCode(code);
    await new Promise((r) => setTimeout(r, 200));
    await removeCourse(code);
    setRemovingCode(null);
  };

  const handleSync = async () => {
    if (courses.length === 0) return;

    const userId =
      typeof window !== 'undefined'
        ? localStorage.getItem('user_id')
        : null;
    if (!userId) return;

    setIsSyncing(true);
    try {
      const res = await fetchAPI(
        `/api/sync/${encodeURIComponent(userId)}`,
        {
          method: 'POST',
        },
      );

      if (!res.ok) throw new Error('Đồng bộ thất bại');

      const data = await res.json();
      setSyncResult({
        created: data.created_events,
        updated: data.updated_events,
      });
      // Fetch schedules for all selected courses in parallel
      const scheduleResults = await Promise.all(
        courses.map(async (c) => {
          // Check local cache first
          const cached = courseSchedules.get(c.code);
          if (cached?.schedules?.length) {
            return { course: c, schedules: cached.schedules };
          }

          // Fallback: search by course code to get schedules
          try {
            const res = await fetchAPI(
              `/api/courses/search?q=${encodeURIComponent(c.code)}`
            );
            if (!res.ok) return { course: c, schedules: [] };
            const data = await res.json();
            const source = data.results ?? data;
            const match = (Array.isArray(source) ? source : []).find(
              (r: Course) => r.course_code === c.code,
            );
            return { course: c, schedules: match?.schedules ?? [] };
          } catch {
            return { course: c, schedules: [] };
          }
        }),
      );

      const built = scheduleResults.flatMap(({ course, schedules }) =>
        schedules.map((s) => ({
          name: course.name,
          weekday: WEEKDAY_LABEL[String(s.weekday)] ?? '?',
          start_time: s.start_time.slice(0, 5),
          end_time: s.end_time.slice(0, 5),
        })),
      );
      setScheduledCourses(built);
      toast.success(
        `Đồng bộ thành công — ${data.created_events} sự kiện mới, ${data.updated_events} cập nhật`,
      );
    } catch {
      toast.error('Không thể kết nối với máy chủ để đồng bộ.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLogout = () => {
    clearToken();
    try {
      localStorage.removeItem('user_id');
    } catch {
      // ignore
    }
    router.push('/');
  };

  const handleExportIcs = async () => {
    const userId = typeof window !== 'undefined'
      ? localStorage.getItem('user_id')
      : null;
    if (!userId) return;

    setIsSyncing(true);
    try {
      const res = await fetchAPI(
        `/api/ics/${encodeURIComponent(userId)}`
      );
      if (!res.ok) throw new Error('Export thất bại');

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'playsync.ics';
      a.click();
      URL.revokeObjectURL(url);

      setSyncResult({ created: 0, updated: 0 });
    } catch {
      toast.error('Không thể xuất lịch.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleButtonClick = (
    e: React.MouseEvent<HTMLButtonElement>,
    action: () => void,
  ) => {
    if (e.currentTarget.disabled) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const id = Date.now();
    setRipples((prev) => [...prev, { id, x: e.clientX - rect.left, y: e.clientY - rect.top }]);
    setTimeout(() => setRipples((prev) => prev.filter((r) => r.id !== id)), 600);
    action();
  };

  if (!mounted) {
    return <div className="min-h-screen bg-neutral-100" />;
  }

  return (
    <div
      className="courses-card mx-auto flex w-full flex-col overflow-hidden rounded-none bg-white shadow-xl sm:my-8 sm:rounded-3xl md:max-w-3xl"
      style={{ height: '100svh', maxHeight: '100svh' }}
    >
      {/* Zone 1: Header — full width, always top */}
      <div className="shrink-0 flex min-w-0 items-center justify-between border-b border-slate-100 px-4 py-4 md:px-6">
        <div className="mr-3 flex min-w-0 flex-col">
          <div className="truncate text-base font-semibold tracking-tight text-slate-900">
            luu<span style={{ color: '#6366f1' }}>.</span><span className="italic">tkb</span>
          </div>
          {displayName && (
            <div className="truncate text-xs text-slate-400">
              Xin chào, {displayName}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2 text-xs">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
            {courses.length} môn học
          </span>
          <button
            type="button"
            onClick={handleLogout}
            className="text-red-500 hover:underline"
          >
            Đăng xuất
          </button>
        </div>
      </div>

      {/* Zone 2: 2-column on desktop, 1-column on mobile */}
      <div className="min-h-0 flex-1 overflow-y-auto md:overflow-hidden md:grid md:grid-cols-2 md:divide-x md:divide-slate-100">
        {/* Left column — Search */}
        <div className="px-4 py-4 md:h-full md:overflow-y-auto md:px-6 md:py-6">
          {!syncResult && (
            <section>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Tìm môn học
              </p>
              <SearchBox
                onSelect={handleSelect}
                onRemove={(code) => removeCourse(code)}
                selectedCodes={selectedCourseCodes}
                addingCode={addingCode}
              />
            </section>
          )}
          {syncResult && (
            <SyncSuccessView
              courses={courses}
              syncResult={syncResult}
              scheduledCourses={scheduledCourses}
              isApple={isApple}
              onAddMore={() => {
                setSyncResult(null);
                setScheduledCourses([]);
              }}
            />
          )}
          {!syncResult && (
            <section className="mt-8 pb-2 md:hidden">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Đã chọn
              </p>
              {loading ? (
                <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
              ) : courses.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
                  Chưa có môn học nào được chọn
                </div>
              ) : (
                <ul className="space-y-3">
                  {courses.map((c) => (
                    <li
                      key={c.code}
                      style={{
                        animation: removingCode === c.code
                          ? 'slideUp 0.2s ease forwards'
                          : 'cardSpring 0.45s cubic-bezier(0.34,1.56,0.64,1) both',
                      }}
                      className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900">
                          {c.name}
                        </div>
                        {(() => {
                          const full = courseSchedules.get(c.code);
                          const sched = full?.schedules?.[0];
                          if (!sched) {
                            return <div className="text-xs text-slate-400">{c.code}</div>;
                          }
                          const day = WEEKDAY_LABEL[String(sched.weekday)] ?? '?';
                          const time = `${sched.start_time.slice(0, 5)}–${sched.end_time.slice(0, 5)}`;
                          const room = sched.room ? ` · ${sched.room}` : '';
                          return (
                            <div className="text-xs text-slate-400">
                              {day} · {time}{room}
                            </div>
                          );
                        })()}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemove(c.code)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-600 transition hover:bg-red-100"
                        title="Xóa môn"
                      >
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 24 24"
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M3 6h18" />
                          <path d="M8 6V4h8v2" />
                          <path d="M19 6l-1 14H6L5 6" />
                          <path d="M10 11v6" />
                          <path d="M14 11v6" />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>

        {/* Right column — Course list (desktop only when not synced) */}
        {!syncResult && (
          <div className="hidden md:flex md:flex-col md:overflow-hidden">
            {/* Scrollable list */}
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Đã chọn
              </p>
              {loading ? (
                <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
              ) : courses.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
                  Chưa có môn học nào được chọn
                </div>
              ) : (
                <ul className="space-y-3">
                  {courses.map((c) => (
                    <li
                      key={c.code}
                      style={{
                        animation: removingCode === c.code
                          ? 'slideUp 0.2s ease forwards'
                          : 'cardSpring 0.45s cubic-bezier(0.34,1.56,0.64,1) both',
                      }}
                      className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900">
                          {c.name}
                        </div>
                        {(() => {
                          const full = courseSchedules.get(c.code);
                          const sched = full?.schedules?.[0];
                          if (!sched) {
                            return <div className="text-xs text-slate-400">{c.code}</div>;
                          }
                          const day = WEEKDAY_LABEL[String(sched.weekday)] ?? '?';
                          const time = `${sched.start_time.slice(0, 5)}–${sched.end_time.slice(0, 5)}`;
                          const room = sched.room ? ` · ${sched.room}` : '';
                          return (
                            <div className="text-xs text-slate-400">
                              {day} · {time}{room}
                            </div>
                          );
                        })()}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemove(c.code)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-600 transition hover:bg-red-100"
                        title="Xóa môn"
                      >
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 24 24"
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M3 6h18" />
                          <path d="M8 6V4h8v2" />
                          <path d="M19 6l-1 14H6L5 6" />
                          <path d="M10 11v6" />
                          <path d="M14 11v6" />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {/* Sync button — bottom of right column on desktop */}
            <div className="shrink-0 border-t border-slate-100 px-6 py-4">
              <div className="relative overflow-hidden rounded-xl">
                <button
                  type="button"
                  onClick={(e) => handleButtonClick(e, isApple ? handleExportIcs : handleSync)}
                  disabled={courses.length === 0 || isSyncing}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                >
                  {isApple ? (
                    <span
                      style={{ fontSize: '15px', lineHeight: 1, fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}
                    >
                    </span>
                  ) : null}
                  {isSyncing
                    ? 'Đang xử lý...'
                    : isApple ? 'Thêm vào Apple Calendar' : 'Đồng bộ Google Calendar'}
                </button>
                {courses.length > 0 && !isSyncing ? ripples.map((r) => (
                  <span
                    key={r.id}
                    style={{
                      position: 'absolute',
                      left: r.x,
                      top: r.y,
                      width: 40,
                      height: 40,
                      marginLeft: -20,
                      marginTop: -20,
                      borderRadius: '50%',
                      background: 'rgba(255,255,255,0.3)',
                      animation: 'ripple 0.6s linear',
                      pointerEvents: 'none',
                    }}
                  />
                )) : null}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Zone 3: Sync button — mobile only, hidden on desktop */}
      {!syncResult && (
        <div className="shrink-0 border-t border-slate-100 px-4 py-4 md:hidden">
          <div className="relative overflow-hidden rounded-xl">
            <button
              type="button"
              onClick={(e) => handleButtonClick(e, isApple ? handleExportIcs : handleSync)}
              disabled={courses.length === 0 || isSyncing}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
            >
              {isApple ? (
                <span
                  style={{ fontSize: '15px', lineHeight: 1, fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}
                >
                </span>
              ) : null}
              {isSyncing
                ? 'Đang xử lý...'
                : isApple ? 'Thêm vào Apple Calendar' : 'Đồng bộ Google Calendar'}
            </button>
            {courses.length > 0 && !isSyncing ? ripples.map((r) => (
              <span
                key={r.id}
                style={{
                  position: 'absolute',
                  left: r.x,
                  top: r.y,
                  width: 40,
                  height: 40,
                  marginLeft: -20,
                  marginTop: -20,
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.3)',
                  animation: 'ripple 0.6s linear',
                  pointerEvents: 'none',
                }}
              />
            )) : null}
          </div>
        </div>
      )}
    </div>
  );
}
