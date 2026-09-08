import { ShiftRegistration, OffType } from '../types';

/** Khóa UI: tháng + nhân viên (khớp 1 payroll record). */
export const payrollNoLunchKey = (month: string, userId: string) => `${month}::${userId}`;

/** Timestamp 00:00 local của ngày chứa `timestamp` — dùng để khớp ca / chấm công cùng một ngày. */
export const payrollLocalDayTs = (timestamp: number): number => {
  const d = new Date(timestamp);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

export const payrollDateSetHas = (dates: Set<number>, timestamp: number): boolean => {
  if (dates.has(timestamp)) return true;
  const dayTs = payrollLocalDayTs(timestamp);
  if (dates.has(dayTs)) return true;
  for (const stored of dates) {
    if (payrollLocalDayTs(stored) === dayTs) return true;
  }
  return false;
};

export const togglePayrollDateList = (dates: number[], timestamp: number): number[] => {
  const dayTs = payrollLocalDayTs(timestamp);
  const has = dates.some(d => d === timestamp || payrollLocalDayTs(d) === dayTs);
  if (has) {
    return dates.filter(d => d !== timestamp && payrollLocalDayTs(d) !== dayTs);
  }
  return [...dates, dayTs];
};

/**
 * Giờ thường (tối đa workHoursPerDay/ca, trừ ngày OT không hệ số thì gộp cả giờ thêm)
 * và giờ OT (phần vượt, chỉ những ngày vẫn tính hệ số OT).
 * Ca 9h không trưa → 8h thường + 1h OT (không còn bị min(9,8)=8 nuốt mất OT).
 */
export const calculateRegularAndOTHoursWithNoLunchBreak = (
  shifts: ShiftRegistration[],
  workHoursPerDay: number,
  noLunchDates: Set<number>,
  noOtRateDates: Set<number> = new Set()
): { regularHours: number; otHours: number } => {
  let regularHours = 0;
  let otHours = 0;

  shifts.forEach(shift => {
    let hours = workHoursPerDay;
    if (shift.shift === 'CUSTOM' && shift.startTime && shift.endTime) {
      const [startHour, startMin] = shift.startTime.split(':').map(Number);
      const [endHour, endMin] = shift.endTime.split(':').map(Number);
      hours = ((endHour * 60 + endMin) - (startHour * 60 + startMin)) / 60;
      if (hours >= 6 && !noLunchDates.has(shift.date)) {
        hours -= 1;
      }
      if (hours > 0) {
        if (payrollDateSetHas(noOtRateDates, shift.date)) {
          regularHours += hours;
        } else {
          regularHours += Math.min(hours, workHoursPerDay);
          otHours += Math.max(0, hours - workHoursPerDay);
        }
      }
    } else if (shift.shift === 'OFF' && shift.offType !== OffType.OFF_PN && shift.offType !== OffType.LE) {
      // OFF không lương
    } else {
      regularHours += workHoursPerDay;
    }
  });

  return { regularHours, otHours };
};

/** Tổng giờ tính lương **thường** (mỗi ca tối đa workHoursPerDay, trừ ngày OT không hệ số). */
export const calculateTotalHoursWithNoLunchBreak = (
  shifts: ShiftRegistration[],
  workHoursPerDay: number,
  noLunchDates: Set<number>,
  noOtRateDates: Set<number> = new Set()
): number => {
  const { regularHours } = calculateRegularAndOTHoursWithNoLunchBreak(
    shifts,
    workHoursPerDay,
    noLunchDates,
    noOtRateDates
  );
  return regularHours;
};

/** Tổng giờ làm (thường + OT) — để hiển thị. */
export const calculateTotalWorkedHoursWithNoLunchBreak = (
  shifts: ShiftRegistration[],
  workHoursPerDay: number,
  noLunchDates: Set<number>,
  noOtRateDates: Set<number> = new Set()
): number => {
  const { regularHours, otHours } = calculateRegularAndOTHoursWithNoLunchBreak(
    shifts,
    workHoursPerDay,
    noLunchDates,
    noOtRateDates
  );
  return regularHours + otHours;
};
