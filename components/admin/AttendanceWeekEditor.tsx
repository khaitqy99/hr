import React, { useEffect, useMemo, useState } from 'react';
import { AttendanceRecord, AttendanceType, User, UserRole } from '../../types';
import { AdminWeeklyAttendanceChange, applyAdminWeeklyAttendance } from '../../services/db';
import { pickDayAnchors, sortAttendanceAsc } from '../../utils/attendanceDay';

interface AttendanceWeekEditorProps {
  actor: User;
  employees: User[];
  records: AttendanceRecord[];
  language: 'vi' | 'en';
  initialEmployeeId: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

interface SlotDraft {
  time: string;
  recordId?: string;
  notes?: string;
}

interface DayDraft {
  dayKey: string;
  checkIn: SlotDraft;
  checkOut: SlotDraft;
}

const EMPTY_SLOT: SlotDraft = { time: '' };

const copy = {
  vi: {
    title: 'Điều chỉnh tuần',
    hint: 'Sửa giờ vào/ra đã có hoặc tạo mốc còn thiếu. Nghỉ trưa giữ nguyên.',
    employee: 'Nhân viên',
    chooseEmployee: 'Chọn nhân viên',
    week: 'Tuần',
    prevWeek: 'Tuần trước',
    nextWeek: 'Tuần sau',
    checkIn: 'Vào ca',
    checkOut: 'Ra ca',
    clear: 'Xóa',
    save: 'Lưu tuần',
    saving: 'Đang lưu...',
    close: 'Đóng',
    saved: 'Đã lưu lịch chấm công.',
    noChanges: 'Chưa có thay đổi để lưu.',
    needCheckIn: 'cần có giờ vào trước khi có giờ ra',
    checkOutAfter: 'giờ ra phải sau giờ vào',
    saveFailed: 'Không lưu được lịch chấm công.',
    confirmTitle: 'Xóa bản ghi chấm công?',
    confirmBody: 'Các ô đã xóa giờ sẽ xóa hẳn bản ghi tương ứng.',
    cancel: 'Hủy',
    confirmDelete: 'Xóa và lưu',
    useLocation: 'Lấy vị trí',
    locating: 'Đang lấy vị trí...',
    locationReady: 'Vị trí hiện tại',
    locationApplies: 'Vị trí này được ghi cho mọi giờ vào và giờ ra trong tuần.',
    needLocation: 'Hãy lấy vị trí trước khi lưu giờ vào/ra.',
    gpsUnsupported: 'Trình duyệt không hỗ trợ GPS.',
    gpsInsecure: 'Trình duyệt chỉ cho phép xin vị trí trên HTTPS hoặc localhost.',
    gpsDenied: 'Bạn đã từ chối quyền vị trí. Hãy bật lại trong cài đặt trình duyệt.',
    gpsUnavailable: 'Không lấy được vị trí. Hãy bật GPS rồi thử lại.',
    gpsTimeout: 'Định vị quá lâu. Hãy thử lại.',
    gpsFailed: 'Không thể lấy vị trí. Hãy thử lại.',
    days: ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'],
  },
  en: {
    title: 'Adjust week',
    hint: 'Edit existing check-in/out times or fill missing punches. Lunch punches stay as they are.',
    employee: 'Employee',
    chooseEmployee: 'Select employee',
    week: 'Week',
    prevWeek: 'Previous week',
    nextWeek: 'Next week',
    checkIn: 'Check-in',
    checkOut: 'Check-out',
    clear: 'Clear',
    save: 'Save week',
    saving: 'Saving...',
    close: 'Close',
    saved: 'Attendance week saved.',
    noChanges: 'Nothing to save.',
    needCheckIn: 'check-in is required before check-out',
    checkOutAfter: 'check-out must be after check-in',
    saveFailed: 'Could not save this attendance week.',
    confirmTitle: 'Delete attendance records?',
    confirmBody: 'Cleared times will delete those punch records.',
    cancel: 'Cancel',
    confirmDelete: 'Delete and save',
    useLocation: 'Use current location',
    locating: 'Getting location...',
    locationReady: 'Current location',
    locationApplies: 'This location is saved on every check-in and check-out in the week.',
    needLocation: 'Get the current location before saving check-in or check-out times.',
    gpsUnsupported: 'This browser does not support GPS.',
    gpsInsecure: 'Location is only available on HTTPS or localhost.',
    gpsDenied: 'Location permission was denied. Turn it back on in the browser settings.',
    gpsUnavailable: 'Location is unavailable. Turn on GPS and try again.',
    gpsTimeout: 'Location took too long. Try again.',
    gpsFailed: 'Could not get the location. Try again.',
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  },
};

function dayKeyFromDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function dateFromDayKey(dayKey: string): Date {
  const [y, m, d] = dayKey.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function mondayKey(from = new Date()): string {
  const date = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return dayKeyFromDate(date);
}

function shiftDayKey(dayKey: string, days: number): string {
  const date = dateFromDayKey(dayKey);
  date.setDate(date.getDate() + days);
  return dayKeyFromDate(date);
}

function localDayKey(timestamp: number): string {
  return dayKeyFromDate(new Date(timestamp));
}

function timeValue(timestamp: number): string {
  const date = new Date(timestamp);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function normalizeTime(value: string): string {
  const match = value.match(/^(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : '';
}

function timestampOnDay(dayKey: string, time: string): number {
  const date = dateFromDayKey(dayKey);
  const [hours, minutes] = time.split(':').map(Number);
  date.setHours(hours, minutes, 0, 0);
  return date.getTime();
}

function formatShort(dayKey: string): string {
  const date = dateFromDayKey(dayKey);
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function slotFromRecord(record?: AttendanceRecord | null): SlotDraft {
  if (!record) return { ...EMPTY_SLOT };
  return { time: timeValue(record.timestamp), recordId: record.id, notes: record.notes };
}

function buildWeek(records: AttendanceRecord[], userId: string, weekStart: string): DayDraft[] {
  return Array.from({ length: 7 }, (_, index) => {
    const dayKey = shiftDayKey(weekStart, index);
    const dayRecords = sortAttendanceAsc(
      records.filter(record => record.userId === userId && localDayKey(record.timestamp) === dayKey),
    );
    const anchors = pickDayAnchors(dayRecords);
    return {
      dayKey,
      checkIn: slotFromRecord(anchors.checkIn),
      checkOut: slotFromRecord(anchors.checkOut),
    };
  });
}

function dayLabel(day: DayDraft, index: number, labels: string[]): string {
  return `${labels[index]} ${formatShort(day.dayKey)}`;
}

function rowError(day: DayDraft, label: string, text: (typeof copy)['vi']): string | null {
  if (!day.checkIn.time && day.checkOut.time) return `${label}: ${text.needCheckIn}`;
  if (
    day.checkIn.time &&
    day.checkOut.time &&
    timestampOnDay(day.dayKey, day.checkOut.time) <= timestampOnDay(day.dayKey, day.checkIn.time)
  ) {
    return `${label}: ${text.checkOutAfter}`;
  }
  return null;
}

type DraftChange =
  | Exclude<AdminWeeklyAttendanceChange, { op: 'create' }>
  | { op: 'create'; userId: string; timestamp: number; type: AttendanceType };

function slotChange(
  base: SlotDraft,
  next: SlotDraft,
  userId: string,
  dayKey: string,
  type: AttendanceType,
): DraftChange | null {
  if (base.recordId && !next.time) return { op: 'delete', id: base.recordId };
  if (!base.recordId && next.time) {
    return { op: 'create', userId, timestamp: timestampOnDay(dayKey, next.time), type };
  }
  if (base.recordId && next.time && base.time !== next.time) {
    return { op: 'update', id: base.recordId, timestamp: timestampOnDay(dayKey, next.time), notes: base.notes };
  }
  return null;
}

function withLocation(changes: DraftChange[], location: { lat: number; lng: number }): AdminWeeklyAttendanceChange[] {
  return changes.map(change => (
    change.op === 'create' || change.op === 'update' ? { ...change, location } : change
  ));
}

function collectChanges(baseline: DayDraft[], draft: DayDraft[], userId: string): DraftChange[] {
  const changes: DraftChange[] = [];
  draft.forEach((day, index) => {
    const base = baseline[index];
    const checkIn = slotChange(base.checkIn, day.checkIn, userId, day.dayKey, AttendanceType.CHECK_IN);
    const checkOut = slotChange(base.checkOut, day.checkOut, userId, day.dayKey, AttendanceType.CHECK_OUT);
    if (checkIn) changes.push(checkIn);
    if (checkOut) changes.push(checkOut);
  });
  return changes;
}

/** Khi đã có GPS, mọi mốc vào/ra còn lại trong tuần cũng được cập nhật vị trí, kể cả ô không đổi giờ. */
function changesForWeek(baseline: DayDraft[], draft: DayDraft[], userId: string, location: { lat: number; lng: number } | null): DraftChange[] {
  const timeChanges = collectChanges(baseline, draft, userId);
  if (!location) return timeChanges;
  const covered = new Set(
    timeChanges.flatMap(change => (change.op === 'update' || change.op === 'delete' ? [change.id] : [])),
  );
  const locationUpdates: DraftChange[] = [];
  draft.forEach((day, index) => {
    const base = baseline[index];
    (['checkIn', 'checkOut'] as const).forEach(field => {
      const current = day[field];
      const original = base[field];
      if (!current.time || !original.recordId || covered.has(original.recordId)) return;
      locationUpdates.push({
        op: 'update',
        id: original.recordId,
        timestamp: timestampOnDay(day.dayKey, current.time),
        notes: original.notes,
      });
    });
  });
  return [...timeChanges, ...locationUpdates];
}

const AttendanceWeekEditor: React.FC<AttendanceWeekEditorProps> = ({
  actor,
  employees,
  records,
  language,
  initialEmployeeId,
  onClose,
  onSaved,
}) => {
  const text = copy[language];
  const staff = useMemo(
    () => employees.filter(employee => employee.role !== UserRole.ADMIN).sort((a, b) => a.name.localeCompare(b.name, 'vi')),
    [employees],
  );
  const startingEmployee = staff.some(employee => employee.id === initialEmployeeId) ? initialEmployeeId : '';
  const [employeeId, setEmployeeId] = useState(startingEmployee);
  const [weekStart, setWeekStart] = useState(() => mondayKey());
  const [baseline, setBaseline] = useState<DayDraft[]>(() => buildWeek(records, startingEmployee, mondayKey()));
  const [draft, setDraft] = useState<DayDraft[]>(() => buildWeek(records, startingEmployee, mondayKey()));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedMessage, setSavedMessage] = useState('');
  const [pendingChanges, setPendingChanges] = useState<DraftChange[] | null>(null);
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    const next = buildWeek(records, employeeId, weekStart);
    setBaseline(next);
    setDraft(next);
    setError('');
    setPendingChanges(null);
  }, [records, employeeId, weekStart]);

  useEffect(() => {
    setSavedMessage('');
  }, [employeeId, weekStart]);

  const changes = employeeId ? changesForWeek(baseline, draft, employeeId, gps) : [];
  const errors = draft.flatMap((day, index) => {
    const problem = rowError(day, dayLabel(day, index, text.days), text);
    return problem ? [problem] : [];
  });
  const weekEnd = shiftDayKey(weekStart, 6);

  const updateSlot = (dayKey: string, field: 'checkIn' | 'checkOut', time: string) => {
    setSavedMessage('');
    setDraft(current => current.map(day => (
      day.dayKey === dayKey ? { ...day, [field]: { ...day[field], time: normalizeTime(time) } } : day
    )));
  };

  const requestLocation = () => {
    if (!window.isSecureContext) {
      setError(text.gpsInsecure);
      return;
    }
    if (!navigator.geolocation) {
      setError(text.gpsUnsupported);
      return;
    }
    setLocating(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGps({ lat: position.coords.latitude, lng: position.coords.longitude });
        setLocating(false);
      },
      (gpsError) => {
        if (gpsError.code === 1) setError(text.gpsDenied);
        else if (gpsError.code === 2) setError(text.gpsUnavailable);
        else if (gpsError.code === 3) setError(text.gpsTimeout);
        else setError(text.gpsFailed);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 },
    );
  };

  const persist = async (nextChanges: DraftChange[]) => {
    const writesPunch = nextChanges.some(change => change.op === 'create' || change.op === 'update');
    if (writesPunch && !gps) {
      setError(text.needLocation);
      setPendingChanges(null);
      return;
    }
    setSaving(true);
    setError('');
    try {
      const located = gps ? withLocation(nextChanges, gps) : nextChanges as AdminWeeklyAttendanceChange[];
      await applyAdminWeeklyAttendance(actor, located);
      setPendingChanges(null);
      setSavedMessage(text.saved);
      await onSaved();
    } catch (saveError) {
      console.error('Error saving weekly attendance:', saveError);
      setError(saveError instanceof Error ? saveError.message : text.saveFailed);
      await onSaved();
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => {
    if (!employeeId || saving) return;
    if (errors.length > 0) {
      setError(errors[0]);
      return;
    }
    if (changes.length === 0) {
      setError(text.noChanges);
      return;
    }
    if (changes.some(change => change.op === 'create' || change.op === 'update') && !gps) {
      setError(text.needLocation);
      return;
    }
    if (changes.some(change => change.op === 'delete')) {
      setPendingChanges(changes);
      return;
    }
    void persist(changes);
  };

  const deleteLines = (pendingChanges ?? []).flatMap(change => {
    if (change.op !== 'delete') return [];
    const index = baseline.findIndex(day => day.checkIn.recordId === change.id || day.checkOut.recordId === change.id);
    if (index < 0) return [];
    const day = baseline[index];
    const field = day.checkIn.recordId === change.id ? text.checkIn : text.checkOut;
    return [`${dayLabel(day, index, text.days)} · ${field}`];
  });

  return (
    <div className="bg-white p-4 rounded-2xl shadow-sm border border-amber-100 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-800">{text.title}</h3>
          <p className="text-xs text-slate-500 mt-1">{text.hint}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 text-slate-600 hover:bg-slate-50"
        >
          {text.close}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-2" htmlFor="week-editor-employee">{text.employee}</label>
          <select
            id="week-editor-employee"
            value={employeeId}
            onChange={event => setEmployeeId(event.target.value)}
            disabled={saving}
            className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
          >
            <option value="">{text.chooseEmployee}</option>
            {staff.map(employee => (
              <option key={employee.id} value={employee.id}>{employee.name} — {employee.department}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-2" htmlFor="week-editor-date">{text.week}</label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setWeekStart(current => shiftDayKey(current, -7))}
              disabled={saving}
              className="px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {text.prevWeek}
            </button>
            <input
              id="week-editor-date"
              type="date"
              value={weekStart}
              onChange={event => {
                if (!event.target.value) return;
                setWeekStart(mondayKey(dateFromDayKey(event.target.value)));
              }}
              disabled={saving}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => setWeekStart(current => shiftDayKey(current, 7))}
              disabled={saving}
              className="px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {text.nextWeek}
            </button>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">{formatShort(weekStart)} – {formatShort(weekEnd)}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={requestLocation}
          disabled={saving || locating}
          className="px-4 py-2 rounded-xl text-xs font-bold border border-sky-200 text-sky-700 hover:bg-sky-50 disabled:opacity-50"
        >
          {locating ? text.locating : text.useLocation}
        </button>
        {gps && (
          <span className="text-xs text-slate-600">
            {text.locationReady}: {gps.lat.toFixed(5)}, {gps.lng.toFixed(5)}. {text.locationApplies}
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px]">
          <thead>
            <tr className="text-left text-xs font-bold text-slate-500">
              <th className="py-2 pr-3">{text.week}</th>
              <th className="py-2 pr-3">{text.checkIn}</th>
              <th className="py-2">{text.checkOut}</th>
            </tr>
          </thead>
          <tbody>
            {draft.map((day, index) => (
              <tr key={day.dayKey} className="border-t border-slate-100">
                <td className="py-2 pr-3 text-sm font-medium text-slate-700 whitespace-nowrap">
                  {dayLabel(day, index, text.days)}
                </td>
                {(['checkIn', 'checkOut'] as const).map(field => (
                  <td key={field} className="py-2 pr-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={day[field].time}
                        disabled={saving || !employeeId}
                        onChange={event => updateSlot(day.dayKey, field, event.target.value)}
                        className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm"
                        aria-label={`${dayLabel(day, index, text.days)} ${field === 'checkIn' ? text.checkIn : text.checkOut}`}
                      />
                      {day[field].time && (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => updateSlot(day.dayKey, field, '')}
                          className="text-xs font-bold text-rose-600 hover:text-rose-700 disabled:opacity-50"
                        >
                          {text.clear}
                        </button>
                      )}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {errors.length > 0 && (
        <p className="text-xs text-rose-600">{errors[0]}</p>
      )}
      {error && <p className="text-xs text-rose-600">{error}</p>}
      {savedMessage && <p className="text-xs text-emerald-700">{savedMessage}</p>}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !employeeId || changes.length === 0 || errors.length > 0}
          className="px-4 py-2 bg-amber-600 text-white rounded-xl text-xs font-bold hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? text.saving : text.save}
        </button>
      </div>

      {pendingChanges && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-5 space-y-3">
            <h4 className="text-sm font-bold text-slate-800">{text.confirmTitle}</h4>
            <p className="text-xs text-slate-500">{text.confirmBody}</p>
            <ul className="text-sm text-slate-700 space-y-1">
              {deleteLines.map(line => <li key={line}>{line}</li>)}
            </ul>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPendingChanges(null)}
                disabled={saving}
                className="px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 text-slate-700"
              >
                {text.cancel}
              </button>
              <button
                type="button"
                onClick={() => void persist(pendingChanges)}
                disabled={saving}
                className="px-3 py-2 rounded-xl text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {text.confirmDelete}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceWeekEditor;
