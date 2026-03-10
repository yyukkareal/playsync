'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

function getToken(): string | null {
  return localStorage.getItem('playsync_token');
}

function getUserId(): string | null {
  return localStorage.getItem('user_id');
}

// Decode JWT payload (no verification — client-side only)
function decodeToken(token: string): Record<string, string> | null {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
}

export default function Dashboard() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [userName, setUserName] = useState('');
  const [courses, setCourses] = useState<string[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [syncResult, setSyncResult] = useState<{
    created_events: number;
    updated_events: number;
    skipped_events: number;
  } | null>(null);

  // ── Mount + auth guard ─────────────────────────────────────────────────
  useEffect(() => {
    setMounted(true);
    const token = getToken();
    if (!token) {
      router.replace('/');
      return;
    }
    // Extract name from JWT
    const claims = decodeToken(token);
    if (claims?.name) setUserName(claims.name);
    else if (claims?.email) setUserName(claims.email);
  }, [router]);

  // ── Load courses ───────────────────────────────────────────────────────
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    fetch(`${API}/api/users/me/courses`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => setCourses(data.course_codes ?? []))
      .catch(() => {});
  }, []);

  // ── Toast ──────────────────────────────────────────────────────────────
  const addToast = useCallback((message: string, type: 'success' | 'error') => {
    const id = Date.now();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  // ── Sync ───────────────────────────────────────────────────────────────
  const handleSync = async () => {
    const userId = getUserId();
    const token = getToken();
    if (!userId || !token) return;

    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch(`${API}/api/sync/${userId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSyncResult(data);
      addToast('Đồng bộ thành công! 🎉', 'success');
    } catch {
      addToast('Đồng bộ thất bại. Thử lại.', 'error');
    } finally {
      setSyncing(false);
    }
  };

  if (!mounted) return null;

  const firstName = userName.split(' ').pop() ?? userName;

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#FFF8EC',
      fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
    }}>

      {/* ── Toasts ── */}
      <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 999, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {toasts.map((t) => (
          <div key={t.id} style={{
            padding: '10px 16px',
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 500,
            color: '#fff',
            backgroundColor: t.type === 'success' ? '#5BAB43' : '#B92020',
            boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
            animation: 'slideIn 0.2s ease',
          }}>{t.message}</div>
        ))}
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '48px 24px' }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: '#9A9A9A', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              PlaySync
            </span>
            <button
              onClick={() => router.push('/courses')}
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: '#FF8202',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: 6,
              }}
            >
              + Thêm môn
            </button>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#353535', margin: '8px 0 4px' }}>
            Chào {firstName}! 👋
          </h1>
          <p style={{ fontSize: 14, color: '#6B6B6B', margin: 0 }}>
            {courses.length > 0
              ? `Bạn có ${courses.length} môn học đang theo dõi.`
              : 'Chưa có môn học nào. Hãy thêm môn học trước.'}
          </p>
        </div>

        {/* ── Course cards ── */}
        {courses.length > 0 ? (
          <div style={{ marginBottom: 32 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#9A9A9A', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
              Môn học đã chọn
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {courses.map((code, i) => (
                <div key={code} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '14px 16px',
                  backgroundColor: '#fff',
                  border: '1px solid #E6E2D9',
                  borderRadius: 12,
                  boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                }}>
                  <div style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    backgroundColor: '#FFF8EC',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 13,
                    fontWeight: 700,
                    color: '#FF8202',
                    flexShrink: 0,
                  }}>
                    {String(i + 1).padStart(2, '0')}
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#353535' }}>{code}</div>
                    <div style={{ fontSize: 12, color: '#9A9A9A', marginTop: 1 }}>Lịch học hàng tuần</div>
                  </div>
                  <div style={{ marginLeft: 'auto' }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%',
                      backgroundColor: '#5BAB43',
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{
            marginBottom: 32,
            padding: '40px 24px',
            backgroundColor: '#fff',
            border: '1px dashed #E6E2D9',
            borderRadius: 14,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📚</div>
            <p style={{ fontSize: 14, color: '#9A9A9A', margin: 0 }}>
              Chưa có môn học nào.{' '}
              <span
                onClick={() => router.push('/courses')}
                style={{ color: '#FF8202', cursor: 'pointer', fontWeight: 500 }}
              >
                Thêm ngay →
              </span>
            </p>
          </div>
        )}

        {/* ── Sync button ── */}
        <button
          onClick={handleSync}
          disabled={syncing || courses.length === 0}
          style={{
            width: '100%',
            padding: '16px',
            backgroundColor: syncing || courses.length === 0 ? '#E6E2D9' : '#FFC049',
            color: syncing || courses.length === 0 ? '#9A9A9A' : '#353535',
            border: 'none',
            borderRadius: 12,
            fontSize: 16,
            fontWeight: 700,
            cursor: syncing || courses.length === 0 ? 'not-allowed' : 'pointer',
            boxShadow: courses.length > 0 && !syncing ? '0 4px 16px rgba(255,192,73,0.4)' : 'none',
            transition: 'all 0.2s',
            letterSpacing: '0.01em',
          }}
        >
          {syncing ? '⏳ Đang đồng bộ...' : '🔄 Đồng bộ Google Calendar'}
        </button>

        {/* ── Sync result ── */}
        {syncResult && (
          <div style={{
            marginTop: 16,
            padding: 20,
            backgroundColor: '#fff',
            border: '1px solid #E6E2D9',
            borderRadius: 14,
            boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
          }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#353535', margin: '0 0 14px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Kết quả đồng bộ
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              {[
                { label: 'Tạo mới', value: syncResult.created_events, color: '#5BAB43', bg: '#F0FAF0' },
                { label: 'Cập nhật', value: syncResult.updated_events, color: '#FF8202', bg: '#FFF4EC' },
                { label: 'Bỏ qua', value: syncResult.skipped_events, color: '#9A9A9A', bg: '#F7F7F7' },
              ].map((item) => (
                <div key={item.label} style={{
                  flex: 1,
                  textAlign: 'center',
                  padding: '14px 8px',
                  backgroundColor: item.bg,
                  borderRadius: 10,
                }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: item.color }}>{item.value}</div>
                  <div style={{ fontSize: 12, color: '#6B6B6B', marginTop: 2 }}>{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(12px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        button:hover:not(:disabled) { filter: brightness(0.97); transform: translateY(-1px); }
      `}</style>
    </div>
  );
}