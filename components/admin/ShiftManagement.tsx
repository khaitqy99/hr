import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ShiftRegistration, RequestStatus, User, UserRole, ShiftTime, OFF_TYPE_LABELS, Holiday, Department, OffType, EmployeeStatus, Branch, AnnualLeaveSummary, ContractType } from '../../types';
import { getShiftRegistrations, updateShiftStatus, updateShiftRegistration, registerShift, getAllUsers, getHolidays, getDepartments, getBranches, getAnnualLeaveSummary, saveShiftRegistrationSchedule, getShiftRegistrationState, getShiftRegistrationConfigHistory, sendShiftRegistrationScheduleTestPush, sendShiftRegistrationSchedulePush, type ShiftRegSchedulePushTestKind } from '../../services/db';
import { sendLocalNotification } from '../../services/push';
import { toDatetimeLocalValue, fromDatetimeLocalValue, formatShiftRegCloseLabel, type ShiftRegistrationSchedule } from '../../services/shiftRegistrationSchedule';
import { exportToCSV } from '../../utils/export';
import CustomSelect from '../CustomSelect';

const DAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const DEFAULT_IN = '09:00';
const DEFAULT_OUT = '18:00';


const TIME_OPTIONS: string[] = (() => {
  const opts: string[] = [];
  for (let h = 5; h <= 23; h++) {
    opts.push(`${String(h).padStart(2, '0')}:00`);
    if (h < 23) opts.push(`${String(h).padStart(2, '0')}:30`);
  }
  return opts;
})();



