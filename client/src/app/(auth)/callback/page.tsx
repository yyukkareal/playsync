'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { clearToken, getToken } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

type AuthStatus = 'loading' | 'error';

function isValidUserId(raw: string): boolean {
  return /^\d+$/.test(raw) && Number(raw) > 0;
}

function isLikelyJwt(raw: string): boolean {
  // Basic JWT shape check: header.payload.signature
  return raw.split('.').length === 3;
}

function safeSetLocalStorage(key: string, value: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    localStorage.setItem(key, value);
    return localStorage.getItem(key) === value;
  } catch {
    return false;
  }
}

function safeRemoveLocalStorage(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const processedRef = useRef(false);
  const redirectTimerRef = useRef<number | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (processedRef.current) return;
    processedRef.current = true;

    const fail = (message: string) => {
      clearToken();
      safeRemoveLocalStorage('user_id');
      setStatus('error');
      setErrorMessage(message);

      if (redirectTimerRef.current) {
        window.clearTimeout(redirectTimerRef.current);
      }
      redirectTimerRef.current = window.setTimeout(() => {
        router.replace('/');
      }, 1500);
    };

    const token = (searchParams.get('token') ?? '').trim();
    const userId = (searchParams.get('user_id') ?? '').trim();

    if (!token || !userId) {
      fail('Thiếu thông tin xác thực từ Google.');
      return;
    }

    if (!isLikelyJwt(token)) {
      fail('Token xác thực không hợp lệ.');
      return;
    }

    if (!isValidUserId(userId)) {
      fail('ID người dùng không hợp lệ.');
      return;
    }

    if (!safeSetLocalStorage('user_id', userId)) {
      fail('Không thể lưu thông tin người dùng.');
      return;
    }

    (async () => {
      await login(token, userId);
      router.replace('/courses');
    })();

    return () => {
      if (redirectTimerRef.current) {
        window.clearTimeout(redirectTimerRef.current);
      }
    };
  }, [router, searchParams]);

  if (status === 'error') {
    return (
      <div className="w-full max-w-md rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        <p className="font-semibold">Xác thực thất bại</p>
        <p className="mt-2">{errorMessage}</p>
        <p className="mt-3 text-xs text-red-600">Đang quay về trang đăng nhập...</p>
      </div>
    );
  }

  return (
    <div className="text-sm text-slate-600">
      Đang xác thực với Google, vui lòng chờ...
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<div className="text-sm text-slate-600">Đang tải...</div>}>
      <AuthCallbackContent />
    </Suspense>
  );
}
