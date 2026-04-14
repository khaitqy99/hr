import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ShiftRegistration, RequestStatus, User, UserRole, ShiftTime, OFF_TYPE_LABELS, Holiday, Department, OffType, EmployeeStatus, Branch, AnnualLeaveSummary } from '../../types';
import { getShiftRegistrations, updateShiftStatus, updateShiftRegistration, registerShift, getAllUsers, getHolidays, getDepartments, getBranches, getAnnualLeaveSummary } from '../../services/db';
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
/** Format ngày để hiển thị: "Thứ 3, 10/2/2025" */
function formatDateLabel(d: Date): string {
  return `${DAY_NAMES[d.getDay()]}, ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

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
    }
  };

  const text = t[language];

  useEffect(() => {
    loadData();
    loadHolidays();
    loadDepartments();
  }, []);

  useEffect(() => {
    if (onRegisterReload) {
      onRegisterReload(loadData);
    }
  }, [onRegisterReload]);

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
                        {annualLeaveByUser[emp.id] && (
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
                        const openDetail = (e: React.MouseEvent) => {
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
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(e as unknown as React.MouseEvent); } }}
                                className="px-1 py-2 border-r border-b border-slate-200 text-center text-xs text-slate-300 cursor-pointer hover:bg-slate-100"
                              >
                                —
                              </td>
                              <td
                                role="button"
                                tabIndex={0}
                                onClick={openDetail}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(e as unknown as React.MouseEvent); } }}
                                className="px-1 py-2 border-r border-b border-slate-200 text-center text-xs text-slate-300 cursor-pointer hover:bg-slate-100"
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
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(e as unknown as React.MouseEvent); } }}
                                className="px-2 py-2 border-r border-b border-slate-200 bg-red-50/80 text-red-700 text-xs font-medium text-center align-top cursor-pointer hover:bg-red-100/80"
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
                              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(e as unknown as React.MouseEvent); } }}
                              className="px-1 py-2 border-r border-b border-slate-200 text-center text-xs relative align-top cursor-pointer hover:bg-slate-50"
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
                              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(e as unknown as React.MouseEvent); } }}
                              className="px-1 py-2 border-r border-b border-slate-200 text-center text-xs align-top font-medium text-slate-800 cursor-pointer hover:bg-slate-50"
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
    </div>
  );
};

export default ShiftManagement;
