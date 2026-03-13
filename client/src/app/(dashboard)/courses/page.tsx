'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clearToken } from '@/lib/api';
import { useCourses } from '@/hooks/useCourses';
import { SearchBox } from '@/components/courses/SearchBox';
import type { Course } from '@/types/course';
import { API_URL, getHeaders } from '@/lib/api';

export default function CoursesDashboardPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [addingCode, setAddingCode] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const { courses, loading, addCourse, removeCourse } = useCourses();

  const selectedCourseCodes = useMemo(
    () => new Set(courses.map((c) => c.code)),
    [courses],
  );

  // Simple auth guard based on presence of token in storage
  useEffect(() => {
    setMounted(true);
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
    if (!result.success) {
      alert(result.message || 'Có lỗi xảy ra khi thêm môn học.');
    }
    setAddingCode(null);
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
      const res = await fetch(
        `${API_URL}/api/sync/${encodeURIComponent(userId)}`,
        {
          method: 'POST',
          headers: getHeaders(),
        },
      );

      if (!res.ok) throw new Error('Đồng bộ thất bại');

      const data = await res.json();
      alert(
        `Đồng bộ thành công!\n- Tạo mới: ${data.created_events}\n- Cập nhật: ${data.updated_events}`,
      );
    } catch {
      alert('Không thể kết nối với máy chủ để đồng bộ.');
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

  if (!mounted) {
    return <div className="min-h-screen bg-neutral-100" />;
  }

  return (
    <div className="w-full max-w-2xl rounded-3xl bg-white p-8 shadow-xl">
      <header className="mb-8 flex items-center justify-between">
        <div className="text-lg font-semibold tracking-tight text-slate-900">
          Play<span className="italic">Sync</span>
        </div>
        <div className="flex items-center gap-3 text-xs">
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
      </header>

      <section className="mb-6">
        <h1 className="mb-2 text-2xl font-semibold text-slate-900">
          Lịch học của bạn
        </h1>
        <p className="text-sm text-slate-500">
          Tìm kiếm môn học theo mã hoặc tên, sau đó đồng bộ sang Google
          Calendar.
        </p>
      </section>

      <section className="mb-8 space-y-4">
        <SearchBox
          onSelect={handleSelect}
          selectedCodes={selectedCourseCodes}
          addingCode={addingCode}
        />

        <button
          type="button"
          onClick={handleSync}
          disabled={courses.length === 0 || isSyncing}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
        >
          {isSyncing ? 'Đang đồng bộ dữ liệu...' : 'Đồng bộ Google Calendar 📅'}
        </button>
      </section>

      <section>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Môn học đã chọn
        </p>
        {loading ? (
          <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
        ) : courses.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
            Chưa có môn học nào được chọn 📭
          </div>
        ) : (
          <ul className="space-y-3">
            {courses.map((c) => (
              <li
                key={c.code}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
              >
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    {c.name}
                  </div>
                  <div className="text-xs text-slate-500">{c.code}</div>
                </div>
                <button
                  type="button"
                  onClick={() => removeCourse(c.code)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-sm text-red-500 hover:bg-red-100"
                  title="Xóa môn"
                >
                  🗑️
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

