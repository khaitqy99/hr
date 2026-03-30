import { ShiftRegistration, OffType } from '../types';

/** Khóa UI: tháng + nhân viên (khớp 1 payroll record). */
export const payrollNoLunchKey = (month: string, userId: string) => `${month}::${userId}`;

/**
 * Giờ thường (tối đa workHoursPerDay/ca) và giờ OT (phần vượt sau khi xử lý trưa).
 * Ca 9h không trưa → 8h thường + 1h OT (không còn bị min(9,8)=8 nuốt mất OT).
 */
export const calculateRegularAndOTHoursWithNoLunchBreak = (
  shifts: ShiftRegistration[],
  workHoursPerDay: number,
  noLunchDates: Set<number>
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
        regularHours += Math.min(hours, workHoursPerDay);
        otHours += Math.max(0, hours - workHoursPerDay);
      }
    } else if (shift.shift === 'OFF' && shift.offType !== OffType.OFF_PN && shift.offType !== OffType.LE) {
      // OFF không lương
    } else if (shift.shift === 'OFF') {
      regularHours += workHoursPerDay;
    } else if (shift.shift !== 'OFF') {
      regularHours += workHoursPerDay;
    }
  });

  return { regularHours, otHours };
};

/** Tổng giờ tính lương **thường** (mỗi ca tối đa workHoursPerDay) — không gộp giờ OT vào cùng đơn giá. */
export const calculateTotalHoursWithNoLunchBreak = (
  shifts: ShiftRegistration[],
  workHoursPerDay: number,
  noLunchDates: Set<number>
): number => {
  const { regularHours } = calculateRegularAndOTHoursWithNoLunchBreak(shifts, workHoursPerDay, noLunchDates);
  return regularHours;
};

/** Tổng giờ làm (thường + OT) — để hiển thị. */
export const calculateTotalWorkedHoursWithNoLunchBreak = (
  shifts: ShiftRegistration[],
  workHoursPerDay: number,
  noLunchDates: Set<number>
): number => {
  const { regularHours, otHours } = calculateRegularAndOTHoursWithNoLunchBreak(shifts, workHoursPerDay, noLunchDates);
  return regularHours + otHours;
};
