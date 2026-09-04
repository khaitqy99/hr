/** Lịch tự động bật/tắt đăng ký ca (NV). Thứ: 1=T2 ... 7=CN. Giờ theo máy local (VN). */

export type ShiftRegistrationScheduleMode = 'manual' | 'window' | 'weekly';

export type WeeklyShiftRegistrationWindow = {
  startDay: number;
  startTime: string;
  endDay: number;
  endTime: string;
};

export type ShiftRegistrationSchedule = {
  mode: ShiftRegistrationScheduleMode;
  enableAt?: number | null;
  disableAt?: number | null;
  weekly?: WeeklyShiftRegistrationWindow | null;
};

export type ShiftRegistrationState = {
  enabled: boolean;
  manualEnabled: boolean;
  schedule: ShiftRegistrationSchedule;
  nextChangeAt: number | null;
  nextChangeEnabled: boolean | null;
};

export const MANUAL_SCHEDULE: ShiftRegistrationSchedule = { mode: 'manual' };

export type ShiftRegPushKind = 'open' | 'close_warn';

export function formatShiftRegCloseLabel(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())} ngày ${d.getDate()}/${d.getMonth() + 1}`;
}

export function shiftRegPushCopy(kind: ShiftRegPushKind, closeLabel?: string | null): {
  title: string;
  message: string;
  type: 'info' | 'warning';
} {
  if (kind === 'open') {
    return {
      title: 'Đăng ký ca đã mở',
      message: 'Đăng ký ca đang mở. Vào app để đăng ký hoặc sửa ca làm việc.',
      type: 'info',
    };
  }
  const when = closeLabel?.trim() ? ` (${closeLabel.trim()})` : '';
  return {
    title: 'Đăng ký ca sắp đóng',
    message: `Còn 30 phút nữa đăng ký ca sẽ khóa${when}. Hãy đăng ký hoặc sửa ca trước khi hết giờ.`,
    type: 'warning',
  };
}

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function parseHHMM(value: string): { hours: number; minutes: number } | null {
  const m = TIME_RE.exec(value.trim());
  if (!m) return null;
  return { hours: Number(m[1]), minutes: Number(m[2]) };
}

export function isValidIsoWeekday(day: number): boolean {
  return Number.isInteger(day) && day >= 1 && day <= 7;
}

export function parseShiftRegistrationSchedule(raw: string | undefined | null): ShiftRegistrationSchedule {
  if (!raw) return { ...MANUAL_SCHEDULE };
  try {
    const parsed = JSON.parse(raw) as Partial<ShiftRegistrationSchedule>;
    const mode = parsed.mode;
    if (mode === 'window') {
      const enableAt = toOptionalEpoch(parsed.enableAt);
      const disableAt = toOptionalEpoch(parsed.disableAt);
      if (enableAt == null && disableAt == null) return { ...MANUAL_SCHEDULE };
      return { mode: 'window', enableAt, disableAt, weekly: null };
    }
    if (mode === 'weekly') {
      const weekly = parseWeekly(parsed.weekly);
      if (!weekly) return { ...MANUAL_SCHEDULE };
      return { mode: 'weekly', weekly, enableAt: null, disableAt: null };
    }
    return { ...MANUAL_SCHEDULE };
  } catch {
    return { ...MANUAL_SCHEDULE };
  }
}

export function isShiftRegistrationEffectivelyEnabled(
  manualEnabled: boolean,
  schedule: ShiftRegistrationSchedule,
  now: number = Date.now()
): boolean {
  if (schedule.mode === 'window') {
    const enableAt = schedule.enableAt ?? null;
    const disableAt = schedule.disableAt ?? null;
    if (enableAt != null && disableAt != null) return now >= enableAt && now < disableAt;
    if (enableAt != null) return now >= enableAt;
    if (disableAt != null) return manualEnabled && now < disableAt;
    return manualEnabled;
  }
  if (schedule.mode === 'weekly' && schedule.weekly) {
    return isInWeeklyWindow(now, schedule.weekly);
  }
  return manualEnabled;
}

export function getShiftRegistrationNextChange(
  schedule: ShiftRegistrationSchedule,
  now: number = Date.now()
): { at: number; enabled: boolean } | null {
  if (schedule.mode === 'window') {
    const enableAt = schedule.enableAt ?? null;
    const disableAt = schedule.disableAt ?? null;
    if (enableAt != null && now < enableAt) return { at: enableAt, enabled: true };
    if (disableAt != null && now < disableAt && (enableAt == null || now >= enableAt)) {
      return { at: disableAt, enabled: false };
    }
    return null;
  }
  if (schedule.mode === 'weekly' && schedule.weekly) {
    const inWindow = isInWeeklyWindow(now, schedule.weekly);
    const target = inWindow
      ? nextOccurrence(now, schedule.weekly.endDay, schedule.weekly.endTime)
      : nextOccurrence(now, schedule.weekly.startDay, schedule.weekly.startTime);
    return { at: target.getTime(), enabled: !inWindow };
  }
  return null;
}

export function validateShiftRegistrationSchedule(
  schedule: ShiftRegistrationSchedule
): string | null {
  if (schedule.mode === 'manual') return null;
  if (schedule.mode === 'window') {
    const enableAt = schedule.enableAt ?? null;
    const disableAt = schedule.disableAt ?? null;
    if (enableAt == null && disableAt == null) return 'missing-window';
    if (enableAt != null && disableAt != null && enableAt >= disableAt) return 'window-order';
    return null;
  }
  if (schedule.mode === 'weekly') {
    const weekly = schedule.weekly;
    if (!weekly) return 'missing-weekly';
    if (!isValidIsoWeekday(weekly.startDay) || !isValidIsoWeekday(weekly.endDay)) return 'weekly-day';
    if (!parseHHMM(weekly.startTime) || !parseHHMM(weekly.endTime)) return 'weekly-time';
    if (weekly.startDay === weekly.endDay && weekly.startTime === weekly.endTime) return 'weekly-same';
    return null;
  }
  return 'invalid-mode';
}

export function toDatetimeLocalValue(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromDatetimeLocalValue(value: string): number | null {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function toOptionalEpoch(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return value;
}

function parseWeekly(raw: WeeklyShiftRegistrationWindow | null | undefined): WeeklyShiftRegistrationWindow | null {
  if (!raw) return null;
  if (!isValidIsoWeekday(raw.startDay) || !isValidIsoWeekday(raw.endDay)) return null;
  if (!parseHHMM(raw.startTime) || !parseHHMM(raw.endTime)) return null;
  return {
    startDay: raw.startDay,
    startTime: raw.startTime,
    endDay: raw.endDay,
    endTime: raw.endTime,
  };
}

function isoWeekday(date: Date): number {
  const js = date.getDay();
  return js === 0 ? 7 : js;
}

function minutesFromWeekStart(date: Date): number {
  const parsed = { hours: date.getHours(), minutes: date.getMinutes() };
  return (isoWeekday(date) - 1) * 24 * 60 + parsed.hours * 60 + parsed.minutes;
}

function weeklyBoundaryMinutes(day: number, time: string): number {
  const parsed = parseHHMM(time);
  if (!parsed) return 0;
  return (day - 1) * 24 * 60 + parsed.hours * 60 + parsed.minutes;
}

export function isInWeeklyWindow(now: number, weekly: WeeklyShiftRegistrationWindow): boolean {
  const cur = minutesFromWeekStart(new Date(now));
  const start = weeklyBoundaryMinutes(weekly.startDay, weekly.startTime);
  const end = weeklyBoundaryMinutes(weekly.endDay, weekly.endTime);
  if (start === end) return false;
  if (start < end) return cur >= start && cur < end;
  return cur >= start || cur < end;
}

function nextOccurrence(nowMs: number, isoDay: number, hhmm: string): Date {
  const parsed = parseHHMM(hhmm) ?? { hours: 0, minutes: 0 };
  const now = new Date(nowMs);
  const currentIso = isoWeekday(now);
  let addDays = isoDay - currentIso;
  const candidate = new Date(now);
  candidate.setHours(parsed.hours, parsed.minutes, 0, 0);
  if (addDays < 0 || (addDays === 0 && candidate.getTime() <= nowMs)) {
    addDays += 7;
  }
  candidate.setDate(candidate.getDate() + addDays);
  return candidate;
}
