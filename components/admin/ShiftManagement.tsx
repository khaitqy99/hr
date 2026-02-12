import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ShiftRegistration, RequestStatus, User, UserRole, ShiftTime, OFF_TYPE_LABELS, Holiday, Department, OffType } from '../../types';
import { getShiftRegistrations, updateShiftStatus, updateShiftRegistration, registerShift, getAllUsers, getHolidays, getDepartments } from '../../services/db';
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
}

/** Modal từ chối: đơn (id) hoặc hàng loạt (userId) */
type RejectTarget = { type: 'single'; id: string } | { type: 'bulk'; userId: string };

const ShiftManagement: React.FC<ShiftManagementProps> = ({ onRegisterReload, setView }) => {
  const [shiftRequests, setShiftRequests] = useState<ShiftRegistration[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [weekStart, setWeekStart] = useState<Date>(() => getWeekStart(new Date()));
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [departmentFilter, setDepartmentFilter] = useState<string>('');
  const [searchName, setSearchName] = useState('');
  const [loading, setLoading] = useState(true);
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
      const [shifts, users] = await Promise.all([
        getShiftRegistrations(undefined, UserRole.ADMIN),
        getAllUsers(),
      ]);
      setShiftRequests(shifts);
      setEmployees(users);
    } catch (e) {
      setMessage({ type: 'error', text: 'Không tải được dữ liệu. Thử lại sau.' });
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
      showMsg('success', 'Đã chấp thuận.');
    } catch (e) {
      showMsg('error', 'Cập nhật thất bại. Thử lại.');
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
      showMsg('success', `Đã chấp thuận ${pendingInWeek.length} đăng ký.`);
    } catch (e) {
      showMsg('error', 'Cập nhật thất bại. Thử lại.');
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
        showMsg('success', 'Đã từ chối.');
      } catch (e) {
        showMsg('error', 'Cập nhật thất bại. Thử lại.');
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
        showMsg('success', `Đã từ chối ${pendingInWeek.length} đăng ký.`);
      } catch (e) {
        showMsg('error', 'Cập nhật thất bại. Thử lại.');
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
      .filter((u) => !departmentFilter || u.department === departmentFilter)
      .filter((u) => !searchName.trim() || u.name.toLowerCase().includes(searchName.trim().toLowerCase()));
  }, [employees, departmentFilter, searchName]);

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
        showMsg('success', 'Đã cập nhật lịch.');
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
        showMsg('success', 'Đã thêm ca cho nhân viên.');
      }
      await loadData();
      setCellDetail(null);
      exitCellEdit();
    } catch (e) {
      showMsg('error', 'Thao tác thất bại. Thử lại.');
    } finally {
      setCellActionLoading(false);
    }
  };

  const handleExport = () => {
    if (getShiftsInWeek.length === 0) {
      alert('Không có dữ liệu để xuất');
      return;
    }
    const exportData = getShiftsInWeek.map(s => {
      const emp = employees.find(e => e.id === s.userId);
      return {
        'Nhân viên': emp?.name || s.userId,
        'Phòng ban': emp?.department || '',
        'Ngày': new Date(s.date).toLocaleDateString('vi-VN'),
        'Loại ca': s.shift === ShiftTime.OFF ?
          (s.offType && OFF_TYPE_LABELS[s.offType] ? OFF_TYPE_LABELS[s.offType] : 'Ngày off') :
          'Ca làm việc',
        'Giờ vào': s.startTime || '',
        'Giờ ra': s.endTime || '',
        'Trạng thái': s.status === RequestStatus.PENDING ? 'Chờ duyệt' :
          s.status === RequestStatus.APPROVED ? 'Đã duyệt' : 'Từ chối',
        'Lý do từ chối': s.rejectionReason || '',
        'Ngày tạo': new Date(s.createdAt).toLocaleDateString('vi-VN'),
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
            <span className="text-sm font-medium text-slate-600">Tuần:</span>
            <span className="text-sm font-semibold text-slate-800">{weekRangeLabel}</span>
            <button
              type="button"
              onClick={prevWeek}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-sm font-medium"
            >
              ← Trước
            </button>
            <button
              type="button"
              onClick={goToToday}
              className="px-3 py-2 rounded-xl border border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 text-sm font-medium"
            >
              Tuần này
            </button>
            <button
              type="button"
              onClick={nextWeek}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-sm font-medium"
            >
              Sau →
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800 font-medium">
              Chờ: {weekStats.pending}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-green-100 text-green-800 font-medium">
              Đã duyệt: {weekStats.approved}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-red-100 text-red-800 font-medium">
              Từ chối: {weekStats.rejected}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 mt-3 pt-3 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-medium text-slate-500">Lọc:</span>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white text-slate-700"
            >
              <option value="">Tất cả bộ phận</option>
              {departmentOptions.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Tìm theo tên..."
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
                title="Chuyển đến trang tính lương"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
                </svg>
                Tính lương
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
              Xuất CSV ({getShiftsInWeek.length})
            </button>
          </div>
        </div>
      </div>

      {/* Bulk action khi chọn 1 nhân viên */}
      {selectedUserId && selectedEmployeePendingCount > 0 && (
        <div className="flex items-center gap-3 p-3 bg-sky-50 rounded-2xl border border-sky-100">
          <span className="text-sm text-slate-700">
            <strong>{selectedEmployeePendingCount}</strong> đăng ký chờ duyệt của nhân viên này trong tuần.
          </span>
          <button
            type="button"
            disabled={actionLoadingId === `bulk-${selectedUserId}`}
            onClick={(e) => { e.stopPropagation(); handleBulkAction(selectedUserId, RequestStatus.APPROVED); }}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 disabled:opacity-50 shadow-sm"
          >
            Duyệt tất cả
          </button>
          <button
            type="button"
            disabled={actionLoadingId === `bulk-${selectedUserId}`}
            onClick={(e) => { e.stopPropagation(); handleBulkAction(selectedUserId, RequestStatus.REJECTED); }}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 disabled:opacity-50"
          >
            Từ chối tất cả
          </button>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border-2 border-slate-200 overflow-hidden relative">
        {loading && (
          <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10 rounded-2xl">
            <span className="text-slate-500 font-medium">Đang tải...</span>
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
            <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-bold text-slate-600 uppercase border-r border-b border-slate-300 first:border-l">
                  Nhân viên
                </th>
                <th className="px-2 py-2 text-left text-xs font-bold text-slate-600 uppercase border-r border-b border-slate-300">
                  Bộ phận
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
                      Vào
                    </th>
                    <th className="px-0 py-1 text-center text-[10px] font-medium text-slate-500 border-r border-b border-slate-300">
                      Ra
                    </th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {gridEmployees.length === 0 ? (
                <tr>
                  <td colSpan={2 + 7 * 2} className="px-6 py-12 text-center text-slate-400 text-sm border-r border-b border-l border-slate-200">
                    Không có nhân viên nào.
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
                            ? { cls: 'text-amber-600', label: 'Chờ duyệt', icon: '⏳' }
                            : reg.status === RequestStatus.APPROVED
                              ? { cls: 'text-green-600', label: 'Đã duyệt', icon: '✓' }
                              : { cls: 'text-red-600', label: 'Từ chối', icon: '✕' };
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
                                  <span>{reg.offType && OFF_TYPE_LABELS[reg.offType] ? OFF_TYPE_LABELS[reg.offType] : 'Ngày off'}</span>
                                  {reg.status === RequestStatus.PENDING && (
                                    <div className="flex gap-1 mt-1">
                                      <button
                                        type="button"
                                        disabled={actionLoadingId === reg.id}
                                        onClick={(e) => { e.stopPropagation(); handleAction(reg.id, RequestStatus.APPROVED); }}
                                        className="px-2 py-0.5 bg-blue-600 text-white rounded-lg text-[10px] font-medium hover:bg-blue-700 disabled:opacity-50"
                                        title="Chấp thuận"
                                      >
                                        Duyệt
                                      </button>
                                      <button
                                        type="button"
                                        disabled={actionLoadingId === reg.id}
                                        onClick={(e) => { e.stopPropagation(); handleAction(reg.id, RequestStatus.REJECTED); }}
                                        className="px-2 py-0.5 bg-white border border-slate-300 text-slate-600 rounded-lg text-[10px] font-medium hover:bg-slate-50 disabled:opacity-50"
                                        title="Từ chối"
                                      >
                                        Từ chối
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
                                    title="Chấp thuận"
                                  >
                                    Duyệt
                                  </button>
                                  <button
                                    type="button"
                                    disabled={actionLoadingId === reg.id}
                                    onClick={(e) => { e.stopPropagation(); handleAction(reg.id, RequestStatus.REJECTED); }}
                                    className="px-2 py-0.5 bg-white border border-slate-300 text-slate-600 rounded-lg text-[10px] font-medium hover:bg-slate-50 disabled:opacity-50"
                                    title="Từ chối"
                                  >
                                    Từ chối
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
              {cellEditMode === 'edit' ? 'Đổi lịch' : cellEditMode === 'add' ? 'Thêm ca' : 'Chi tiết ngày'}
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
                    {holiday.type === 'NATIONAL' ? 'Ngày lễ quốc gia' :
                      holiday.type === 'COMPANY' ? 'Ngày lễ công ty' :
                        'Ngày lễ địa phương'}
                    {holiday.isRecurring && ' • Lặp lại hàng năm'}
                  </p>
                  {holiday.description && (
                    <p className="text-xs text-yellow-600 mt-1 italic">{holiday.description}</p>
                  )}
                </div>
              ) : null;
            })()}
            <div className="space-y-2 text-sm">
              <p>
                <span className="font-medium text-slate-600">Nhân viên:</span>{' '}
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
              <p><span className="font-medium text-slate-600">Bộ phận:</span> {cellDetail.user.department || '—'}</p>
              <p><span className="font-medium text-slate-600">Ngày:</span> {formatDateLabel(cellDetail.date)}</p>
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
                    Ca làm
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditForm(prev => ({ ...prev, shift: ShiftTime.OFF }))}
                    className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-bold transition-all ${editForm.shift === ShiftTime.OFF ? 'bg-slate-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200'
                      }`}
                  >
                    Ngày off
                  </button>
                </div>
                {editForm.shift === ShiftTime.OFF ? (
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-600">Loại off:</label>
                    <CustomSelect
                      options={Object.entries(OFF_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
                      value={editForm.offType}
                      onChange={(v) => setEditForm(prev => ({ ...prev, offType: v as OffType }))}
                      placeholder="Chọn loại off"
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-bold text-slate-600 w-20">Giờ vào:</label>
                      <CustomSelect
                        options={TIME_OPTIONS.map((t) => ({ value: t, label: t }))}
                        value={editForm.startTime}
                        onChange={(v) => setEditForm(prev => ({ ...prev, startTime: v }))}
                        placeholder="Chọn giờ vào"
                        className="flex-1"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-bold text-slate-600 w-20">Giờ ra:</label>
                      <CustomSelect
                        options={TIME_OPTIONS.map((t) => ({ value: t, label: t }))}
                        value={editForm.endTime}
                        onChange={(v) => setEditForm(prev => ({ ...prev, endTime: v }))}
                        placeholder="Chọn giờ ra"
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
                    {cellActionLoading ? 'Đang lưu...' : 'Lưu'}
                  </button>
                  <button
                    type="button"
                    onClick={exitCellEdit}
                    disabled={cellActionLoading}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium"
                  >
                    Hủy
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="pt-2 border-t border-slate-200">
                  {!cellDetail.reg ? (
                    <p className="text-slate-500">Chưa đăng ký ca cho ngày này.</p>
                  ) : (
                    <div className="space-y-2">
                      <p>
                        <span className="font-medium text-slate-600">Trạng thái:</span>{' '}
                        {cellDetail.reg.status === RequestStatus.PENDING && 'Chờ duyệt'}
                        {cellDetail.reg.status === RequestStatus.APPROVED && 'Đã duyệt'}
                        {cellDetail.reg.status === RequestStatus.REJECTED && 'Từ chối'}
                      </p>
                      {cellDetail.reg.shift === ShiftTime.OFF ? (
                        <p>
                          <span className="font-medium text-slate-600">Loại:</span>{' '}
                          {cellDetail.reg.offType && OFF_TYPE_LABELS[cellDetail.reg.offType] ? OFF_TYPE_LABELS[cellDetail.reg.offType] : 'Ngày off'}
                        </p>
                      ) : (
                        <>
                          <p><span className="font-medium text-slate-600">Giờ vào:</span> {cellDetail.reg.startTime ?? DEFAULT_IN}</p>
                          <p><span className="font-medium text-slate-600">Giờ ra:</span> {cellDetail.reg.endTime ?? DEFAULT_OUT}</p>
                        </>
                      )}
                      {cellDetail.reg.status === RequestStatus.REJECTED && cellDetail.reg.rejectionReason && (
                        <p className="mt-2 pt-2 border-t border-slate-100">
                          <span className="font-medium text-slate-600">Lý do từ chối:</span>{' '}
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
                      Đổi lịch
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={enterAddMode}
                      className="flex-1 px-4 py-2 rounded-xl bg-green-600 text-white font-medium hover:bg-green-700 text-sm"
                    >
                      Thêm ca
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setCellDetail(null)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium"
                  >
                    Đóng
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
            <h3 className="text-lg font-bold text-slate-800">Lý do từ chối</h3>
            <p className="text-sm text-slate-500">
              {rejectTarget.type === 'single' ? 'Nhập lý do từ chối đăng ký ca này. Nhân viên sẽ xem được lý do.' : 'Nhập lý do từ chối (áp dụng cho tất cả đăng ký đang chờ trong tuần).'}
            </p>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Ví dụ: Thiếu thông tin, không đúng quy định..."
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 min-h-[80px] resize-y"
              rows={3}
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setRejectTarget(null); setRejectReason(''); }}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                className="px-4 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700 text-sm font-medium"
              >
                Xác nhận từ chối
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