/** Lấy thứ Hai đầu tuần (0h) của một ngày */
function getWeekStart(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

/** Format date thành YYYY-MM-DD */
function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Trả về key YYYY-MM-DD từ timestamp (shift.date) */
function dateToKey(ts: number): string {
  const d = new Date(ts);
  return toDateKey(d);
}

const DAY_NAMES = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
const ISO_WEEKDAY_LABELS_VI = ['', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'CN'];
const ISO_WEEKDAY_LABELS_EN = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const SCHEDULE_TIME_OPTIONS: string[] = (() => {
  const opts: string[] = ['00:00'];
  for (let h = 0; h <= 23; h++) {
    if (h > 0) opts.push(`${String(h).padStart(2, '0')}:00`);
    opts.push(`${String(h).padStart(2, '0')}:30`);
  }
  opts.push('23:59');
  return Array.from(new Set(opts));
})();

/** Format ngày để hiển thị: "Thứ 3, 10/2/2025" */
function formatDateLabel(d: Date): string {
  return `${DAY_NAMES[d.getDay()]}, ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

function formatDateTime(ms: number, locale: string): string {
  return new Date(ms).toLocaleString(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function defaultWindowLocals(): { enable: string; disable: string } {
  const enable = new Date();
  enable.setDate(enable.getDate() + 1);
  enable.setHours(8, 0, 0, 0);
  const disable = new Date(enable);
  disable.setDate(disable.getDate() + 2);
  disable.setHours(18, 0, 0, 0);
  return {
    enable: toDatetimeLocalValue(enable.getTime()),
    disable: toDatetimeLocalValue(disable.getTime()),
  };
}

type ScheduleFormState = {
  mode: ShiftRegistrationSchedule['mode'];
  enableLocal: string;
  disableLocal: string;
  weeklyStartDay: number;
  weeklyStartTime: string;
  weeklyEndDay: number;
  weeklyEndTime: string;
};

interface ShiftManagementProps {
  onRegisterReload?: (handler: () => void | Promise<void>) => void;
  setView?: (view: string, options?: { replace?: boolean; adminPath?: string; employeeId?: string }) => void;
  language: 'vi' | 'en';
}

/** Modal từ chối: đơn (id) hoặc hàng loạt (userId) */
type RejectTarget = { type: 'single'; id: string } | { type: 'bulk'; userId: string };

const ShiftManagement: React.FC<ShiftManagementProps> = ({ onRegisterReload, setView, language }) => {
  const [shiftRequests, setShiftRequests] = useState<ShiftRegistration[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [weekStart, setWeekStart] = useState<Date>(() => getWeekStart(new Date()));
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [departmentFilter, setDepartmentFilter] = useState<string>('');
  const [branchFilter, setBranchFilter] = useState<string>('');
  const [searchName, setSearchName] = useState('');
  const [loading, setLoading] = useState(true);
  const [annualLeaveByUser, setAnnualLeaveByUser] = useState<Record<string, AnnualLeaveSummary>>({});
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [rejectTarget, setRejectTarget] = useState<RejectTarget | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  /** Chi tiết ô được chọn: nhân viên + ngày (có hoặc không có đăng ký) */
  const [cellDetail, setCellDetail] = useState<{ user: User; date: Date; reg: ShiftRegistration | undefined } | null>(null);
  /** Chế độ modal: view | edit (đổi lịch) | add (thêm ca) */
  const [cellEditMode, setCellEditMode] = useState<'view' | 'edit' | 'add'>('view');
  /** Form đổi/thêm ca: Admin sửa lịch cho nhân viên */
  const [editForm, setEditForm] = useState<{
    shift: ShiftTime;
    startTime: string;
    endTime: string;
    offType: OffType;
  }>({ shift: ShiftTime.CUSTOM, startTime: '09:00', endTime: '18:00', offType: OffType.OFF_PN });
  const [cellActionLoading, setCellActionLoading] = useState(false);
  const [shiftRegEnabled, setShiftRegEnabled] = useState(true);
  const [shiftRegSchedule, setShiftRegSchedule] = useState<ShiftRegistrationSchedule>({ mode: 'manual' });
  const [shiftRegNextChangeAt, setShiftRegNextChangeAt] = useState<number | null>(null);
  const [shiftRegNextChangeEnabled, setShiftRegNextChangeEnabled] = useState<boolean | null>(null);
  const [shiftRegToggleLoading, setShiftRegToggleLoading] = useState(false);
  const [showConfigHistory, setShowConfigHistory] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [scheduleForm, setScheduleForm] = useState<ScheduleFormState>(() => {
    const defaults = defaultWindowLocals();
    return {
      mode: 'manual',
      enableLocal: defaults.enable,
      disableLocal: defaults.disable,
      weeklyStartDay: 5,
      weeklyStartTime: '08:00',
      weeklyEndDay: 7,
      weeklyEndTime: '23:00',
    };
  });
  const [configHistory, setConfigHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [schedulePushTesting, setSchedulePushTesting] = useState<ShiftRegSchedulePushTestKind | null>(null);
  const [schedulePushFeedback, setSchedulePushFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const t = {
    vi: {
      week: 'Tuần',
      prev: '← Trước',
      thisWeek: 'Tuần này',
      next: 'Sau →',
      pending: 'Chờ',
      approved: 'Đã duyệt',
      rejected: 'Từ chối',
      filter: 'Lọc',
      allDepartments: 'Tất cả bộ phận',
      allBranches: 'Tất cả chi nhánh',
      searchByName: 'Tìm theo tên...',
      goToPayroll: 'Tính lương',
      exportCSV: 'Xuất CSV',
      pendingRequests: 'đăng ký chờ duyệt của nhân viên này trong tuần.',
      approveAll: 'Duyệt tất cả',
      rejectAll: 'Từ chối tất cả',
      loading: 'Đang tải...',
      employee: 'Nhân viên',
      department: 'Bộ phận',
      checkIn: 'Vào',
      checkOut: 'Ra',
      noEmployees: 'Không có nhân viên nào.',
      approve: 'Duyệt',
      reject: 'Từ chối',
      dayOff: 'Ngày off',
      pendingStatus: 'Chờ duyệt',
      approvedStatus: 'Đã duyệt',
      rejectedStatus: 'Từ chối',
      dayDetail: 'Chi tiết ngày',
      editSchedule: 'Đổi lịch',
      addShift: 'Thêm ca',
      status: 'Trạng thái',
      type: 'Loại',
      timeIn: 'Giờ vào',
      timeOut: 'Giờ ra',
      registrationReason: 'Lý do đăng ký',
      rejectionReason: 'Lý do từ chối',
      close: 'Đóng',
      workShift: 'Ca làm',
      offDay: 'Ngày off',
      offType: 'Loại off',
      selectOffType: 'Chọn loại off',
      selectTimeIn: 'Chọn giờ vào',
      selectTimeOut: 'Chọn giờ ra',
      save: 'Lưu',
      saving: 'Đang lưu...',
      cancel: 'Hủy',
      noRegistration: 'Chưa đăng ký ca cho ngày này.',
      rejectReasonTitle: 'Lý do từ chối',
      rejectReasonDesc: 'Nhập lý do từ chối đăng ký ca này. Nhân viên sẽ xem được lý do.',
      rejectReasonBulkDesc: 'Nhập lý do từ chối (áp dụng cho tất cả đăng ký đang chờ trong tuần).',
      rejectReasonPlaceholder: 'Ví dụ: Thiếu thông tin, không đúng quy định...',
      confirmReject: 'Xác nhận từ chối',
      approvedMsg: 'Đã chấp thuận.',
      approvedBulkMsg: 'Đã chấp thuận {count} đăng ký.',
      rejectedMsg: 'Đã từ chối.',
      rejectedBulkMsg: 'Đã từ chối {count} đăng ký.',
      updateFailed: 'Cập nhật thất bại. Thử lại.',
      loadFailed: 'Không tải được dữ liệu. Thử lại sau.',
      scheduleUpdated: 'Đã cập nhật lịch.',
      shiftAdded: 'Đã thêm ca cho nhân viên.',
      actionFailed: 'Thao tác thất bại. Thử lại.',
      noDataToExport: 'Không có dữ liệu để xuất',
      exportEmployee: 'Nhân viên',
      exportDepartment: 'Phòng ban',
      exportDate: 'Ngày',
      exportShiftType: 'Loại ca',
      exportWorkShift: 'Ca làm việc',
      exportTimeIn: 'Giờ vào',
      exportTimeOut: 'Giờ ra',
      exportStatus: 'Trạng thái',
      exportRejectionReason: 'Lý do từ chối',
      exportCreatedDate: 'Ngày tạo',
      nationalHoliday: 'Ngày lễ quốc gia',
      companyHoliday: 'Ngày lễ công ty',
      localHoliday: 'Ngày lễ địa phương',
      recurringYearly: 'Lặp lại hàng năm',
      annualLeave: 'Phép năm',
      annualLeaveRemaining: 'Còn',
      annualLeaveUsed: 'Đã dùng',
      annualLeaveDaysInYear: 'Ngày phép năm trong năm',
      noAnnualLeaveInYear: 'Năm này chưa có đăng ký phép năm.',
      selectedEmployee: 'Nhân viên đang chọn',
      shiftRegToggle: 'Đăng ký ca (NV)',
      shiftRegSegmentOn: 'Bật',
      shiftRegSegmentOff: 'Tắt',
      shiftRegOn: 'Đang mở — nhân viên có thể đăng ký/sửa ca',
      shiftRegOff: 'Đang khóa — chỉ admin gán/sửa ca',
      shiftRegUpdated: 'Đã cập nhật cài đặt đăng ký ca.',
      shiftRegUpdateFailed: 'Không lưu được cài đặt. Thử lại.',
      scheduleBtn: 'Lịch',
      scheduleTitle: 'Lịch bật/tắt đăng ký ca',
      scheduleHelp: 'Trong khung giờ NV mới đăng ký được. Bật/Tắt tay sẽ hủy lịch.',
      scheduleModeManual: 'Thủ công',
      scheduleModeWindow: 'Một lần',
      scheduleModeWeekly: 'Hàng tuần',
      scheduleEnableAt: 'Bật lúc',
      scheduleDisableAt: 'Tắt lúc',
      scheduleWeeklyStart: 'Bắt đầu',
      scheduleWeeklyEnd: 'Kết thúc',
      schedulePushHint: 'Thủ công: gửi khi bấm Bật. Một lần và hàng tuần: gửi lúc mở và trước khi đóng 30 phút. Nút thử chỉ gửi cho tài khoản đang đăng nhập.',
      schedulePushTestOpen: 'Thử: đã mở',
      schedulePushTestClose: 'Thử: sắp đóng',
      schedulePushTestOk: 'Đã gửi thử. Kiểm tra chuông app / thông báo máy.',
      schedulePushTestFail: 'Không gửi được thử. Thử lại.',
      scheduleSave: 'Lưu lịch',
      scheduleClear: 'Xóa lịch',
      scheduleSaved: 'Đã lưu lịch bật/tắt đăng ký ca.',
      scheduleCleared: 'Đã chuyển về bật/tắt thủ công.',
      scheduleInvalidWindow: 'Giờ tắt phải sau giờ bật.',
      scheduleInvalidWeekly: 'Khung giờ trong tuần không hợp lệ.',
      scheduleNextOn: 'Sẽ bật',
      scheduleNextOff: 'Sẽ tắt',
      scheduleExpired: 'Lịch đã hết hạn — đang khóa',
      scheduleSummaryWeekly: 'Hàng tuần',
      scheduleSummaryWindow: 'Tự động',
      registeredAt: 'Thời gian đăng ký',
      lastUpdated: 'Cập nhật lần cuối',
      reviewedAt: 'Thời gian duyệt',
      reviewedBy: 'Người duyệt',
      reviewedAtUnknown: 'Chưa ghi nhận (ca duyệt trước khi hệ thống lưu thời điểm)',
      history: 'Lịch sử',
      viewHistory: 'Xem lịch sử',
      configHistory: 'Lịch sử bật/tắt đăng ký ca',
      enabled: 'Bật',
      disabled: 'Tắt',
      changedBy: 'Thay đổi bởi',
      changedAt: 'Thời gian',
      noHistory: 'Chưa có lịch sử thay đổi',
    },
    en: {
      week: 'Week',
      prev: '← Prev',
      thisWeek: 'This Week',
      next: 'Next →',
      pending: 'Pending',
      approved: 'Approved',
      rejected: 'Rejected',
      filter: 'Filter',
      allDepartments: 'All Departments',
      allBranches: 'All Branches',
      searchByName: 'Search by name...',
      goToPayroll: 'Go to Payroll',
      exportCSV: 'Export CSV',
      pendingRequests: 'pending requests for this employee this week.',
      approveAll: 'Approve All',
      rejectAll: 'Reject All',
      loading: 'Loading...',
      employee: 'Employee',
      department: 'Department',
      checkIn: 'In',
      checkOut: 'Out',
      noEmployees: 'No employees.',
      approve: 'Approve',
      reject: 'Reject',
      dayOff: 'Day Off',
      pendingStatus: 'Pending',
      approvedStatus: 'Approved',
      rejectedStatus: 'Rejected',
      dayDetail: 'Day Details',
      editSchedule: 'Edit Schedule',
      addShift: 'Add Shift',
      status: 'Status',
      type: 'Type',
      timeIn: 'Time In',
      timeOut: 'Time Out',
      registrationReason: 'Registration Reason',
      rejectionReason: 'Rejection Reason',
      close: 'Close',
      workShift: 'Work Shift',
      offDay: 'Day Off',
      offType: 'Off Type',
      selectOffType: 'Select off type',
      selectTimeIn: 'Select time in',
      selectTimeOut: 'Select time out',
      save: 'Save',
      saving: 'Saving...',
      cancel: 'Cancel',
      noRegistration: 'No shift registered for this day.',
      rejectReasonTitle: 'Rejection Reason',
      rejectReasonDesc: 'Enter the reason for rejecting this shift registration. The employee will see this reason.',
      rejectReasonBulkDesc: 'Enter rejection reason (applies to all pending registrations this week).',
      rejectReasonPlaceholder: 'E.g., Missing information, does not comply with regulations...',
      confirmReject: 'Confirm Rejection',
      approvedMsg: 'Approved.',
      approvedBulkMsg: 'Approved {count} registrations.',
      rejectedMsg: 'Rejected.',
      rejectedBulkMsg: 'Rejected {count} registrations.',
      updateFailed: 'Update failed. Try again.',
      loadFailed: 'Failed to load data. Try again later.',
      scheduleUpdated: 'Schedule updated.',
      shiftAdded: 'Shift added for employee.',
      actionFailed: 'Action failed. Try again.',
      noDataToExport: 'No data to export',
      exportEmployee: 'Employee',
      exportDepartment: 'Department',
      exportDate: 'Date',
      exportShiftType: 'Shift Type',
      exportWorkShift: 'Work Shift',
      exportTimeIn: 'Time In',
      exportTimeOut: 'Time Out',
      exportStatus: 'Status',
      exportRejectionReason: 'Rejection Reason',
      exportCreatedDate: 'Created Date',
      nationalHoliday: 'National Holiday',
      companyHoliday: 'Company Holiday',
      localHoliday: 'Local Holiday',
      recurringYearly: 'Recurring Yearly',
      annualLeave: 'Annual Leave',
      annualLeaveRemaining: 'Remaining',
      annualLeaveUsed: 'Used',
      annualLeaveDaysInYear: 'Annual leave days in year',
      noAnnualLeaveInYear: 'No annual leave registered in this year.',
      selectedEmployee: 'Selected employee',
      shiftRegToggle: 'Shift signup (employees)',
      shiftRegSegmentOn: 'On',
      shiftRegSegmentOff: 'Off',
      shiftRegOn: 'Open — employees can register or change shifts',
      shiftRegOff: 'Locked — only admins can assign shifts',
      shiftRegUpdated: 'Shift registration setting updated.',
      shiftRegUpdateFailed: 'Could not save setting. Try again.',
      scheduleBtn: 'Schedule',
      scheduleTitle: 'Shift signup on/off schedule',
      scheduleHelp: 'Employees can sign up only inside the window. Manual On/Off clears it.',
      scheduleModeManual: 'Manual',
      scheduleModeWindow: 'Once',
      scheduleModeWeekly: 'Weekly',
      scheduleEnableAt: 'Turn on at',
      scheduleDisableAt: 'Turn off at',
      scheduleWeeklyStart: 'Starts',
      scheduleWeeklyEnd: 'Ends',
      schedulePushHint: 'Manual: sends when you tap On. Once/weekly: sends at open and 30 minutes before close. Test buttons only notify the signed-in account.',
      schedulePushTestOpen: 'Test: opened',
      schedulePushTestClose: 'Test: closing soon',
      schedulePushTestOk: 'Test sent. Check the app bell / device banner.',
      schedulePushTestFail: 'Could not send the test. Try again.',
      scheduleSave: 'Save schedule',
      scheduleClear: 'Clear schedule',
      scheduleSaved: 'Shift signup schedule saved.',
      scheduleCleared: 'Switched back to manual on/off.',
      scheduleInvalidWindow: 'Turn-off time must be after turn-on time.',
      scheduleInvalidWeekly: 'Weekly window is invalid.',
      scheduleNextOn: 'Turns on',
      scheduleNextOff: 'Turns off',
      scheduleExpired: 'Schedule ended — currently locked',
      scheduleSummaryWeekly: 'Weekly',
      scheduleSummaryWindow: 'Automatic',
      registeredAt: 'Registered at',
      lastUpdated: 'Last updated',
      reviewedAt: 'Reviewed at',
      reviewedBy: 'Reviewed by',
      reviewedAtUnknown: 'Not recorded (approved before review tracking)',
      history: 'History',
      viewHistory: 'View history',
      configHistory: 'Shift registration config history',
      enabled: 'Enabled',
      disabled: 'Disabled',
      changedBy: 'Changed by',
      changedAt: 'Changed at',
      noHistory: 'No history yet',
    }
  };

  const text = t[language];

  const applyShiftRegState = (state: Awaited<ReturnType<typeof getShiftRegistrationState>>) => {
    setShiftRegEnabled(state.enabled);
    setShiftRegSchedule(state.schedule);
    setShiftRegNextChangeAt(state.nextChangeAt);
    setShiftRegNextChangeEnabled(state.nextChangeEnabled);
  };

  const loadShiftRegistrationSetting = async () => {
    try {
      applyShiftRegState(await getShiftRegistrationState());
    } catch {
      setShiftRegEnabled(true);
      setShiftRegSchedule({ mode: 'manual' });
      setShiftRegNextChangeAt(null);
      setShiftRegNextChangeEnabled(null);
    }
  };

  const weekdayLabel = (isoDay: number) =>
    (language === 'vi' ? ISO_WEEKDAY_LABELS_VI : ISO_WEEKDAY_LABELS_EN)[isoDay] || String(isoDay);

  const weekdayShort = (isoDay: number) => DAY_LABELS[isoDay - 1] || String(isoDay);

  const formatCompactDateTime = (ms: number): string => {
    const d = new Date(ms);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())} ${d.getDate()}/${d.getMonth() + 1}`;
  };

  const formatScheduleSummary = (schedule: ShiftRegistrationSchedule): string | null => {
    if (schedule.mode === 'window') {
      const from = schedule.enableAt ? formatCompactDateTime(schedule.enableAt) : '—';
      const to = schedule.disableAt ? formatCompactDateTime(schedule.disableAt) : '—';
      return `${from}–${to}`;
    }
    if (schedule.mode === 'weekly' && schedule.weekly) {
      const w = schedule.weekly;
      return `${weekdayShort(w.startDay)} ${w.startTime}–${weekdayShort(w.endDay)} ${w.endTime}`;
    }
    return null;
  };

  const scheduleHint = (() => {
    if (shiftRegSchedule.mode === 'manual') return text.scheduleTitle;
    const summary = formatScheduleSummary(shiftRegSchedule) || '';
    if (shiftRegNextChangeAt) {
      const when = formatCompactDateTime(shiftRegNextChangeAt);
      return `${summary} · ${shiftRegNextChangeEnabled ? text.scheduleNextOn : text.scheduleNextOff} ${when}`;
    }
    if (shiftRegSchedule.mode === 'window' && !shiftRegEnabled) return `${summary} · ${text.scheduleExpired}`;
    return summary;
  })();

  const handleShiftRegistrationChange = async (next: boolean) => {
    if (shiftRegToggleLoading || next === shiftRegEnabled) return;
    setShiftRegToggleLoading(true);
    setMessage(null);
    try {
      const hadSchedule = shiftRegSchedule.mode !== 'manual';
      const reason = language === 'vi'
        ? (hadSchedule
          ? (next ? 'Hủy lịch tự động — mở đăng ký ca thủ công' : 'Hủy lịch tự động — khóa đăng ký ca thủ công')
          : (next ? 'Mở lại đăng ký ca cho nhân viên' : 'Tạm khóa đăng ký ca để điều chỉnh lịch'))
        : (hadSchedule
          ? (next ? 'Cleared auto schedule — opened signup manually' : 'Cleared auto schedule — locked signup manually')
          : (next ? 'Reopened shift registration for employees' : 'Temporarily locked shift registration for schedule adjustment'));
      const state = await saveShiftRegistrationSchedule(
        { mode: 'manual' },
        { enabled: next, reason }
      );
      applyShiftRegState(state);
      showMsg('success', hadSchedule ? text.scheduleCleared : text.shiftRegUpdated);
      if (next) {
        void sendShiftRegistrationSchedulePush('open').catch(err => {
          console.error('Error sending shift registration open push:', err);
        });
      }
      await loadConfigHistory();
    } catch (err) {
      console.error('Error updating shift registration setting:', err);
      showMsg('error', text.shiftRegUpdateFailed);
    } finally {
      setShiftRegToggleLoading(false);
    }
  };

  const openScheduleModal = () => {
    const defaults = defaultWindowLocals();
    setScheduleForm({
      mode: shiftRegSchedule.mode,
      enableLocal: shiftRegSchedule.enableAt ? toDatetimeLocalValue(shiftRegSchedule.enableAt) : defaults.enable,
      disableLocal: shiftRegSchedule.disableAt ? toDatetimeLocalValue(shiftRegSchedule.disableAt) : defaults.disable,
      weeklyStartDay: shiftRegSchedule.weekly?.startDay ?? 5,
      weeklyStartTime: shiftRegSchedule.weekly?.startTime ?? '08:00',
      weeklyEndDay: shiftRegSchedule.weekly?.endDay ?? 7,
      weeklyEndTime: shiftRegSchedule.weekly?.endTime ?? '23:00',
    });
    setScheduleError(null);
    setSchedulePushFeedback(null);
    setShowScheduleModal(true);
  };

  const handleSaveSchedule = async () => {
    if (scheduleSaving) return;
    setScheduleSaving(true);
    setScheduleError(null);
    setMessage(null);
    try {
      let nextSchedule: ShiftRegistrationSchedule = { mode: 'manual' };
      let reason: string;
      const locale = language === 'vi' ? 'vi-VN' : 'en-US';
      if (scheduleForm.mode === 'window') {
        const enableAt = fromDatetimeLocalValue(scheduleForm.enableLocal);
        const disableAt = fromDatetimeLocalValue(scheduleForm.disableLocal);
        nextSchedule = { mode: 'window', enableAt, disableAt, weekly: null };
        if (enableAt != null && disableAt != null && enableAt >= disableAt) {
          setScheduleError(text.scheduleInvalidWindow);
          return;
        }
        reason = language === 'vi'
          ? `Đặt lịch khung giờ: bật ${enableAt ? formatDateTime(enableAt, locale) : '—'} — tắt ${disableAt ? formatDateTime(disableAt, locale) : '—'}`
          : `Set one-time window: on ${enableAt ? formatDateTime(enableAt, locale) : '—'} — off ${disableAt ? formatDateTime(disableAt, locale) : '—'}`;
      } else if (scheduleForm.mode === 'weekly') {
        nextSchedule = {
          mode: 'weekly',
          weekly: {
            startDay: scheduleForm.weeklyStartDay,
            startTime: scheduleForm.weeklyStartTime,
            endDay: scheduleForm.weeklyEndDay,
            endTime: scheduleForm.weeklyEndTime,
          },
          enableAt: null,
          disableAt: null,
        };
        const w = nextSchedule.weekly!;
        reason = language === 'vi'
          ? `Đặt lịch hàng tuần: ${weekdayLabel(w.startDay)} ${w.startTime} → ${weekdayLabel(w.endDay)} ${w.endTime}`
          : `Set weekly window: ${weekdayLabel(w.startDay)} ${w.startTime} → ${weekdayLabel(w.endDay)} ${w.endTime}`;
      } else {
        reason = language === 'vi' ? 'Chuyển về bật/tắt thủ công' : 'Switched to manual on/off';
      }
      const wasEnabled = shiftRegEnabled;
      const state = await saveShiftRegistrationSchedule(nextSchedule, { reason });
      applyShiftRegState(state);
      setShowScheduleModal(false);
      showMsg('success', scheduleForm.mode === 'manual' ? text.scheduleCleared : text.scheduleSaved);
      if (scheduleForm.mode !== 'manual' && !wasEnabled && state.enabled) {
        void sendShiftRegistrationSchedulePush('open').catch(err => {
          console.error('Error sending shift registration open push:', err);
        });
      }
      await loadConfigHistory();
    } catch (err) {
      const code = err instanceof Error ? err.message : '';
      if (code === 'window-order' || code === 'missing-window') {
        setScheduleError(text.scheduleInvalidWindow);
      } else if (code === 'weekly-same' || code === 'weekly-time' || code === 'weekly-day' || code === 'missing-weekly') {
        setScheduleError(text.scheduleInvalidWeekly);
      } else {
        setScheduleError(text.shiftRegUpdateFailed);
      }
    } finally {
      setScheduleSaving(false);
    }
  };

  const handleTestSchedulePush = async (kind: ShiftRegSchedulePushTestKind) => {
    if (schedulePushTesting || scheduleSaving) return;
    setSchedulePushTesting(kind);
    setSchedulePushFeedback(null);
    setScheduleError(null);
    try {
      const closeLabel = kind === 'close_warn'
        ? (shiftRegNextChangeAt && shiftRegNextChangeEnabled === false
          ? formatShiftRegCloseLabel(shiftRegNextChangeAt)
          : scheduleForm.mode === 'window' && scheduleForm.disableLocal
            ? formatShiftRegCloseLabel(fromDatetimeLocalValue(scheduleForm.disableLocal) || Date.now())
            : scheduleForm.mode === 'weekly'
              ? `${weekdayShort(scheduleForm.weeklyEndDay)} ${scheduleForm.weeklyEndTime}`
              : null)
        : null;
      const created = await sendShiftRegistrationScheduleTestPush(kind, closeLabel);
      try {
        await sendLocalNotification({
          title: created.title,
          body: created.message,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          tag: `shift-reg-test-${kind}-${created.id}`,
          data: { type: created.type, notificationId: created.id },
        });
      } catch {
        // Máy này chưa cấp quyền — insert DB vẫn kích hoạt web push trên máy đã đăng ký.
      }
      setSchedulePushFeedback({ type: 'success', text: text.schedulePushTestOk });
    } catch {
      setSchedulePushFeedback({ type: 'error', text: text.schedulePushTestFail });
    } finally {
      setSchedulePushTesting(null);
    }
  };

  const loadConfigHistory = async () => {
    setLoadingHistory(true);
    try {
      const history = await getShiftRegistrationConfigHistory(50);
      setConfigHistory(history);
    } catch (error) {
      console.error('Error loading config history:', error);
      setConfigHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleViewHistory = () => {
    setShowConfigHistory(true);
    loadConfigHistory();
  };

  useEffect(() => {
    loadData();
    loadHolidays();
    loadDepartments();
    loadShiftRegistrationSetting();
  }, []);

  useEffect(() => {
    if (onRegisterReload) {
      onRegisterReload(loadData);
    }
  }, [onRegisterReload]);

  useEffect(() => {
    if (!showConfigHistory && !showScheduleModal) return;
    const prevBody = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevBody;
    };
  }, [showConfigHistory, showScheduleModal]);

  useEffect(() => {
    if (shiftRegNextChangeAt == null) return;
    const delay = Math.min(Math.max(shiftRegNextChangeAt - Date.now() + 300, 800), 2147483647);
    const id = window.setTimeout(() => {
      void loadShiftRegistrationSetting();
    }, delay);
    return () => window.clearTimeout(id);
  }, [shiftRegNextChangeAt]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') void loadShiftRegistrationSetting();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  const loadData = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const [shifts, users, branchesData] = await Promise.all([
        getShiftRegistrations(undefined, UserRole.ADMIN),
        getAllUsers(),
        getBranches(),
      ]);
      const currentYear = new Date().getFullYear();
      const activeUsers = users.filter(u => u.status !== EmployeeStatus.LEFT);
      const leaveSummaries = await Promise.all(
        activeUsers.map(async user => ({
          userId: user.id,
          summary: await getAnnualLeaveSummary(user.id, currentYear),
        }))
      );
      const summaryMap: Record<string, AnnualLeaveSummary> = {};
      leaveSummaries.forEach(item => {
        summaryMap[item.userId] = item.summary;
      });
      setShiftRequests(shifts);
      setEmployees(users);
      setBranches(branchesData.filter(b => b.isActive));
      setAnnualLeaveByUser(summaryMap);
    } catch (e) {
      setMessage({ type: 'error', text: text.loadFailed });
    } finally {
      setLoading(false);
    }
  };

  const loadHolidays = async () => {
    try {
      const allHolidays = await getHolidays();
      setHolidays(allHolidays);
    } catch (e) {
      console.error('Error loading holidays:', e);
    }
  };

  const loadDepartments = async () => {
    try {
      const allDepartments = await getDepartments();
      setDepartments(allDepartments.filter(d => d.isActive)); // Chỉ lấy phòng ban đang hoạt động
    } catch (e) {
      console.error('Error loading departments:', e);
    }
  };

  const showMsg = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleAction = async (id: string, status: RequestStatus) => {
    if (status === RequestStatus.REJECTED) {
      setRejectTarget({ type: 'single', id });
      setRejectReason('');
      return;
    }
    setActionLoadingId(id);
    setMessage(null);
    try {
      await updateShiftStatus(id, status);
      await loadData();
      showMsg('success', text.approvedMsg);
    } catch (e) {
      showMsg('error', text.updateFailed);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleBulkAction = async (userId: string, status: RequestStatus) => {
    if (status === RequestStatus.REJECTED) {
      setRejectTarget({ type: 'bulk', userId });
      setRejectReason('');
      return;
    }
    const pendingInWeek = shiftRequests.filter(
      (r) =>
        r.userId === userId &&
        r.status === RequestStatus.PENDING &&
        weekDateKeys.has(dateToKey(r.date))
    );
    if (pendingInWeek.length === 0) return;
    setActionLoadingId(`bulk-${userId}`);
    setMessage(null);
    try {
      for (const r of pendingInWeek) {
        await updateShiftStatus(r.id, status);
      }
      await loadData();
      showMsg('success', text.approvedBulkMsg.replace('{count}', String(pendingInWeek.length)));
    } catch (e) {
      showMsg('error', text.updateFailed);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectTarget) return;
    const reason = rejectReason.trim() || 'Không nêu lý do';
    if (rejectTarget.type === 'single') {
      setActionLoadingId(rejectTarget.id);
      setMessage(null);
      try {
        await updateShiftStatus(rejectTarget.id, RequestStatus.REJECTED, reason);
        await loadData();
        showMsg('success', text.rejectedMsg);
      } catch (e) {
        showMsg('error', text.updateFailed);
      } finally {
        setActionLoadingId(null);
      }
    } else {
      const pendingInWeek = shiftRequests.filter(
        (r) =>
          r.userId === rejectTarget.userId &&
          r.status === RequestStatus.PENDING &&
          weekDateKeys.has(dateToKey(r.date))
      );
      setActionLoadingId(`bulk-${rejectTarget.userId}`);
      setMessage(null);
      try {
        for (const r of pendingInWeek) {
          await updateShiftStatus(r.id, RequestStatus.REJECTED, reason);
        }
        await loadData();
        showMsg('success', text.rejectedBulkMsg.replace('{count}', String(pendingInWeek.length)));
      } catch (e) {
        showMsg('error', text.updateFailed);
      } finally {
        setActionLoadingId(null);
      }
    }
    setRejectTarget(null);
    setRejectReason('');
  };

  const weekDates = useMemo(() => {
    const start = getWeekStart(weekStart);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [weekStart]);

  const shiftByUserDate = useMemo(() => {
    const map = new Map<string, ShiftRegistration>();
    shiftRequests.forEach((s) => {
      const key = `${s.userId}_${dateToKey(s.date)}`;
      map.set(key, s);
    });
    return map;
  }, [shiftRequests]);

  const getShiftFor = (userId: string, date: Date): ShiftRegistration | undefined => {
    return shiftByUserDate.get(`${userId}_${toDateKey(date)}`);
  };

  const prevWeek = () => {
    const next = new Date(weekStart);
    next.setDate(next.getDate() - 7);
    setWeekStart(getWeekStart(next));
  };

  const nextWeek = () => {
    const next = new Date(weekStart);
    next.setDate(next.getDate() + 7);
    setWeekStart(getWeekStart(next));
  };

  const goToToday = () => {
    setWeekStart(getWeekStart(new Date()));
  };

  const weekDateKeys = useMemo(
    () => new Set(weekDates.map((d) => toDateKey(d))),
    [weekDates]
  );

  /** Hiển thị tất cả nhân viên (lọc bộ phận + tìm tên), thao tác duyệt/từ chối trên lưới */
  const gridEmployees = useMemo(() => {
    return employees
      .filter((u) => u.role === UserRole.EMPLOYEE || u.role === UserRole.MANAGER || u.role === UserRole.HR)
      .filter((u) => u.status !== EmployeeStatus.LEFT) // Lọc bỏ nhân viên đã nghỉ việc
      .filter((u) => !departmentFilter || u.department === departmentFilter)
      .filter((u) => !branchFilter || u.branchId === branchFilter)
      .filter((u) => !searchName.trim() || u.name.toLowerCase().includes(searchName.trim().toLowerCase()));
  }, [employees, departmentFilter, branchFilter, searchName]);

  // Sử dụng departments từ bảng departments thay vì từ employees
  const departmentOptions = useMemo(
    () => departments.map(d => d.name).sort(),
    [departments]
  );

  const weekStats = useMemo(() => {
    let pending = 0, approved = 0, rejected = 0;
    shiftRequests.forEach((s) => {
      if (!weekDateKeys.has(dateToKey(s.date))) return;
      if (s.status === RequestStatus.PENDING) pending++;
      else if (s.status === RequestStatus.APPROVED) approved++;
      else rejected++;
    });
    return { pending, approved, rejected };
  }, [shiftRequests, weekDateKeys]);

  const selectedEmployeePendingCount = useMemo(() => {
    if (!selectedUserId) return 0;
    return shiftRequests.filter(
      (r) =>
        r.userId === selectedUserId &&
        r.status === RequestStatus.PENDING &&
        weekDateKeys.has(dateToKey(r.date))
    ).length;
  }, [selectedUserId, shiftRequests, weekDateKeys]);

  const selectedEmployee = useMemo(
    () => employees.find((u) => u.id === selectedUserId) || null,
    [employees, selectedUserId]
  );

  const selectedEmployeeAnnualLeaveInYear = useMemo(() => {
    if (!selectedUserId) return [];
    const selectedYear = weekStart.getFullYear();
    return shiftRequests
      .filter((r) => r.userId === selectedUserId)
      .filter((r) => new Date(r.date).getFullYear() === selectedYear)
      .filter((r) => r.shift === ShiftTime.OFF && r.offType === OffType.OFF_PN)
      .sort((a, b) => a.date - b.date);
  }, [selectedUserId, shiftRequests, weekStart]);

  const weekRangeLabel = useMemo(() => {
    const start = weekDates[0];
    const end = weekDates[6];
    if (!start || !end) return '';
    return `${start.getDate()}/${start.getMonth() + 1} – ${end.getDate()}/${end.getMonth() + 1}/${end.getFullYear()}`;
  }, [weekDates]);

  /** Kiểm tra xem một ngày có phải là ngày lễ không */
  const getHolidayForDate = (date: Date): Holiday | null => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();

    for (const holiday of holidays) {
      const holidayDate = new Date(holiday.date);
      const holidayYear = holidayDate.getFullYear();
      const holidayMonth = holidayDate.getMonth();
      const holidayDay = holidayDate.getDate();

      // Kiểm tra ngày lễ cố định hoặc ngày lễ lặp lại hàng năm
      if (holiday.isRecurring) {
        // Ngày lễ lặp lại: chỉ cần khớp tháng và ngày
        if (holidayMonth === month && holidayDay === day) {
          return holiday;
        }
      } else {
        // Ngày lễ cố định: phải khớp cả năm, tháng, ngày
        if (holidayYear === year && holidayMonth === month && holidayDay === day) {
          return holiday;
        }
      }
    }
    return null;
  };

  // Lấy shifts trong tuần hiện tại với filter
  const getShiftsInWeek = useMemo(() => {
    return shiftRequests.filter(s => weekDateKeys.has(dateToKey(s.date)))
      .filter(s => {
        if (!departmentFilter) return true;
        const emp = employees.find(e => e.id === s.userId);
        return emp?.department === departmentFilter;
      })
      .filter(s => {
        if (!searchName.trim()) return true;
        const emp = employees.find(e => e.id === s.userId);
        return emp?.name.toLowerCase().includes(searchName.trim().toLowerCase());
      });
  }, [shiftRequests, weekDateKeys, departmentFilter, searchName, employees]);

  const enterEditMode = (reg: ShiftRegistration) => {
    setCellEditMode('edit');
    setEditForm({
      shift: reg.shift,
      startTime: reg.shift === ShiftTime.CUSTOM && reg.startTime ? reg.startTime : '09:00',
      endTime: reg.shift === ShiftTime.CUSTOM && reg.endTime ? reg.endTime : '18:00',
      offType: reg.offType || OffType.OFF_PN,
    });
  };

  const enterAddMode = () => {
    setCellEditMode('add');
    setEditForm({
      shift: ShiftTime.CUSTOM,
      startTime: '09:00',
      endTime: '18:00',
      offType: OffType.OFF_PN,
    });
  };

  const exitCellEdit = () => {
    setCellEditMode('view');
  };

  const isEditFormValid = (): boolean => {
    if (editForm.shift === ShiftTime.OFF) return true;
    return !!editForm.startTime && !!editForm.endTime;
  };

  const handleSaveEdit = async () => {
    if (!cellDetail || !isEditFormValid()) return;
    setCellActionLoading(true);
    setMessage(null);
    try {
      if (cellEditMode === 'edit' && cellDetail.reg) {
        await updateShiftRegistration(cellDetail.reg.id, {
          shift: editForm.shift,
          startTime: editForm.shift === ShiftTime.CUSTOM ? editForm.startTime : null,
          endTime: editForm.shift === ShiftTime.CUSTOM ? editForm.endTime : null,
          offType: editForm.shift === ShiftTime.OFF ? editForm.offType : null,
        }, { keepStatus: true });
        showMsg('success', text.scheduleUpdated);
      } else if (cellEditMode === 'add') {
        const [y, m, d] = [
          cellDetail.date.getFullYear(),
          cellDetail.date.getMonth(),
          cellDetail.date.getDate(),
        ];
        const dateTs = new Date(y, m, d, 0, 0, 0, 0).getTime();
        const newShift: ShiftRegistration = {
          id: `admin-${Date.now()}`,
          userId: cellDetail.user.id,
          date: dateTs,
          shift: editForm.shift,
          startTime: editForm.shift === ShiftTime.CUSTOM ? editForm.startTime : undefined,
          endTime: editForm.shift === ShiftTime.CUSTOM ? editForm.endTime : undefined,
          offType: editForm.shift === ShiftTime.OFF ? editForm.offType : undefined,
          status: RequestStatus.APPROVED,
          createdAt: Date.now(),
        };
        await registerShift(newShift, { initialStatus: RequestStatus.APPROVED });
        showMsg('success', text.shiftAdded);
      }
      await loadData();
      setCellDetail(null);
      exitCellEdit();
    } catch (e) {
      showMsg('error', text.actionFailed);
    } finally {
      setCellActionLoading(false);
    }
  };

  const handleExport = () => {
    if (getShiftsInWeek.length === 0) {
      alert(text.noDataToExport);
      return;
    }
    const exportData = getShiftsInWeek.map(s => {
      const emp = employees.find(e => e.id === s.userId);
      return {
        [text.exportEmployee]: emp?.name || s.userId,
        [text.exportDepartment]: emp?.department || '',
        [text.exportDate]: new Date(s.date).toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US'),
        [text.exportShiftType]: s.shift === ShiftTime.OFF ?
          (s.offType && OFF_TYPE_LABELS[s.offType] ? OFF_TYPE_LABELS[s.offType] : text.dayOff) :
          text.exportWorkShift,
        [text.exportTimeIn]: s.startTime || '',
        [text.exportTimeOut]: s.endTime || '',
        [text.exportStatus]: s.status === RequestStatus.PENDING ? text.pendingStatus :
          s.status === RequestStatus.APPROVED ? text.approvedStatus : text.rejectedStatus,
        [text.exportRejectionReason]: s.rejectionReason || '',
        [text.exportCreatedDate]: new Date(s.createdAt).toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US'),
      };
    });
    const filename = `shift_registrations_${weekRangeLabel.replace(/\s+/g, '_')}_${Date.now()}.csv`;
    exportToCSV(exportData, filename);
  };

  return (
    <div className="space-y-6">
      {message && (
        <div
          className={`rounded-xl px-4 py-2 text-sm font-medium ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}
        >
          {message.text}
        </div>
      )}

      {/* Toolbar: tuần + thống kê + bộ lọc */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-sky-50">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-slate-600">{text.week}:</span>
            <span className="text-sm font-semibold text-slate-800">{weekRangeLabel}</span>
            <button
              type="button"
              onClick={prevWeek}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-sm font-medium"
            >
              {text.prev}
            </button>
            <button
              type="button"
              onClick={goToToday}
              className="px-3 py-2 rounded-xl border border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 text-sm font-medium"
            >
              {text.thisWeek}
            </button>
            <button
              type="button"
              onClick={nextWeek}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-sm font-medium"
            >
              {text.next}
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <div className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 bg-slate-50/80 whitespace-nowrap">
              <span className="text-[11px] font-semibold text-slate-600 shrink-0">{text.shiftRegToggle}</span>
              <div
                className="inline-flex rounded-lg border border-slate-200/80 bg-slate-100/90 p-0.5"
                role="group"
                aria-label={text.shiftRegToggle}
              >
                <button
                  type="button"
                  disabled={shiftRegToggleLoading}
                  aria-pressed={shiftRegEnabled}
                  title={text.shiftRegOn}
                  onClick={() => void handleShiftRegistrationChange(true)}
                  className={`min-w-[2.75rem] px-2 py-1 rounded-md text-[11px] font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:opacity-50 ${
                    shiftRegEnabled
                      ? 'bg-white text-emerald-700 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700 hover:bg-white/60'
                  }`}
                >
                  {text.shiftRegSegmentOn}
                </button>
                <button
                  type="button"
                  disabled={shiftRegToggleLoading}
                  aria-pressed={!shiftRegEnabled}
                  title={text.shiftRegOff}
                  onClick={() => void handleShiftRegistrationChange(false)}
                  className={`min-w-[2.75rem] px-2 py-1 rounded-md text-[11px] font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:opacity-50 ${
                    !shiftRegEnabled
                      ? 'bg-white text-slate-800 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700 hover:bg-white/60'
                  }`}
                >
                  {text.shiftRegSegmentOff}
                </button>
              </div>
              <button
                type="button"
                onClick={openScheduleModal}
                className={`inline-flex items-center gap-1 max-w-[10.5rem] px-1.5 py-1 rounded-md border text-[10px] font-medium transition-colors whitespace-nowrap ${
                  shiftRegSchedule.mode !== 'manual'
                    ? 'border-sky-300 bg-sky-50 text-sky-800 hover:bg-sky-100'
                    : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                }`}
                title={scheduleHint}
              >
                <span aria-hidden>⏱</span>
                {shiftRegSchedule.mode !== 'manual' ? (
                  <span className="truncate">{formatScheduleSummary(shiftRegSchedule)}</span>
                ) : (
                  <span>{text.scheduleBtn}</span>
                )}
              </button>
              <button
                type="button"
                onClick={handleViewHistory}
                className="px-1.5 py-1 rounded-md border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 text-[10px] font-medium transition-colors"
                title={text.viewHistory}
              >
                📋
              </button>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800 font-medium">
              {text.pending}: {weekStats.pending}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-green-100 text-green-800 font-medium">
              {text.approved}: {weekStats.approved}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-red-100 text-red-800 font-medium">
              {text.rejected}: {weekStats.rejected}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 mt-3 pt-3 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-medium text-slate-500">{text.filter}:</span>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white text-slate-700"
            >
              <option value="">{text.allDepartments}</option>
              {departmentOptions.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white text-slate-700"
            >
              <option value="">{text.allBranches}</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
              ))}
            </select>
            <input
              type="text"
              placeholder={text.searchByName}
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm w-44 text-slate-700 placeholder:text-slate-400"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {setView && (
              <button
                onClick={() => setView('admin', { adminPath: 'payroll' })}
                className="px-4 py-2 bg-green-600 text-white rounded-xl text-xs font-bold hover:bg-green-700 transition-colors flex items-center gap-2"
                title={text.goToPayroll}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
                </svg>
                {text.goToPayroll}
              </button>
            )}
            <button
              onClick={handleExport}
              disabled={loading || getShiftsInWeek.length === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              {text.exportCSV} ({getShiftsInWeek.length})
            </button>
          </div>
        </div>
      </div>

      {/* Bulk action khi chọn 1 nhân viên */}
      {selectedUserId && selectedEmployeePendingCount > 0 && (
        <div className="flex items-center gap-3 p-3 bg-sky-50 rounded-2xl border border-sky-100">
          <span className="text-sm text-slate-700">
            <strong>{selectedEmployeePendingCount}</strong> {text.pendingRequests}
          </span>
          <button
            type="button"
            disabled={actionLoadingId === `bulk-${selectedUserId}`}
            onClick={(e) => { e.stopPropagation(); handleBulkAction(selectedUserId, RequestStatus.APPROVED); }}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 disabled:opacity-50 shadow-sm"
          >
            {text.approveAll}
          </button>
          <button
            type="button"
            disabled={actionLoadingId === `bulk-${selectedUserId}`}
            onClick={(e) => { e.stopPropagation(); handleBulkAction(selectedUserId, RequestStatus.REJECTED); }}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 disabled:opacity-50"
          >
            {text.rejectAll}
          </button>
        </div>
      )}

      {selectedUserId && selectedEmployee?.contractType !== ContractType.TRIAL && (
        <div className="p-3 bg-blue-50 rounded-2xl border border-blue-100 space-y-2">
          <div className="text-sm text-slate-700">
            <span className="font-semibold">{text.selectedEmployee}:</span>{' '}
            <span className="font-medium">{selectedEmployee?.name || selectedUserId}</span>
          </div>
          <div className="text-sm font-semibold text-blue-800">
            {text.annualLeaveDaysInYear} ({weekStart.getFullYear()})
          </div>
          {selectedEmployeeAnnualLeaveInYear.length === 0 ? (
            <p className="text-sm text-slate-500">{text.noAnnualLeaveInYear}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {selectedEmployeeAnnualLeaveInYear.map((leave) => {
                const leaveDate = new Date(leave.date);
                const statusLabel =
                  leave.status === RequestStatus.APPROVED
                    ? text.approvedStatus
                    : leave.status === RequestStatus.PENDING
                      ? text.pendingStatus
                      : text.rejectedStatus;
                const statusClass =
                  leave.status === RequestStatus.APPROVED
                    ? 'bg-green-100 text-green-800'
                    : leave.status === RequestStatus.PENDING
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-red-100 text-red-800';

                return (
                  <span
                    key={leave.id}
                    className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium ${statusClass}`}
                  >
                    {formatDateLabel(leaveDate)} - {statusLabel}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border-2 border-slate-200 overflow-hidden relative">
        {loading && (
          <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10 rounded-2xl">
            <span className="text-slate-500 font-medium">{text.loading}</span>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[880px] table-fixed">
            <colgroup>
              <col style={{ width: '140px' }} />
              <col style={{ width: '72px' }} />
              {weekDates.map((_, i) => (
                <React.Fragment key={i}>
                  <col style={{ width: '52px' }} />
                  <col style={{ width: '52px' }} />
                </React.Fragment>
              ))}
            </colgroup>
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-bold text-slate-600 uppercase border-r border-b border-slate-300 first:border-l">
                  {text.employee}
                </th>
                <th className="px-2 py-2 text-left text-xs font-bold text-slate-600 uppercase border-r border-b border-slate-300">
                  {text.department}
                </th>
                {weekDates.map((d, i) => {
                  const holiday = getHolidayForDate(d);
                  return (
                    <th key={toDateKey(d)} colSpan={2} className={`px-1 py-2 text-center text-xs font-bold border-r border-b border-slate-300 ${holiday ? 'bg-yellow-50 text-yellow-800' : 'text-slate-700'}`}>
                      <div className="flex flex-col items-center gap-0.5">
                        <div className="flex items-center gap-1">
                          <span>{DAY_LABELS[i]} {d.getDate()}/{d.getMonth() + 1}</span>
                          {holiday && <span className="text-[10px]" title={holiday.name}>🎉</span>}
                        </div>
                        {holiday && (
                          <span className="text-[9px] font-medium text-yellow-700 truncate max-w-[60px]" title={holiday.name}>
                            {holiday.name}
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
              <tr>
                <th className="px-3 py-1 text-[10px] font-medium text-slate-500 border-r border-b border-slate-300 first:border-l" />
                <th className="px-2 py-1 text-[10px] font-medium text-slate-500 border-r border-b border-slate-300" />
                {weekDates.map((_, i) => (
                  <React.Fragment key={i}>
                    <th className="px-0 py-1 text-center text-[10px] font-medium text-slate-500 border-r border-b border-slate-300">
                      {text.checkIn}
                    </th>
                    <th className="px-0 py-1 text-center text-[10px] font-medium text-slate-500 border-r border-b border-slate-300">
                      {text.checkOut}
                    </th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {gridEmployees.length === 0 ? (
                <tr>
                  <td colSpan={2 + 7 * 2} className="px-6 py-12 text-center text-slate-400 text-sm border-r border-b border-l border-slate-200">
                    {text.noEmployees}
                  </td>
                </tr>
              ) : (
                gridEmployees.map((emp) => {
                  const isSelected = selectedUserId === emp.id;
                  return (
                    <tr
                      key={emp.id}
                      onClick={() => setSelectedUserId((id) => (id === emp.id ? null : emp.id))}
                      className={`cursor-pointer ${isSelected ? 'bg-sky-50' : 'hover:bg-slate-50'}`}
                    >
                      <td className="px-3 py-2 border-r border-b border-slate-200 first:border-l">
                        {setView ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setView('employee-profile', { employeeId: emp.id });
                            }}
                            className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline transition-colors text-left"
                          >
                            {emp.name}
                          </button>
                        ) : (
                          <span className="text-sm font-medium text-slate-800">{emp.name}</span>
                        )}
                        {emp.contractType !== ContractType.TRIAL && annualLeaveByUser[emp.id] && (
                          <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px]">
                            <span className="rounded-md bg-blue-50 px-1.5 py-0.5 font-semibold text-blue-700">
                              {text.annualLeave}: {annualLeaveByUser[emp.id].entitlementDays}
                            </span>
                            <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 font-semibold text-emerald-700">
                              {text.annualLeaveRemaining}: {annualLeaveByUser[emp.id].remainingDays}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-2 border-r border-b border-slate-200">
                        <span className="text-xs text-slate-700">{emp.department || '—'}</span>
                      </td>
                      {weekDates.map((date) => {
                        const reg = getShiftFor(emp.id, date);
                        const openDetail = (e: React.SyntheticEvent) => {
                          e.stopPropagation();
                          setCellEditMode('view');
                          setCellDetail({ user: emp, date, reg });
                        };
                        if (!reg) {
                          return (
                            <React.Fragment key={toDateKey(date)}>
                              <td
                                role="button"
                                tabIndex={0}
                                onClick={openDetail}
                                onTouchEnd={openDetail}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(e); } }}
                                className="px-1 py-2 border-r border-b border-slate-200 text-center text-xs text-slate-300 cursor-pointer hover:bg-slate-100 touch-manipulation"
                              >
                                —
                              </td>
                              <td
                                role="button"
                                tabIndex={0}
                                onClick={openDetail}
                                onTouchEnd={openDetail}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(e); } }}
                                className="px-1 py-2 border-r border-b border-slate-200 text-center text-xs text-slate-300 cursor-pointer hover:bg-slate-100 touch-manipulation"
                              >
                                —
                              </td>
                            </React.Fragment>
                          );
                        }
                        const statusBadge =
                          reg.status === RequestStatus.PENDING
                            ? { cls: 'text-amber-600', label: text.pendingStatus, icon: '⏳' }
                            : reg.status === RequestStatus.APPROVED
                              ? { cls: 'text-green-600', label: text.approvedStatus, icon: '✓' }
                              : { cls: 'text-red-600', label: text.rejectedStatus, icon: '✕' };
                        if (reg.shift === ShiftTime.OFF) {
                          return (
                            <React.Fragment key={toDateKey(date)}>
                              <td
                                colSpan={2}
                                role="button"
                                tabIndex={0}
                                onClick={openDetail}
                                onTouchEnd={openDetail}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(e); } }}
                                className="px-2 py-2 border-r border-b border-slate-200 bg-red-50/80 text-red-700 text-xs font-medium text-center align-top cursor-pointer hover:bg-red-100/80 touch-manipulation"
                              >
                                <div className="flex flex-col items-center gap-1 relative">
                                  <span
                                    className={`absolute top-0.5 right-0.5 inline-flex items-center justify-center w-4 h-4 text-[9px] font-bold ${statusBadge.cls}`}
                                    title={statusBadge.label}
                                  >
                                    {statusBadge.icon}
                                  </span>
                                  <span>{reg.offType && OFF_TYPE_LABELS[reg.offType] ? OFF_TYPE_LABELS[reg.offType] : text.dayOff}</span>
                                  {reg.status === RequestStatus.PENDING && (
                                    <div className="flex gap-1 mt-1">
                                      <button
                                        type="button"
                                        disabled={actionLoadingId === reg.id}
                                        onClick={(e) => { e.stopPropagation(); handleAction(reg.id, RequestStatus.APPROVED); }}
                                        className="px-2 py-0.5 bg-blue-600 text-white rounded-lg text-[10px] font-medium hover:bg-blue-700 disabled:opacity-50"
                                        title={text.approve}
                                      >
                                        {text.approve}
                                      </button>
                                      <button
                                        type="button"
                                        disabled={actionLoadingId === reg.id}
                                        onClick={(e) => { e.stopPropagation(); handleAction(reg.id, RequestStatus.REJECTED); }}
                                        className="px-2 py-0.5 bg-white border border-slate-300 text-slate-600 rounded-lg text-[10px] font-medium hover:bg-slate-50 disabled:opacity-50"
                                        title={text.reject}
                                      >
                                        {text.reject}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </React.Fragment>
                          );
                        }
                        const inTime = reg.startTime ?? DEFAULT_IN;
                        const outTime = reg.endTime ?? DEFAULT_OUT;
                        return (
                          <React.Fragment key={toDateKey(date)}>
                            <td
                              role="button"
                              tabIndex={0}
                              onClick={openDetail}
                              onTouchEnd={openDetail}
                              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(e); } }}
                              className="px-1 py-2 border-r border-b border-slate-200 text-center text-xs relative align-top cursor-pointer hover:bg-slate-50 touch-manipulation"
                            >
                              <div className="font-medium text-slate-800">{inTime}</div>
                              <div
                                className={`absolute top-0.5 right-0.5 inline-flex items-center justify-center w-4 h-4 text-[9px] font-bold ${statusBadge.cls}`}
                                title={statusBadge.label}
                              >
                                {statusBadge.icon}
                              </div>
                              {reg.status === RequestStatus.PENDING && (
                                <div className="flex justify-center gap-1 mt-1 flex-wrap">
                                  <button
                                    type="button"
                                    disabled={actionLoadingId === reg.id}
                                    onClick={(e) => { e.stopPropagation(); handleAction(reg.id, RequestStatus.APPROVED); }}
                                    className="px-2 py-0.5 bg-blue-600 text-white rounded-lg text-[10px] font-medium hover:bg-blue-700 disabled:opacity-50"
                                    title={text.approve}
                                  >
                                    {text.approve}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={actionLoadingId === reg.id}
                                    onClick={(e) => { e.stopPropagation(); handleAction(reg.id, RequestStatus.REJECTED); }}
                                    className="px-2 py-0.5 bg-white border border-slate-300 text-slate-600 rounded-lg text-[10px] font-medium hover:bg-slate-50 disabled:opacity-50"
                                    title={text.reject}
                                  >
                                    {text.reject}
                                  </button>
                                </div>
                              )}
                            </td>
                            <td
                              role="button"
                              tabIndex={0}
                              onClick={openDetail}
                              onTouchEnd={openDetail}
                              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(e); } }}
                              className="px-1 py-2 border-r border-b border-slate-200 text-center text-xs align-top font-medium text-slate-800 cursor-pointer hover:bg-slate-50 touch-manipulation"
                            >
                              {outTime}
                            </td>
                          </React.Fragment>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal chi tiết ô (nhân viên + ngày) - view / đổi lịch / thêm ca */}
      {cellDetail && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => { setCellDetail(null); exitCellEdit(); }}>
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-800">
              {cellEditMode === 'edit' ? text.editSchedule : cellEditMode === 'add' ? text.addShift : text.dayDetail}
            </h3>
            {getHolidayForDate(cellDetail.date) && (() => {
              const holiday = getHolidayForDate(cellDetail.date);
              return holiday ? (
                <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3 mb-2">
                  <p className="text-sm font-bold text-yellow-800 flex items-center gap-2">
                    <span>🎉</span>
                    <span>{holiday.name}</span>
                  </p>
                  <p className="text-xs text-yellow-700 mt-1">
                    {holiday.type === 'NATIONAL' ? text.nationalHoliday :
                      holiday.type === 'COMPANY' ? text.companyHoliday :
                        text.localHoliday}
                    {holiday.isRecurring && ` • ${text.recurringYearly}`}
                  </p>
                  {holiday.description && (
                    <p className="text-xs text-yellow-600 mt-1 italic">{holiday.description}</p>
                  )}
                </div>
              ) : null;
            })()}
            <div className="space-y-2 text-sm">
              <p>
                <span className="font-medium text-slate-600">{text.employee}:</span>{' '}
                {setView ? (
                  <button
                    onClick={() => {
                      setCellDetail(null);
                      setView('employee-profile', { employeeId: cellDetail.user.id });
                    }}
                    className="text-blue-600 hover:text-blue-700 hover:underline transition-colors"
                  >
                    {cellDetail.user.name}
                  </button>
                ) : (
                  <span>{cellDetail.user.name}</span>
                )}
              </p>
              <p><span className="font-medium text-slate-600">{text.department}:</span> {cellDetail.user.department || '—'}</p>
              <p><span className="font-medium text-slate-600">{text.exportDate}:</span> {formatDateLabel(cellDetail.date)}</p>
            </div>

            {(cellEditMode === 'edit' || cellEditMode === 'add') ? (
              <div className="space-y-4 pt-2 border-t border-slate-200">
                <div className="flex gap-1 p-1 rounded-xl bg-slate-100">
                  <button
                    type="button"
                    onClick={() => setEditForm(prev => ({ ...prev, shift: ShiftTime.CUSTOM }))}
                    className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-bold transition-all ${editForm.shift === ShiftTime.CUSTOM ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200'
                      }`}
                  >
                    {text.workShift}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditForm(prev => ({ ...prev, shift: ShiftTime.OFF }))}
                    className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-bold transition-all ${editForm.shift === ShiftTime.OFF ? 'bg-slate-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200'
                      }`}
                  >
                    {text.offDay}
                  </button>
                </div>
                {editForm.shift === ShiftTime.OFF ? (
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-600">{text.offType}:</label>
                    <CustomSelect
                      options={Object.entries(OFF_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
                      value={editForm.offType}
                      onChange={(v) => setEditForm(prev => ({ ...prev, offType: v as OffType }))}
                      placeholder={text.selectOffType}
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-bold text-slate-600 w-20">{text.timeIn}:</label>
                      <CustomSelect
                        options={TIME_OPTIONS.map((t) => ({ value: t, label: t }))}
                        value={editForm.startTime}
                        onChange={(v) => setEditForm(prev => ({ ...prev, startTime: v }))}
                        placeholder={text.selectTimeIn}
                        className="flex-1"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-bold text-slate-600 w-20">{text.timeOut}:</label>
                      <CustomSelect
                        options={TIME_OPTIONS.map((t) => ({ value: t, label: t }))}
                        value={editForm.endTime}
                        onChange={(v) => setEditForm(prev => ({ ...prev, endTime: v }))}
                        placeholder={text.selectTimeOut}
                        className="flex-1"
                      />
                    </div>
                  </div>
                )}
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleSaveEdit}
                    disabled={cellActionLoading || !isEditFormValid()}
                    className="flex-1 px-4 py-2 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 text-sm"
                  >
                    {cellActionLoading ? text.saving : text.save}
                  </button>
                  <button
                    type="button"
                    onClick={exitCellEdit}
                    disabled={cellActionLoading}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium"
                  >
                    {text.cancel}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="pt-2 border-t border-slate-200">
                  {!cellDetail.reg ? (
                    <p className="text-slate-500">{text.noRegistration}</p>
                  ) : (
                    <div className="space-y-2">
                      <p>
                        <span className="font-medium text-slate-600">{text.status}:</span>{' '}
                        {cellDetail.reg.status === RequestStatus.PENDING && text.pendingStatus}
                        {cellDetail.reg.status === RequestStatus.APPROVED && text.approvedStatus}
                        {cellDetail.reg.status === RequestStatus.REJECTED && text.rejectedStatus}
                      </p>
                      {cellDetail.reg.shift === ShiftTime.OFF ? (
                        <p>
                          <span className="font-medium text-slate-600">{text.type}:</span>{' '}
                          {cellDetail.reg.offType && OFF_TYPE_LABELS[cellDetail.reg.offType] ? OFF_TYPE_LABELS[cellDetail.reg.offType] : text.dayOff}
                        </p>
                      ) : (
                        <>
                          <p><span className="font-medium text-slate-600">{text.timeIn}:</span> {cellDetail.reg.startTime ?? DEFAULT_IN}</p>
                          <p><span className="font-medium text-slate-600">{text.timeOut}:</span> {cellDetail.reg.endTime ?? DEFAULT_OUT}</p>
                        </>
                      )}
                      {cellDetail.reg.reason && (
                        <p className="mt-2 pt-2 border-t border-slate-100">
                          <span className="font-medium text-slate-600">{text.registrationReason}:</span>{' '}
                          <span className="text-slate-700 italic">{cellDetail.reg.reason}</span>
                        </p>
                      )}
                      {cellDetail.reg.status === RequestStatus.REJECTED && cellDetail.reg.rejectionReason && (
                        <p className="mt-2 pt-2 border-t border-slate-100">
                          <span className="font-medium text-slate-600">{text.rejectionReason}:</span>{' '}
                          <span className="text-red-700">{cellDetail.reg.rejectionReason}</span>
                        </p>
                      )}
                      
                      {/* Tracking info: Thời gian đăng ký, cập nhật, duyệt */}
                      <div className="mt-3 pt-3 border-t border-slate-200 space-y-1.5">
                        <p className="text-[11px] text-slate-500">
                          <span className="font-semibold">📅 {text.registeredAt}:</span>{' '}
                          {new Date(cellDetail.reg.createdAt).toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                        {cellDetail.reg.updatedAt && cellDetail.reg.updatedAt !== cellDetail.reg.createdAt && (
                          <p className="text-[11px] text-slate-500">
                            <span className="font-semibold">🔄 {text.lastUpdated}:</span>{' '}
                            {new Date(cellDetail.reg.updatedAt).toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US', {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        )}
                        {cellDetail.reg.status === RequestStatus.APPROVED || cellDetail.reg.status === RequestStatus.REJECTED ? (
                          cellDetail.reg.reviewedAt ? (
                          <>
                            <p className="text-[11px] text-slate-500">
                              <span className="font-semibold">
                                {cellDetail.reg.status === RequestStatus.APPROVED ? '✅' : '❌'} {text.reviewedAt}:
                              </span>{' '}
                              {new Date(cellDetail.reg.reviewedAt).toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                            {cellDetail.reg.reviewedBy && (
                              <p className="text-[11px] text-slate-500">
                                <span className="font-semibold">👤 {text.reviewedBy}:</span>{' '}
                                {(() => {
                                  const reviewer = employees.find(e => e.id === cellDetail.reg!.reviewedBy);
                                  return reviewer?.name || cellDetail.reg.reviewedBy;
                                })()}
                              </p>
                            )}
                          </>
                          ) : (
                            <p className="text-[11px] text-slate-500">
                              <span className="font-semibold">
                                {cellDetail.reg.status === RequestStatus.APPROVED ? '✅' : '❌'} {text.reviewedAt}:
                              </span>{' '}
                              {text.reviewedAtUnknown}
                            </p>
                          )
                        ) : null}
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 pt-2">
                  {cellDetail.reg ? (
                    <button
                      type="button"
                      onClick={() => enterEditMode(cellDetail.reg!)}
                      className="flex-1 px-4 py-2 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 text-sm"
                    >
                      {text.editSchedule}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={enterAddMode}
                      className="flex-1 px-4 py-2 rounded-xl bg-green-600 text-white font-medium hover:bg-green-700 text-sm"
                    >
                      {text.addShift}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setCellDetail(null)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium"
                  >
                    {text.close}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Modal nhập lý do từ chối - render qua Portal để overlay phủ toàn màn hình */}
      {rejectTarget && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setRejectTarget(null)}>
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-800">{text.rejectReasonTitle}</h3>
            <p className="text-sm text-slate-500">
              {rejectTarget.type === 'single' ? text.rejectReasonDesc : text.rejectReasonBulkDesc}
            </p>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder={text.rejectReasonPlaceholder}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 min-h-[80px] resize-y"
              rows={3}
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setRejectTarget(null); setRejectReason(''); }}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium"
              >
                {text.cancel}
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                className="px-4 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700 text-sm font-medium"
              >
                {text.confirmReject}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal lịch bật/tắt đăng ký ca */}
      {showScheduleModal && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-hidden"
          onClick={() => setShowScheduleModal(false)}
          onWheel={e => e.stopPropagation()}
        >
          <div
            className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-sm w-full p-4 space-y-3"
            onClick={e => e.stopPropagation()}
          >
            <div>
              <h3 className="text-sm font-bold text-slate-800">⏱ {text.scheduleTitle}</h3>
              <p className="mt-0.5 text-[11px] text-slate-500 leading-snug">{text.scheduleHelp}</p>
            </div>
            {scheduleError && (
              <p className="text-[11px] text-red-600 bg-red-50 border border-red-100 rounded-lg px-2.5 py-1.5">{scheduleError}</p>
            )}
            <div className="grid grid-cols-3 gap-1 p-0.5 rounded-lg bg-slate-100" role="radiogroup" aria-label={text.scheduleTitle}>
              {([
                ['manual', text.scheduleModeManual],
                ['window', text.scheduleModeWindow],
                ['weekly', text.scheduleModeWeekly],
              ] as const).map(([mode, label]) => (
                <label
                  key={mode}
                  className={`flex items-center justify-center px-1.5 py-1.5 rounded-md text-[11px] font-semibold cursor-pointer text-center ${
                    scheduleForm.mode === mode
                      ? 'bg-white text-sky-800 shadow-sm'
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                  onClick={() => setScheduleForm(prev => ({ ...prev, mode }))}
                >
                  <input
                    type="radio"
                    name="shift-reg-schedule-mode"
                    value={mode}
                    checked={scheduleForm.mode === mode}
                    onChange={() => setScheduleForm(prev => ({ ...prev, mode }))}
                    className="sr-only"
                  />
                  {label}
                </label>
              ))}
            </div>

            {scheduleForm.mode === 'window' && (
              <div className="grid grid-cols-2 gap-2">
                <label className="text-[11px] font-semibold text-slate-600 space-y-1">
                  <span>{text.scheduleEnableAt}</span>
                  <input
                    type="datetime-local"
                    value={scheduleForm.enableLocal}
                    onChange={e => setScheduleForm(prev => ({ ...prev, enableLocal: e.target.value }))}
                    className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-[12px] text-slate-800"
                  />
                </label>
                <label className="text-[11px] font-semibold text-slate-600 space-y-1">
                  <span>{text.scheduleDisableAt}</span>
                  <input
                    type="datetime-local"
                    value={scheduleForm.disableLocal}
                    onChange={e => setScheduleForm(prev => ({ ...prev, disableLocal: e.target.value }))}
                    className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-[12px] text-slate-800"
                  />
                </label>
              </div>
            )}

            {scheduleForm.mode === 'weekly' && (
              <>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <span className="text-[11px] font-semibold text-slate-600">{text.scheduleWeeklyStart}</span>
                  <div className="flex gap-1">
                    <select
                      value={scheduleForm.weeklyStartDay}
                      onChange={e => setScheduleForm(prev => ({ ...prev, weeklyStartDay: Number(e.target.value) }))}
                      className="min-w-0 flex-1 px-1.5 py-1.5 rounded-lg border border-slate-200 text-[12px] text-slate-800"
                    >
                      {[1, 2, 3, 4, 5, 6, 7].map(d => (
                        <option key={`start-${d}`} value={d}>{weekdayShort(d)}</option>
                      ))}
                    </select>
                    <select
                      value={scheduleForm.weeklyStartTime}
                      onChange={e => setScheduleForm(prev => ({ ...prev, weeklyStartTime: e.target.value }))}
                      className="min-w-0 flex-1 px-1.5 py-1.5 rounded-lg border border-slate-200 text-[12px] text-slate-800"
                    >
                      {SCHEDULE_TIME_OPTIONS.map(t => (
                        <option key={`st-${t}`} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-[11px] font-semibold text-slate-600">{text.scheduleWeeklyEnd}</span>
                  <div className="flex gap-1">
                    <select
                      value={scheduleForm.weeklyEndDay}
                      onChange={e => setScheduleForm(prev => ({ ...prev, weeklyEndDay: Number(e.target.value) }))}
                      className="min-w-0 flex-1 px-1.5 py-1.5 rounded-lg border border-slate-200 text-[12px] text-slate-800"
                    >
                      {[1, 2, 3, 4, 5, 6, 7].map(d => (
                        <option key={`end-${d}`} value={d}>{weekdayShort(d)}</option>
                      ))}
                    </select>
                    <select
                      value={scheduleForm.weeklyEndTime}
                      onChange={e => setScheduleForm(prev => ({ ...prev, weeklyEndTime: e.target.value }))}
                      className="min-w-0 flex-1 px-1.5 py-1.5 rounded-lg border border-slate-200 text-[12px] text-slate-800"
                    >
                      {SCHEDULE_TIME_OPTIONS.map(t => (
                        <option key={`et-${t}`} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              </>
            )}

            <div className="space-y-1.5">
              <p className="text-[10px] text-slate-500 leading-snug">{text.schedulePushHint}</p>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  disabled={scheduleSaving || schedulePushTesting !== null}
                  onClick={() => void handleTestSchedulePush('open')}
                  className="flex-1 px-2 py-1.5 rounded-lg border border-sky-200 bg-sky-50 text-sky-800 text-[11px] font-semibold hover:bg-sky-100 disabled:opacity-50"
                >
                  {schedulePushTesting === 'open' ? text.saving : text.schedulePushTestOpen}
                </button>
                <button
                  type="button"
                  disabled={scheduleSaving || schedulePushTesting !== null}
                  onClick={() => void handleTestSchedulePush('close_warn')}
                  className="flex-1 px-2 py-1.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-[11px] font-semibold hover:bg-amber-100 disabled:opacity-50"
                >
                  {schedulePushTesting === 'close_warn' ? text.saving : text.schedulePushTestClose}
                </button>
              </div>
              {schedulePushFeedback && (
                <p className={`text-[10px] leading-snug ${schedulePushFeedback.type === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
                  {schedulePushFeedback.text}
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                disabled={scheduleSaving}
                onClick={() => void handleSaveSchedule()}
                className="flex-1 px-3 py-1.5 rounded-lg bg-sky-600 text-white text-[12px] font-semibold hover:bg-sky-700 disabled:opacity-50"
              >
                {scheduleSaving ? text.saving : text.scheduleSave}
              </button>
              <button
                type="button"
                disabled={scheduleSaving}
                onClick={() => setShowScheduleModal(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-[12px] font-medium"
              >
                {text.close}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal lịch sử bật/tắt đăng ký ca */}
      {showConfigHistory && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-hidden"
          onClick={() => setShowConfigHistory(false)}
          onWheel={e => e.stopPropagation()}
        >
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-2xl w-full max-h-[80vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="shrink-0 p-6 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-800">📋 {text.configHistory}</h3>
            </div>
            <div className="min-h-0 flex-1 overflow-y-scroll overscroll-contain p-6 max-h-[52vh]">
              {loadingHistory ? (
                <div className="text-center py-8 text-slate-500">{text.loading}</div>
              ) : configHistory.length === 0 ? (
                <div className="text-center py-8 text-slate-500">{text.noHistory}</div>
              ) : (
                <div className="space-y-3">
                  {configHistory.map((record, index) => (
                    <div key={record.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-100/50 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${
                              record.enabled 
                                ? 'bg-emerald-100 text-emerald-700' 
                                : 'bg-slate-200 text-slate-700'
                            }`}>
                              {record.enabled ? `✅ ${text.enabled}` : `🔒 ${text.disabled}`}
                            </span>
                            {index === 0 && (
                              <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 text-[10px] font-bold">
                                {language === 'vi' ? 'Hiện tại' : 'Current'}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-slate-700">
                            <span className="font-semibold">👤 {text.changedBy}:</span>{' '}
                            {record.changedByUser?.name || record.changedBy}
                          </p>
                          <p className="text-xs text-slate-500">
                            <span className="font-semibold">🕒 {text.changedAt}:</span>{' '}
                            {new Date(record.changedAt).toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US', {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit'
                            })}
                          </p>
                          {record.reason && (
                            <p className="text-xs text-slate-600 italic mt-2 pl-3 border-l-2 border-slate-300">
                              {record.reason}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="shrink-0 p-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowConfigHistory(false)}
                className="w-full px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium"
              >
                {text.close}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default ShiftManagement;
