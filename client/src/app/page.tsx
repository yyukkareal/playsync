'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_URL } from '@/lib/api';
import { isAppleDevice } from '@/lib/device';
import { useAuth } from '@/context/AuthContext';

export default function LandingPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [isApple, setIsApple] = useState(false);

  useEffect(() => {
    setIsApple(isAppleDevice());
    
    console.log("AUTH_CHECK_LANDING", { user, loading, mounted: true });

    if (!loading && user) {
      console.log("REDIRECT_TRIGGERED", { path: "/", to: "/courses", reason: "User already authenticated" });
      router.replace('/courses');
    }
  }, [user, loading, router]);

  const handleLogin = () => {
    window.location.href = `${API_URL.replace(/\/$/, '')}/auth/google/login`;
  };

  return (
    <div className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-white p-8 shadow-xl">
      {/* Background orbs */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 animate-pulse rounded-full bg-indigo-50 blur-3xl" />
      <div
        className="pointer-events-none absolute -bottom-12 -left-12 h-40 w-40 animate-pulse rounded-full bg-emerald-50 blur-3xl"
        style={{ animationDelay: '2s' }}
      />

      {/* Floating icon */}
      <div
        className="mb-6 flex justify-center"
        style={{ animation: 'float 3s ease-in-out infinite' }}
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-100 bg-slate-50">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <rect
              x="4"
              y="6"
              width="24"
              height="22"
              rx="4"
              stroke="#0f172a"
              strokeWidth="1.5"
            />
            <line x1="4" y1="12" x2="28" y2="12" stroke="#0f172a" strokeWidth="1.5" />
            <line
              x1="10"
              y1="4"
              x2="10"
              y2="9"
              stroke="#0f172a"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <line
              x1="22"
              y1="4"
              x2="22"
              y2="9"
              stroke="#0f172a"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <rect x="8" y="16" width="5" height="4" rx="1" fill="#94a3b8" />
            <rect x="14" y="16" width="5" height="4" rx="1" fill="#0f172a" />
            <rect x="20" y="16" width="5" height="4" rx="1" fill="#94a3b8" />
            <rect x="8" y="21" width="5" height="4" rx="1" fill="#94a3b8" />
            <rect x="14" y="21" width="5" height="4" rx="1" fill="#94a3b8" />
          </svg>
        </div>
      </div>

      {/* Logo + tagline */}
      <div
        className="mb-6 text-center"
        style={{ animation: 'fadeUp 0.5s 0.15s ease both' }}
      >
        <h1 className="mb-2 text-2xl font-semibold tracking-tight text-slate-900">
          luu<span style={{ color: '#6366f1' }}>.</span><span className="italic">tkb</span>
        </h1>
        <p className="mx-auto max-w-xs text-sm leading-relaxed text-slate-500">
          {isApple
            ? 'Đăng nhập bằng Google để xác thực, lịch học sẽ được xuất thẳng vào Apple Calendar.'
            : 'Đồng bộ lịch học TMU vào Google Calendar hoặc Apple Calendar — chỉ trong vài giây.'}
        </p>
      </div>

      {/* Feature chips */}
      <div
        className="mb-6 flex flex-col gap-2.5"
        style={{ animation: 'fadeUp 0.5s 0.3s ease both' }}
      >
        {[
          {
            icon: '⏱',
            color: 'bg-indigo-50 text-indigo-700',
            text: 'Tự động & chính xác',
            sub: 'Parser trực tiếp từ dữ liệu TMU',
          },
          {
            icon: '📅',
            color: 'bg-emerald-50 text-emerald-700',
            text: 'Google & Apple Calendar',
            sub: 'Hỗ trợ cả Android và iPhone',
          },
          {
            icon: '🔓',
            color: 'bg-amber-50 text-amber-700',
            text: 'Mã nguồn mở',
            sub: 'Miễn phí, không quảng cáo',
          },
        ].map((f) => (
          <div
            key={f.text}
            className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5"
          >
            <div
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm ${f.color}`}
            >
              {f.icon}
            </div>
            <div>
              <div className="text-xs font-medium text-slate-800">{f.text}</div>
              <div className="text-xs text-slate-400">{f.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div style={{ animation: 'fadeUp 0.5s 0.45s ease both' }}>
        <button
          type="button"
          onClick={handleLogin}
          className="relative z-10 flex w-full items-center justify-center gap-3 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 active:scale-[0.99]"
        >
          <img
            src="https://www.gstatic.com/images/branding/product/1x/gsa_512dp.png"
            alt="Google"
            className="h-5 w-5"
          />
          Tiếp tục với Google
        </button>
      </div>

      <p
        className="mt-5 text-center text-xs text-slate-400"
        style={{ animation: 'fadeUp 0.5s 0.6s ease both' }}
      >
        Dự án mã nguồn mở · © 2026 PlaySync
      </p>
    </div>
  );
}
