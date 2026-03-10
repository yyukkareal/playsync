'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
}

function getToken(): string | null {
  return localStorage.getItem('playsync_token');
}

function getUserId(): string | null {
  return localStorage.getItem('user_id');
}

export default function CoursesPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [input, setInput] = useState('');
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    created_events: number;
    updated_events: number;
    skipped_events: number;
  } | null>(null);

  // ── Kiểm tra Auth ───────────────────────────────────────────────────────
  useEffect(() => {
    setMounted(true);
    if (!localStorage.getItem('playsync_token')) router.replace('/');
  }, [router]);

  // ── Tải danh sách môn ───────────────────────────────────────────────────
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    fetch(`${API}/api/users/me/courses`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => setSelectedCourses(data.course_codes ?? []))
      .catch(() => {});
  }, []);

  const addToast = useCallback((message: string, type: 'success' | 'error') => {
    const id = Date.now();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3000);
  }, []);

  // ── Thêm môn học ────────────────────────────────────────────────────────
  const handleAdd = async () => {
    const code = input.trim().toUpperCase();
    if (!code) return;

    if (selectedCourses.includes(code)) {
      addToast(`${code} đã có trong danh sách.`, 'error');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API}/api/users/me/courses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ course_code: code }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        addToast(err?.detail ?? 'Thêm môn thất bại. Thử lại.', 'error');
        return;
      }
      setSelectedCourses((prev) => [...prev, code]);
      setInput('');
      addToast(`Đã thêm ${code}!`, 'success');
    } catch {
      addToast('Không thể kết nối server.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ── Xóa môn học ─────────────────────────────────────────────────────────
  const handleRemove = async (code: string) => {
    try {
      await fetch(`${API}/api/users/me/courses/${code}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      setSelectedCourses((prev) => prev.filter((c) => c !== code));
      addToast(`Đã xóa ${code}.`, 'success');
    } catch {
      addToast('Xóa thất bại.', 'error');
    }
  };

  // ── Đồng bộ Calendar ────────────────────────────────────────────────────
  const handleSync = async () => {
    const userId = getUserId();
    if (!userId) return;
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch(`${API}/api/sync/${userId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSyncResult(data);
      addToast('Đồng bộ thành công!', 'success');
    } catch {
      addToast('Đồng bộ thất bại. Thử lại.', 'error');
    } finally {
      setSyncing(false);
    }
  };

  if (!mounted) {
    return <div style={{ minHeight: '100vh', backgroundColor: '#FFF8EC' }} />;
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#FFF8EC', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>

      {/* ── Toasts ── */}
      <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 999, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {toasts.map((t) => (
          <div key={t.id} style={{
            padding: '10px 16px', borderRadius: 10, fontSize: 14, fontWeight: 500,
            color: '#fff', backgroundColor: t.type === 'success' ? '#5BAB43' : '#B92020',
            boxShadow: '0 4px 12px rgba(0,0,0,0.12)', animation: 'fadeIn 0.2s ease',
          }}>
            {t.message}
          </div>
        ))}
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '48px 24px' }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 28 }}>📅</span>
            <span style={{ fontSize: 22, fontWeight: 700, color: '#353535' }}>PlaySync</span>
          </div>
          <p style={{ fontSize: 14, color: '#6B6B6B', margin: 0 }}>Quản lý môn học & đồng bộ lịch ngay.</p>
        </div>

        {/* ── Card Quản lý Môn học (Gộp chung Thêm & Danh sách) ── */}
        <div style={{ backgroundColor: '#fff', border: '1px solid #E6E2D9', borderRadius: 14, padding: 24, marginBottom: 24, boxShadow: '0 2px 6px rgba(0,0,0,0.05)' }}>
          
          {/* Khu vực Thêm */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ fontSize: 15, fontWeight: 600, color: '#353535', display: 'block', marginBottom: 10 }}>
              Thêm mã môn mới
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAdd();
                  }
                }}
                placeholder="Ví dụ: MIS101"
                style={{
                  flex: 1, padding: '12px 14px', border: '1px solid #E6E2D9',
                  borderRadius: 10, fontSize: 14, color: '#353535', outline: 'none', backgroundColor: '#fff',
                }}
              />
              <button
                type="button"
                onClick={handleAdd}
                disabled={loading || !input.trim()}
                style={{
                  padding: '12px 24px',
                  backgroundColor: loading || !input.trim() ? '#E6E2D9' : '#FFC049',
                  color: loading || !input.trim() ? '#9A9A9A' : '#353535',
                  border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600,
                  cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
                  transition: 'background 0.15s',
                }}
              >
                {loading ? '...' : '+ Thêm'}
              </button>
            </div>
          </div>

          {/* Khu vực Danh sách */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderTop: '1px solid #F0EBE1', paddingTop: 20 }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: '#353535' }}>Môn đã lưu</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#6B6B6B', backgroundColor: '#F0EBE1', padding: '4px 10px', borderRadius: 12 }}>
                {selectedCourses.length} môn
              </span>
            </div>

            {selectedCourses.length === 0 ? (
              <p style={{ fontSize: 14, color: '#9A9A9A', textAlign: 'center', padding: '16px 0', margin: 0 }}>
                Chưa có môn nào. Hãy thêm mã môn ở ô bên trên nhé!
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {selectedCourses.map((code) => (
                  <div key={code} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '12px 16px', borderRadius: 10, backgroundColor: '#FFF8EC',
                    border: '1px solid #F0EBE1',
                  }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#353535' }}>{code}</span>
                    <button
                      type="button"
                      onClick={() => handleRemove(code)}
                      title={`Xóa môn ${code}`}
                      style={{ 
                        background: '#FFEDED', border: 'none', color: '#B92020', cursor: 'pointer', 
                        fontSize: 18, width: 32, height: 32, borderRadius: 8, display: 'flex', 
                        alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s' 
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Nút Đồng bộ ── */}
        <button
          type="button"
          onClick={handleSync}
          disabled={syncing || selectedCourses.length === 0}
          style={{
            width: '100%', padding: '16px',
            backgroundColor: syncing || selectedCourses.length === 0 ? '#E6E2D9' : '#FF8202',
            color: syncing || selectedCourses.length === 0 ? '#9A9A9A' : '#fff',
            border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 600,
            cursor: syncing || selectedCourses.length === 0 ? 'not-allowed' : 'pointer',
            transition: 'background 0.15s', marginBottom: 20,
          }}
        >
          {syncing ? 'Đang xử lý đồng bộ...' : '🔄 Đồng bộ Google Calendar'}
        </button>

        {/* ── Kết quả Đồng bộ ── */}
        {syncResult && (
          <div style={{ backgroundColor: '#fff', border: '1px solid #E6E2D9', borderRadius: 14, padding: 20, boxShadow: '0 2px 6px rgba(0,0,0,0.05)' }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#353535', margin: '0 0 16px' }}>Kết quả đồng bộ</p>
            <div style={{ display: 'flex', gap: 12 }}>
              {[
                { label: 'Tạo mới', value: syncResult.created_events, color: '#5BAB43', bg: '#F2F8F0' },
                { label: 'Cập nhật', value: syncResult.updated_events, color: '#FF8202', bg: '#FFF5EB' },
                { label: 'Bỏ qua', value: syncResult.skipped_events, color: '#6B6B6B', bg: '#F5F5F5' },
              ].map((item) => (
                <div key={item.label} style={{ flex: 1, textAlign: 'center', padding: '16px 8px', backgroundColor: item.bg, borderRadius: 12 }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: item.color }}>{item.value}</div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: item.color, marginTop: 4 }}>{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
        input:focus { border-color: #FF8202 !important; box-shadow: 0 0 0 2px rgba(255,130,2,0.15) !important; }
        button:hover:not(:disabled) { filter: brightness(0.96); transform: translateY(-1px); }
        button:active:not(:disabled) { transform: translateY(0); }
      `}</style>
    </div>
  );
}