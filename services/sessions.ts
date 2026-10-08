import { supabase, isSupabaseConfigured } from './supabase';

export const SESSION_ID_KEY = 'current_session_id';

export interface DeviceSession {
  id: string;
  userId: string;
  deviceLabel: string;
  createdAt: string;
  lastSeenAt: string;
}

type SessionStatus = 'ok' | 'revoked' | 'unavailable';

let lastTouchedAt = 0;

export function describeDevice(userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : ''): string {
  let os = 'Thiết bị khác';
  if (/iPad/i.test(userAgent)) os = 'iPad';
  else if (/iPhone|iPod/i.test(userAgent)) os = 'iPhone';
  else if (/Android/i.test(userAgent)) os = 'Android';
  else if (/Windows/i.test(userAgent)) os = 'Windows';
  else if (/Mac OS X/i.test(userAgent)) os = 'Mac';
  else if (/Linux/i.test(userAgent)) os = 'Linux';

  let browser = 'Trình duyệt';
  if (/Edg\//i.test(userAgent)) browser = 'Edge';
  else if (/Chrome\//i.test(userAgent)) browser = 'Chrome';
  else if (/Safari/i.test(userAgent) && !/Chrome|CriOS|Android/i.test(userAgent)) browser = 'Safari';
  else if (/Firefox|FxiOS/i.test(userAgent)) browser = 'Firefox';

  const standalone =
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true);

  return standalone ? `${os} · Ứng dụng` : `${os} · ${browser}`;
}

export function getCurrentSessionId(): string | null {
  try {
    return localStorage.getItem(SESSION_ID_KEY);
  } catch {
    return null;
  }
}

function mapRow(row: {
  id: string;
  user_id: string;
  device_label: string;
  created_at: string;
  last_seen_at: string;
}): DeviceSession {
  return {
    id: row.id,
    userId: row.user_id,
    deviceLabel: row.device_label,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
  };
}

export async function registerDeviceSession(userId: string): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const id = crypto.randomUUID();
  const { error } = await supabase.from('user_sessions').insert({
    id,
    user_id: userId,
    device_label: describeDevice(),
    user_agent: navigator.userAgent.slice(0, 400),
  });
  if (error) {
    console.error('Không tạo được phiên thiết bị:', error.message);
    return null;
  }
  localStorage.setItem(SESSION_ID_KEY, id);
  lastTouchedAt = Date.now();
  return id;
}

export async function ensureDeviceSession(userId: string): Promise<SessionStatus> {
  if (!isSupabaseConfigured()) return 'unavailable';
  const existing = getCurrentSessionId();
  if (!existing) {
    const created = await registerDeviceSession(userId);
    return created ? 'ok' : 'unavailable';
  }

  const { data, error } = await supabase
    .from('user_sessions')
    .select('id, user_id')
    .eq('id', existing)
    .maybeSingle();

  if (error) return 'unavailable';
  if (!data || data.user_id !== userId) return 'revoked';

  if (Date.now() - lastTouchedAt > 60_000) {
    lastTouchedAt = Date.now();
    await supabase
      .from('user_sessions')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('id', existing);
  }
  return 'ok';
}

export async function revokeCurrentSession(): Promise<void> {
  const id = getCurrentSessionId();
  try {
    localStorage.removeItem(SESSION_ID_KEY);
  } catch {
    /* ignore */
  }
  if (!id || !isSupabaseConfigured()) return;
  await supabase.from('user_sessions').delete().eq('id', id);
}

export async function listDeviceSessions(userId: string): Promise<DeviceSession[]> {
  const { data, error } = await supabase
    .from('user_sessions')
    .select('id, user_id, device_label, created_at, last_seen_at')
    .eq('user_id', userId)
    .order('last_seen_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export async function revokeSession(sessionId: string): Promise<void> {
  const { error } = await supabase.from('user_sessions').delete().eq('id', sessionId);
  if (error) throw error;
}

export async function revokeOtherSessions(userId: string): Promise<number> {
  const current = getCurrentSessionId();
  let query = supabase.from('user_sessions').delete().eq('user_id', userId);
  if (current) query = query.neq('id', current);
  const { data, error } = await query.select('id');
  if (error) throw error;
  return data?.length ?? 0;
}
