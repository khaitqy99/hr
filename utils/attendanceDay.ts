import { AttendanceRecord, AttendanceType } from '../types';

export function sortAttendanceAsc(records: AttendanceRecord[]) {
  return [...records].sort((a, b) => a.timestamp - b.timestamp);
}

/** Các mốc chấm công chính trong một ngày (theo thứ tự thời gian). */
export function pickDayAnchors(sortedAsc: AttendanceRecord[]) {
  const checkIn = sortedAsc.find(r => r.type === AttendanceType.CHECK_IN) ?? null;
  const outs = sortedAsc.filter(r => r.type === AttendanceType.CHECK_OUT);
  const checkOut = outs.length ? outs[outs.length - 1]! : null;
  const lunchOut = checkIn
    ? sortedAsc.find(r => r.type === AttendanceType.LUNCH_OUT && r.timestamp >= checkIn.timestamp) ?? null
    : sortedAsc.find(r => r.type === AttendanceType.LUNCH_OUT) ?? null;
  const lunchIn =
    lunchOut != null
      ? sortedAsc.find(r => r.type === AttendanceType.LUNCH_IN && r.timestamp > lunchOut.timestamp) ?? null
      : null;
  return { checkIn, checkOut, lunchOut, lunchIn };
}

/** Giờ có mặt tại công ty (trừ khoảng nghỉ trưa nếu có chấm đủ ra/vào trưa). */
export function dayWorkedHoursGrossMinusLunch(dayRecords: AttendanceRecord[]): number {
  const asc = sortAttendanceAsc(dayRecords);
  const { checkIn, checkOut, lunchOut, lunchIn } = pickDayAnchors(asc);
  if (!checkIn || !checkOut) return 0;
  let hours = (checkOut.timestamp - checkIn.timestamp) / (1000 * 60 * 60);
  if (lunchOut && lunchIn) {
    hours -= (lunchIn.timestamp - lunchOut.timestamp) / (1000 * 60 * 60);
  }
  return Math.max(0, hours);
}
