import React, { useState, useEffect, useMemo } from 'react';
import { AttendanceRecord, AttendanceType, AttendanceStatus, User, UserRole, Branch } from '../../types';
import { getAllAttendance, getAllUsers, getBranches } from '../../services/db';
import { exportToCSV } from '../../utils/export';
import { pickDayAnchors } from '../../utils/attendanceDay';

/** yyyy-mm-dd theo giờ local */
const localDayKey = (timestamp: number) => {
  const d = new Date(timestamp);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

interface AttendanceDayGroup {
  userId: string;
  dayKey: string;
  sortKey: number;
  records: AttendanceRecord[];
  checkIn?: AttendanceRecord;
  checkOut?: AttendanceRecord;
  lunchOut?: AttendanceRecord;
  lunchIn?: AttendanceRecord;
}

function buildAttendanceDayGroups(records: AttendanceRecord[]): AttendanceDayGroup[] {
  const map = new Map<string, AttendanceRecord[]>();
  for (const r of records) {
    const dk = localDayKey(r.timestamp);
    const k = `${r.userId}\t${dk}`;
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(r);
  }
  const groups: AttendanceDayGroup[] = [];
  for (const [, recs] of map) {
    recs.sort((a, b) => a.timestamp - b.timestamp);
    const userId = recs[0].userId;
    const dayKey = localDayKey(recs[0].timestamp);
    const anchors = pickDayAnchors(recs);
    groups.push({
      userId,
      dayKey,
      sortKey: Math.max(...recs.map(x => x.timestamp)),
      records: recs,
      checkIn: anchors.checkIn ?? undefined,
      checkOut: anchors.checkOut ?? undefined,
      lunchOut: anchors.lunchOut ?? undefined,
      lunchIn: anchors.lunchIn ?? undefined,
    });
  }
  groups.sort((a, b) => b.sortKey - a.sortKey);
  return groups;
}

interface AttendanceManagementProps {
  onRegisterReload?: (handler: () => void | Promise<void>) => void;
  setView?: (view: string, options?: { replace?: boolean; adminPath?: string; employeeId?: string }) => void;
  language: 'vi' | 'en';
}

const AttendanceManagement: React.FC<AttendanceManagementProps> = ({ onRegisterReload, setView, language }) => {
  const PAGE_SIZE = 25;
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [attendanceFilter, setAttendanceFilter] = useState<string>('ALL');
  const [selectedEmployeeForAttendance, setSelectedEmployeeForAttendance] = useState<string>('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | AttendanceType>('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | AttendanceStatus>('ALL');
  const [filterDepartment, setFilterDepartment] = useState<string>('ALL');
  const [filterBranch, setFilterBranch] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const t = {
    vi: {
      filters: 'Bộ lọc',
      goToPayroll: 'Tính lương',
      exportCSV: 'Xuất CSV',
      filterByTime: 'Lọc theo thời gian',
      today: 'Hôm nay',
      week: 'Tuần',
      month: 'Tháng',
      all: 'Tất cả',
      filterByEmployee: 'Lọc theo nhân viên',
      allEmployees: 'Tất cả nhân viên',
      allDepartments: 'Tất cả phòng ban',
      allBranches: 'Tất cả chi nhánh',
      loading: 'Đang tải dữ liệu...',
      noData: 'Chưa có dữ liệu chấm công',
      type: 'Loại',
      employee: 'Nhân viên',
      time: 'Thời gian',
      location: 'Vị trí',
      status: 'Trạng thái',
      checkIn: 'Vào ca',
      checkOut: 'Ra ca',
      lunchOut: 'Bắt đầu nghỉ trưa',
      lunchIn: 'Kết thúc nghỉ trưa',
      onTime: 'Đúng giờ',
      late: 'Trễ',
      earlyLeave: 'Về sớm',
      overtime: 'Tăng ca',
      noDataToExport: 'Không có dữ liệu để xuất',
      exportEmployee: 'Nhân viên',
      exportDepartment: 'Phòng ban',
      exportTime: 'Thời gian',
      exportDate: 'Ngày',
      exportType: 'Loại',
      exportStatus: 'Trạng thái',
      exportAddress: 'Địa chỉ',
      exportNotes: 'Ghi chú',
      records: 'bản ghi',
      other: 'Khác',
      pending: 'Chờ',
      workSessions: 'phiên/ngày',
      dateCol: 'Ngày',
      checkInCol: 'Vào ca',
      lunchOutCol: 'Bắt đầu nghỉ trưa',
      lunchInCol: 'Kết thúc nghỉ trưa',
      checkOutCol: 'Ra ca',
      moreMarks: 'thêm {n} bản ghi',
      filterDateFrom: 'Từ ngày',
      filterDateTo: 'Đến ngày',
      filterByType: 'Loại chấm công',
      filterByStatus: 'Trạng thái',
      filterByDepartment: 'Phòng ban',
      filterByBranch: 'Chi nhánh',
      allTypes: 'Tất cả loại',
      allStatuses: 'Tất cả trạng thái',
      customRangeHint: 'Để trống hai ô ngày để dùng lọc nhanh (Hôm nay / Tuần / Tháng / Tất cả).',
      clearDetailFilters: 'Xóa lọc chi tiết',
      usingCustomRangeNotice: 'Đang lọc theo khoảng ngày — các nút Hôm nay / Tuần / Tháng không áp dụng cho mốc thời gian.',
      page: 'Trang',
      previous: 'Trước',
      next: 'Sau',
      pageInfo: '{start}-{end} / {total} phiên',
    },
    en: {
      filters: 'Filters',
      goToPayroll: 'Go to Payroll',
      exportCSV: 'Export CSV',
      filterByTime: 'Filter by Time',
      today: 'Today',
      week: 'Week',
      month: 'Month',
      all: 'All',
      filterByEmployee: 'Filter by Employee',
      allEmployees: 'All Employees',
      allDepartments: 'All Departments',
      allBranches: 'All Branches',
      loading: 'Loading data...',
      noData: 'No attendance records yet',
      type: 'Type',
      employee: 'Employee',
      time: 'Time',
      location: 'Location',
      status: 'Status',
      checkIn: 'Check-in',
      checkOut: 'Check-out',
      lunchOut: 'Lunch start',
      lunchIn: 'Lunch end',
      onTime: 'On Time',
      late: 'Late',
      earlyLeave: 'Early Leave',
      overtime: 'Overtime',
      noDataToExport: 'No data to export',
      exportEmployee: 'Employee',
      exportDepartment: 'Department',
      exportTime: 'Time',
      exportDate: 'Date',
      exportType: 'Type',
      exportStatus: 'Status',
      exportAddress: 'Address',
      exportNotes: 'Notes',
      records: 'records',
      other: 'Other',
      pending: 'Pending',
      workSessions: 'sessions',
      dateCol: 'Date',
      checkInCol: 'Check-in',
      lunchOutCol: 'Lunch start',
      lunchInCol: 'Lunch end',
      checkOutCol: 'Check-out',
      moreMarks: '+{n} records',
      filterDateFrom: 'From date',
      filterDateTo: 'To date',
      filterByType: 'Check type',
      filterByStatus: 'Status',
      filterByDepartment: 'Department',
      filterByBranch: 'Branch',
      allTypes: 'All types',
      allStatuses: 'All statuses',
      customRangeHint: 'Leave both dates empty to use quick filters (Today / Week / Month / All).',
      clearDetailFilters: 'Clear detail filters',
      usingCustomRangeNotice: 'Date range is active — quick time presets do not apply to the time window.',
      page: 'Page',
      previous: 'Previous',
      next: 'Next',
      pageInfo: '{start}-{end} / {total} sessions',
    }
  };

  const text = t[language];

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (onRegisterReload) {
      onRegisterReload(loadData);
    }
  }, [onRegisterReload]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [records, users, branchesData] = await Promise.all([
        getAllAttendance(),
        getAllUsers(),
        getBranches(),
      ]);
      
      // Debug: Log một vài URLs để kiểm tra
      const recordsWithPhotos = records.filter(r => r.photoUrl);
      if (recordsWithPhotos.length > 0) {
        console.log('📸 Sample photo URLs from DB:', recordsWithPhotos.slice(0, 3).map(r => ({
          recordId: r.id,
          photoUrl: r.photoUrl,
          urlLength: r.photoUrl?.length,
          isComplete: ['CHECK_IN', 'CHECK_OUT', 'LUNCH_OUT', 'LUNCH_IN'].some(t => r.photoUrl?.includes(t)),
        })));
      }
      
      setAttendanceRecords(records);
      setEmployees(users);
      setBranches(branchesData.filter(b => b.isActive));
      setEmployees(users);
      setCurrentPage(1);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const parseLocalDayStartMs = (yyyyMmDd: string) => {
    const [y, m, d] = yyyyMmDd.split('-').map(Number);
    return new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
  };

  const parseLocalDayEndMs = (yyyyMmDd: string) => {
    const [y, m, d] = yyyyMmDd.split('-').map(Number);
    return new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
  };

  const getFilteredData = () => {
    let filtered = attendanceRecords;

    if (selectedEmployeeForAttendance !== 'ALL') {
      filtered = filtered.filter(r => r.userId === selectedEmployeeForAttendance);
    }

    if (filterDepartment !== 'ALL') {
      filtered = filtered.filter(r => {
        const emp = employees.find(e => e.id === r.userId);
        return emp?.department === filterDepartment;
      });
    }

    if (filterBranch !== 'ALL') {
      filtered = filtered.filter(r => {
        const emp = employees.find(e => e.id === r.userId);
        return emp?.branchId === filterBranch;
      });
    }

    if (filterType !== 'ALL') {
      filtered = filtered.filter(r => r.type === filterType);
    }

    if (filterStatus !== 'ALL') {
      filtered = filtered.filter(r => r.status === filterStatus);
    }

    const hasCustomRange = Boolean(dateFrom.trim() || dateTo.trim());
    if (hasCustomRange) {
      let rangeStart = Number.MIN_SAFE_INTEGER;
      let rangeEnd = Number.MAX_SAFE_INTEGER;
      if (dateFrom.trim()) {
        rangeStart = parseLocalDayStartMs(dateFrom.trim());
      }
      if (dateTo.trim()) {
        rangeEnd = parseLocalDayEndMs(dateTo.trim());
      }
      if (rangeStart > rangeEnd) {
        [rangeStart, rangeEnd] = [rangeEnd, rangeStart];
      }
      filtered = filtered.filter(r => r.timestamp >= rangeStart && r.timestamp <= rangeEnd);
    } else {
      const now = Date.now();
      if (attendanceFilter === 'TODAY') {
        const todayStart = new Date().setHours(0, 0, 0, 0);
        filtered = filtered.filter(r => r.timestamp >= todayStart);
      } else if (attendanceFilter === 'WEEK') {
        const weekAgo = now - (7 * 24 * 60 * 60 * 1000);
        filtered = filtered.filter(r => r.timestamp >= weekAgo);
      } else if (attendanceFilter === 'MONTH') {
        const monthAgo = now - (30 * 24 * 60 * 60 * 1000);
        filtered = filtered.filter(r => r.timestamp >= monthAgo);
      }
    }

    return filtered;
  };

  const filteredData = getFilteredData();
  const groupedByDay = useMemo(() => buildAttendanceDayGroups(filteredData), [filteredData]);
  const totalPages = Math.max(1, Math.ceil(groupedByDay.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedGroups = useMemo(() => {
    const start = (safeCurrentPage - 1) * PAGE_SIZE;
    return groupedByDay.slice(start, start + PAGE_SIZE);
  }, [groupedByDay, safeCurrentPage, PAGE_SIZE]);

  const departmentOptions = useMemo(() => {
    const names = new Set<string>();
    employees.forEach(e => {
      if (e.role !== UserRole.ADMIN && e.department?.trim()) {
        names.add(e.department.trim());
      }
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b, language === 'vi' ? 'vi' : 'en'));
  }, [employees, language]);

  const hasCustomDateRange = Boolean(dateFrom.trim() || dateTo.trim());

  useEffect(() => {
    setCurrentPage(1);
  }, [attendanceFilter, selectedEmployeeForAttendance, dateFrom, dateTo, filterType, filterStatus, filterDepartment, filterBranch]);

  useEffect(() => {
    if (currentPage !== safeCurrentPage) {
      setCurrentPage(safeCurrentPage);
    }
  }, [currentPage, safeCurrentPage]);

  const clearDetailFilters = () => {
    setDateFrom('');
    setDateTo('');
    setFilterType('ALL');
    setFilterStatus('ALL');
    setFilterDepartment('ALL');
    setFilterBranch('ALL');
  };

  const handleExport = () => {
    if (filteredData.length === 0) {
      alert(text.noDataToExport);
      return;
    }
    // Format dữ liệu để export dễ đọc hơn
    const exportData = filteredData.map(record => {
      const employee = employees.find(e => e.id === record.userId);
      return {
        [text.exportEmployee]: employee?.name || record.userId,
        [text.exportDepartment]: employee?.department || '',
        [text.exportTime]: new Date(record.timestamp).toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US'),
        [text.exportDate]: new Date(record.timestamp).toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US'),
        [text.exportType]: record.type === AttendanceType.CHECK_IN ? text.checkIn
          : record.type === AttendanceType.CHECK_OUT ? text.checkOut
          : record.type === AttendanceType.LUNCH_OUT ? text.lunchOut
          : text.lunchIn,
        [text.exportStatus]: getStatusLabel(record.status).label,
        [text.exportAddress]: record.location?.address || `${record.location?.lat}, ${record.location?.lng}`,
        [text.exportNotes]: record.notes || '',
      };
    });
    const dateRange = hasCustomDateRange
      ? `range_${dateFrom.trim() || 'start'}_${dateTo.trim() || 'end'}`
      : attendanceFilter === 'TODAY'
        ? 'today'
        : attendanceFilter === 'WEEK'
          ? 'week'
          : attendanceFilter === 'MONTH'
            ? 'month'
            : 'all';
    const filename = `attendance_${dateRange}_${Date.now()}.csv`;
    exportToCSV(exportData, filename);
  };

  const getStatusLabel = (status: AttendanceStatus) => {
    switch (status) {
      case AttendanceStatus.ON_TIME:
        return { label: text.onTime, className: 'bg-green-100 text-green-600' };
      case AttendanceStatus.LATE:
        return { label: text.late, className: 'bg-orange-100 text-orange-600' };
      case AttendanceStatus.EARLY_LEAVE:
        return { label: text.earlyLeave, className: 'bg-yellow-100 text-yellow-600' };
      case AttendanceStatus.OVERTIME:
        return { label: text.overtime, className: 'bg-purple-100 text-purple-600' };
      case AttendanceStatus.PENDING:
        return { label: text.pending, className: 'bg-slate-100 text-slate-600' };
      default:
        return { label: text.other, className: 'bg-slate-100 text-slate-600' };
    }
  };

  const formatDayLabel = (dayKey: string) => {
    const parts = dayKey.split('-').map(Number);
    const [y, m, d] = parts;
    if (parts.length !== 3 || [y, m, d].some(x => Number.isNaN(x))) return dayKey;
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-sky-50">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="text-sm font-bold text-slate-700">{text.filters}</h3>
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
              disabled={isLoading || filteredData.length === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              {text.exportCSV} ({filteredData.length})
            </button>
            <button
              type="button"
              onClick={clearDetailFilters}
              className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200 transition-colors"
            >
              {text.clearDetailFilters}
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-2">{text.filterByTime}</label>
            <div className={`flex flex-wrap gap-2 ${hasCustomDateRange ? 'opacity-50 pointer-events-none' : ''}`}>
              {['TODAY', 'WEEK', 'MONTH', 'ALL'].map(f => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setAttendanceFilter(f)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    attendanceFilter === f ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {f === 'TODAY' ? text.today : f === 'WEEK' ? text.week : f === 'MONTH' ? text.month : text.all}
                </button>
              ))}
            </div>
            {hasCustomDateRange && (
              <p className="text-[11px] text-amber-700 mt-2 leading-snug">{text.usingCustomRangeNotice}</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-2">{text.filterDateFrom}</label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-2">{text.filterDateTo}</label>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
            />
          </div>
        </div>
        <p className="text-[11px] text-slate-500 mt-2">{text.customRangeHint}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-2">{text.filterByEmployee}</label>
            <select
              value={selectedEmployeeForAttendance}
              onChange={(e) => setSelectedEmployeeForAttendance(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
            >
              <option value="ALL">{text.allEmployees}</option>
              {employees.filter(e => e.role !== UserRole.ADMIN).map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name} — {emp.department}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-2">{text.filterByDepartment}</label>
            <select
              value={filterDepartment}
              onChange={e => setFilterDepartment(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
            >
              <option value="ALL">{text.allDepartments}</option>
              {departmentOptions.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-2">{text.filterByBranch}</label>
            <select
              value={filterBranch}
              onChange={e => setFilterBranch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
            >
              <option value="ALL">{text.allBranches}</option>
              {branches.map(branch => (
                <option key={branch.id} value={branch.id}>{branch.name} ({branch.code})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-2">{text.filterByType}</label>
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value as 'ALL' | AttendanceType)}
              className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
            >
              <option value="ALL">{text.allTypes}</option>
              <option value={AttendanceType.CHECK_IN}>{text.checkIn}</option>
              <option value={AttendanceType.LUNCH_OUT}>{text.lunchOut}</option>
              <option value={AttendanceType.LUNCH_IN}>{text.lunchIn}</option>
              <option value={AttendanceType.CHECK_OUT}>{text.checkOut}</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-2">{text.filterByStatus}</label>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value as 'ALL' | AttendanceStatus)}
              className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
            >
              <option value="ALL">{text.allStatuses}</option>
              <option value={AttendanceStatus.ON_TIME}>{text.onTime}</option>
              <option value={AttendanceStatus.LATE}>{text.late}</option>
              <option value={AttendanceStatus.EARLY_LEAVE}>{text.earlyLeave}</option>
              <option value={AttendanceStatus.OVERTIME}>{text.overtime}</option>
              <option value={AttendanceStatus.PENDING}>{text.pending}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-sky-50">
          <p className="text-slate-400 font-medium">{text.loading}</p>
        </div>
      ) : filteredData.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-sky-50">
          <p className="text-slate-400 font-medium">{text.noData}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-sky-50 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-slate-200 bg-slate-50/50">
            <span className="text-sm font-medium text-slate-600">
              {groupedByDay.length} {text.workSessions} · {filteredData.length} {text.records}
            </span>
            {groupedByDay.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={safeCurrentPage <= 1}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 bg-white text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {text.previous}
                </button>
                <span className="text-xs text-slate-600">
                  {text.page} {safeCurrentPage}/{totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={safeCurrentPage >= totalPages}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 bg-white text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {text.next}
                </button>
              </div>
            )}
          </div>
          {groupedByDay.length > 0 && (
            <div className="px-4 py-2 border-b border-slate-100 text-xs text-slate-500 bg-slate-50/30">
              {text.pageInfo
                .replace('{start}', String((safeCurrentPage - 1) * PAGE_SIZE + 1))
                .replace('{end}', String(Math.min(safeCurrentPage * PAGE_SIZE, groupedByDay.length)))
                .replace('{total}', String(groupedByDay.length))}
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">{text.employee}</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">{text.dateCol}</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">{text.checkInCol}</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">{text.lunchOutCol}</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">{text.lunchInCol}</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">{text.checkOutCol}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedGroups.map((group) => {
                  const employee = employees.find(e => e.id === group.userId);
                  const inInfo = group.checkIn ? getStatusLabel(group.checkIn.status) : null;
                  const outInfo = group.checkOut ? getStatusLabel(group.checkOut.status) : null;
                  const lunchOutInfo = group.lunchOut ? getStatusLabel(group.lunchOut.status) : null;
                  const lunchInInfo = group.lunchIn ? getStatusLabel(group.lunchIn.status) : null;
                  const anchored = new Set(
                    [group.checkIn?.id, group.lunchOut?.id, group.lunchIn?.id, group.checkOut?.id].filter(Boolean) as string[]
                  );
                  const extra = group.records.filter(r => !anchored.has(r.id)).length;
                  const fmtLoc = (r?: AttendanceRecord) =>
                    r?.location
                      ? r.location.address || `${r.location.lat.toFixed(5)}, ${r.location.lng.toFixed(5)}`
                      : null;
                  return (
                    <tr key={`${group.userId}-${group.dayKey}`} className="hover:bg-sky-50/50 transition-colors align-top">
                      <td className="px-6 py-4">
                        <div>
                          {employee && setView ? (
                            <button
                              type="button"
                              onClick={() => setView('employee-profile', { employeeId: employee.id })}
                              className="text-sm font-bold text-blue-600 hover:text-blue-700 hover:underline transition-colors text-left"
                            >
                              {employee.name}
                            </button>
                          ) : (
                            <p className="text-sm font-bold text-slate-800">{employee?.name || group.userId}</p>
                          )}
                          <p className="text-xs text-slate-500">{employee?.department || ''}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-slate-800 font-medium">{formatDayLabel(group.dayKey)}</p>
                        <p className="text-[11px] text-slate-400 font-mono">{group.dayKey}</p>
                        {extra > 0 && (
                          <p className="text-[11px] text-amber-600 mt-1">{text.moreMarks.replace('{n}', String(extra))}</p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {group.checkIn ? (
                          <div className="space-y-1">
                            <p className="text-sm text-slate-800 tabular-nums">
                              {new Date(group.checkIn.timestamp).toLocaleTimeString(language === 'vi' ? 'vi-VN' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                            {inInfo && (
                              <span className={`inline-flex text-xs font-bold px-2 py-0.5 rounded-lg ${inInfo.className}`}>{inInfo.label}</span>
                            )}
                            {fmtLoc(group.checkIn) && (
                              <p className="text-[11px] text-slate-500 line-clamp-2">{fmtLoc(group.checkIn)}</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {group.lunchOut ? (
                          <div className="space-y-1">
                            <p className="text-sm text-slate-800 tabular-nums">
                              {new Date(group.lunchOut.timestamp).toLocaleTimeString(language === 'vi' ? 'vi-VN' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                            {lunchOutInfo && (
                              <span className={`inline-flex text-xs font-bold px-2 py-0.5 rounded-lg ${lunchOutInfo.className}`}>{lunchOutInfo.label}</span>
                            )}
                            {fmtLoc(group.lunchOut) && (
                              <p className="text-[11px] text-slate-500 line-clamp-2">{fmtLoc(group.lunchOut)}</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {group.lunchIn ? (
                          <div className="space-y-1">
                            <p className="text-sm text-slate-800 tabular-nums">
                              {new Date(group.lunchIn.timestamp).toLocaleTimeString(language === 'vi' ? 'vi-VN' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                            {lunchInInfo && (
                              <span className={`inline-flex text-xs font-bold px-2 py-0.5 rounded-lg ${lunchInInfo.className}`}>{lunchInInfo.label}</span>
                            )}
                            {fmtLoc(group.lunchIn) && (
                              <p className="text-[11px] text-slate-500 line-clamp-2">{fmtLoc(group.lunchIn)}</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {group.checkOut ? (
                          <div className="space-y-1">
                            <p className="text-sm text-slate-800 tabular-nums">
                              {new Date(group.checkOut.timestamp).toLocaleTimeString(language === 'vi' ? 'vi-VN' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                            {outInfo && (
                              <span className={`inline-flex text-xs font-bold px-2 py-0.5 rounded-lg ${outInfo.className}`}>{outInfo.label}</span>
                            )}
                            {fmtLoc(group.checkOut) && (
                              <p className="text-[11px] text-slate-500 line-clamp-2">{fmtLoc(group.checkOut)}</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceManagement;
