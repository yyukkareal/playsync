// src/app/page.tsx
'use client';

import { API_URL } from '@/lib/api';

export default function LandingPage() {
  const handleLogin = () => {
    window.location.href = `${API_URL.replace(/\/$/, '')}/auth/google/login`;
  };

  return (
    <div className="w-full max-w-md rounded-3xl bg-white p-10 shadow-xl">
      <div className="mb-4 text-center text-4xl">🗓️</div>

      <h1 className="mb-3 text-center text-3xl font-extrabold tracking-tight text-slate-900">
        Play<span className="italic">Sync</span>
      </h1>

      <p className="mb-8 text-center text-sm leading-relaxed text-slate-500">
        Đồng bộ lịch học TMU sang Google Calendar.
        <br />
        Tối giản, tập trung, dành cho sinh viên MIS.
      </p>

      <button
        type="button"
        onClick={handleLogin}
        className="flex w-full items-center justify-center gap-3 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 active:scale-[0.99]"
      >
        <img
          src="https://www.gstatic.com/images/branding/product/1x/gsa_512dp.png"
          alt="Google"
          className="h-5 w-5"
        />
        Tiếp tục với Google
      </button>

      <p className="mt-8 border-t border-slate-200 pt-4 text-center text-xs text-slate-400">
        Dự án mã nguồn mở phục vụ học tập.
        <br />
        © 2026 PlaySync Team
      </p>
    </div>
  );
}