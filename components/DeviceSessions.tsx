import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import {
  DeviceSession,
  getCurrentSessionId,
  listDeviceSessions,
  revokeOtherSessions,
  revokeSession,
} from '../services/sessions';

interface DeviceSessionsProps {
  userId: string;
}

function formatLastSeen(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return '';
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Vừa hoạt động';
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ngày trước`;
  return new Date(iso).toLocaleString('vi-VN');
}

const DeviceSessions: React.FC<DeviceSessionsProps> = ({ userId }) => {
  const [sessions, setSessions] = useState<DeviceSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const currentId = getCurrentSessionId();

  const load = useCallback(async () => {
    try {
      setError(null);
      const rows = await listDeviceSessions(userId);
      setSessions(rows);
    } catch (err: unknown) {
      const message = err instanceof Error
        ? err.message
        : (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string'
          ? err.message
          : 'Không tải được danh sách thiết bị');
      setError(
        /user_sessions|schema cache|PGRST205/i.test(message)
          ? 'Chưa có bảng phiên đăng nhập. Chạy migration 041_user_sessions.sql trên Supabase rồi tải lại.'
          : message
      );
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
    const channel = supabase
      .channel(`device-list:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_sessions', filter: `user_id=eq.${userId}` },
        () => {
          void load();
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, load]);

  const others = sessions.filter((session) => session.id !== currentId);

  const handleRevokeOne = async (session: DeviceSession) => {
    if (!window.confirm(`Đăng xuất tài khoản khỏi ${session.deviceLabel}?`)) return;
    setBusyId(session.id);
    setNotice(null);
    try {
      await revokeSession(session.id);
      setNotice(`Đã đăng xuất ${session.deviceLabel}.`);
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không đăng xuất được thiết bị này');
    } finally {
      setBusyId(null);
    }
  };

  const handleRevokeOthers = async () => {
    if (others.length === 0) {
      setNotice('Không có thiết bị khác đang đăng nhập.');
      return;
    }
    if (!window.confirm('Đăng xuất tài khoản khỏi tất cả thiết bị khác? Thiết bị này vẫn giữ đăng nhập.')) return;
    setBusyId('others');
    setNotice(null);
    try {
      const count = await revokeOtherSessions(userId);
      setNotice(count > 0 ? `Đã đăng xuất ${count} thiết bị khác.` : 'Không có thiết bị khác đang đăng nhập.');
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không đăng xuất được các thiết bị khác');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="bg-white p-5 rounded-3xl shadow-sm border border-sky-50 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-700">Thiết bị đang đăng nhập</h3>
          <p className="text-xs text-slate-500 mt-1">Đăng xuất tài khoản khỏi máy hoặc điện thoại không còn dùng.</p>
        </div>
      </div>

      {error && <p className="text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>}
      {notice && <p className="text-xs text-emerald-700 bg-emerald-50 rounded-xl px-3 py-2">{notice}</p>}

      {loading ? (
        <p className="text-xs text-slate-400">Đang tải thiết bị...</p>
      ) : error ? null : sessions.length === 0 ? (
        <p className="text-xs text-slate-400">Chưa ghi nhận thiết bị nào.</p>
      ) : (
        <ul className="space-y-2">
          {sessions.map((session) => {
            const isCurrent = session.id === currentId;
            return (
              <li key={session.id} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">
                    {session.deviceLabel}
                    {isCurrent && <span className="ml-2 text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">Thiết bị này</span>}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{formatLastSeen(session.lastSeenAt)}</p>
                </div>
                {!isCurrent && (
                  <button
                    type="button"
                    onClick={() => void handleRevokeOne(session)}
                    disabled={busyId !== null}
                    className="shrink-0 text-xs font-bold text-red-600 px-3 py-2 rounded-xl hover:bg-red-50 disabled:opacity-50"
                  >
                    {busyId === session.id ? 'Đang thoát...' : 'Đăng xuất'}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <button
        type="button"
        onClick={() => void handleRevokeOthers()}
        disabled={busyId !== null || others.length === 0}
        className="w-full py-3 rounded-xl text-sm font-bold bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50"
      >
        {busyId === 'others' ? 'Đang đăng xuất...' : 'Đăng xuất tất cả thiết bị khác'}
      </button>
    </div>
  );
};

export default DeviceSessions;
