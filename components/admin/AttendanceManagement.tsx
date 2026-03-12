import React, { useState, useEffect } from 'react';
import { AttendanceRecord, AttendanceType, AttendanceStatus, User, UserRole } from '../../types';
import { getAllAttendance, deleteAttendance, getAllUsers } from '../../services/db';
import { deleteAttendancePhoto, checkPhotoExists, testPhotoUrl, extractFilenameFromUrl } from '../../services/storage';
import { exportToCSV } from '../../utils/export';

/**
 * Kiểm tra xem photoUrl có phải là base64 data URL không
 */
const isBase64DataUrl = (url: string): boolean => {
  return url.startsWith('data:image/');
};

/**
 * Kiểm tra xem photoUrl có phải là URL hợp lệ không
 */
const isValidUrl = (url: string): boolean => {
  try {
    if (isBase64DataUrl(url)) return true;
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

interface AttendanceManagementProps {
  onRegisterReload?: (handler: () => void | Promise<void>) => void;
  setView?: (view: string, options?: { replace?: boolean; adminPath?: string; employeeId?: string }) => void;
  language: 'vi' | 'en';
}

const AttendanceManagement: React.FC<AttendanceManagementProps> = ({ onRegisterReload, setView, language }) => {
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [attendanceFilter, setAttendanceFilter] = useState<string>('ALL');
  const [selectedEmployeeForAttendance, setSelectedEmployeeForAttendance] = useState<string>('ALL');
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('kanban');
  /** ID các bản ghi có ảnh không tải được (URL lỗi / bucket private / bản ghi cũ) */
  const [failedPhotoIds, setFailedPhotoIds] = useState<Set<string>>(new Set());
  /** Track images that are in viewport for lazy loading */
  const [visibleImageIds, setVisibleImageIds] = useState<Set<string>>(new Set());
  /** Track retry attempts for failed images */
  const [retryAttempts, setRetryAttempts] = useState<Map<string, number>>(new Map());

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
      loading: 'Đang tải dữ liệu...',
      noData: 'Chưa có dữ liệu chấm công',
      type: 'Loại',
      employee: 'Nhân viên',
      time: 'Thời gian',
      location: 'Vị trí',
      photo: 'Hình ảnh',
      status: 'Trạng thái',
      actions: 'Thao tác',
      checkIn: 'Vào',
      checkOut: 'Ra',
      onTime: 'Đúng giờ',
      late: 'Trễ',
      earlyLeave: 'Về sớm',
      overtime: 'Tăng ca',
      delete: 'Xóa',
      confirmDelete: 'Bạn có chắc muốn xóa bản ghi này?',
      noDataToExport: 'Không có dữ liệu để xuất',
      exportEmployee: 'Nhân viên',
      exportDepartment: 'Phòng ban',
      exportTime: 'Thời gian',
      exportDate: 'Ngày',
      exportType: 'Loại',
      exportStatus: 'Trạng thái',
      exportAddress: 'Địa chỉ',
      exportNotes: 'Ghi chú',
      viewTable: 'Bảng',
      viewKanban: 'Kanban',
      records: 'bản ghi',
      other: 'Khác',
      pending: 'Chờ',
      emptyColumn: 'Không có',
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
      loading: 'Loading data...',
      noData: 'No attendance records yet',
      type: 'Type',
      employee: 'Employee',
      time: 'Time',
      location: 'Location',
      photo: 'Photo',
      status: 'Status',
      actions: 'Actions',
      checkIn: 'In',
      checkOut: 'Out',
      onTime: 'On Time',
      late: 'Late',
      earlyLeave: 'Early Leave',
      overtime: 'Overtime',
      delete: 'Delete',
      confirmDelete: 'Are you sure you want to delete this record?',
      noDataToExport: 'No data to export',
      exportEmployee: 'Employee',
      exportDepartment: 'Department',
      exportTime: 'Time',
      exportDate: 'Date',
      exportType: 'Type',
      exportStatus: 'Status',
      exportAddress: 'Address',
      exportNotes: 'Notes',
      viewTable: 'Table',
      viewKanban: 'Kanban',
      records: 'records',
      other: 'Other',
      pending: 'Pending',
      emptyColumn: 'Empty',
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

  // Intersection Observer for lazy loading images
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const recordId = entry.target.getAttribute('data-record-id');
            if (recordId) {
              setVisibleImageIds((prev) => new Set(prev).add(recordId));
            }
          }
        });
      },
      { rootMargin: '50px' } // Start loading 50px before image enters viewport
    );

    // Re-observe images when records change
    const imageElements = document.querySelectorAll('[data-record-id]');
    imageElements.forEach((el) => observer.observe(el));

    return () => {
      imageElements.forEach((el) => observer.unobserve(el));
    };
  }, [attendanceRecords]);

  const loadData = async () => {
    setIsLoading(true);
    // Reset failed photo IDs khi load lại data để thử load lại các ảnh đã fail trước đó
    setFailedPhotoIds(new Set());
    setVisibleImageIds(new Set()); // Reset visible images để trigger IntersectionObserver lại
    setRetryAttempts(new Map()); // Reset retry attempts
    try {
      // Tối ưu: Chỉ load 500 records đầu tiên để tránh lag
      // Nếu cần tất cả, có thể load thêm khi scroll hoặc filter
      const records = await getAllAttendance(500);
      const users = await getAllUsers();
      
      // Debug: Log một vài URLs để kiểm tra
      const recordsWithPhotos = records.filter(r => r.photoUrl);
      if (recordsWithPhotos.length > 0) {
        console.log('📸 Sample photo URLs from DB:', recordsWithPhotos.slice(0, 3).map(r => ({
          recordId: r.id,
          photoUrl: r.photoUrl,
          urlLength: r.photoUrl?.length,
          isComplete: r.photoUrl?.includes('CHECK_IN') || r.photoUrl?.includes('CHECK_OUT'),
        })));
      }
      
      setAttendanceRecords(records);
      setEmployees(users);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getFilteredData = () => {
    let filtered = attendanceRecords;

    if (selectedEmployeeForAttendance !== 'ALL') {
      filtered = filtered.filter(r => r.userId === selectedEmployeeForAttendance);
    }

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

    return filtered;
  };

  const filteredData = getFilteredData();

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
        [text.exportType]: record.type === AttendanceType.CHECK_IN ? text.checkIn : text.checkOut,
        [text.exportStatus]: getStatusLabel(record.status).label,
        [text.exportAddress]: record.location?.address || `${record.location?.lat}, ${record.location?.lng}`,
        [text.exportNotes]: record.notes || '',
      };
    });
    const dateRange = attendanceFilter === 'TODAY' ? 'today' : 
                      attendanceFilter === 'WEEK' ? 'week' :
                      attendanceFilter === 'MONTH' ? 'month' : 'all';
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

  const KANBAN_COLUMNS: { status: AttendanceStatus; label: string; headerClass: string }[] = [
    { status: AttendanceStatus.ON_TIME, label: text.onTime, headerClass: 'bg-emerald-50 border-emerald-200/60 text-emerald-800' },
    { status: AttendanceStatus.LATE, label: text.late, headerClass: 'bg-amber-50 border-amber-200/60 text-amber-800' },
    { status: AttendanceStatus.EARLY_LEAVE, label: text.earlyLeave, headerClass: 'bg-yellow-50 border-yellow-200/60 text-yellow-800' },
    { status: AttendanceStatus.OVERTIME, label: text.overtime, headerClass: 'bg-violet-50 border-violet-200/60 text-violet-800' },
  ];

  const getRecordsByStatus = (status: AttendanceStatus) => {
    return filteredData.filter(r => r.status === status);
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-sky-50">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-slate-700">{text.filters}</h3>
          <div className="flex items-center gap-2">
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
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-2">{text.filterByTime}</label>
            <div className="flex space-x-2">
              {['TODAY', 'WEEK', 'MONTH', 'ALL'].map(f => (
                <button
                  key={f}
                  onClick={() => setAttendanceFilter(f)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    attendanceFilter === f ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {f === 'TODAY' ? text.today : f === 'WEEK' ? text.week : f === 'MONTH' ? text.month : text.all}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-2">{text.filterByEmployee}</label>
            <select
              value={selectedEmployeeForAttendance}
              onChange={(e) => setSelectedEmployeeForAttendance(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
            >
              <option value="ALL">{text.allEmployees}</option>
              {employees.filter(e => e.role !== UserRole.ADMIN).map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name} - {emp.department}</option>
              ))}
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
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50/50">
            <span className="text-sm font-medium text-slate-600">{filteredData.length} {text.records}</span>
            <div className="flex rounded-xl overflow-hidden border border-slate-200">
              <button
                onClick={() => setViewMode('kanban')}
                className={`px-4 py-2 text-xs font-bold transition-colors ${
                  viewMode === 'kanban' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'
                }`}
              >
                {text.viewKanban}
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`px-4 py-2 text-xs font-bold transition-colors ${
                  viewMode === 'table' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'
                }`}
              >
                {text.viewTable}
              </button>
            </div>
          </div>
          <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
            {viewMode === 'kanban' ? (
              <div className="p-4 flex gap-3 overflow-x-auto min-h-[60vh]">
                {KANBAN_COLUMNS.map((col) => {
                  const records = getRecordsByStatus(col.status);
                  return (
                    <div
                      key={col.status}
                      className="flex-shrink-0 w-56 bg-slate-50/80 rounded-xl border border-slate-200/80 flex flex-col shadow-sm"
                    >
                      <div className={`px-3 py-2 rounded-t-xl border-b font-semibold text-xs flex items-center justify-between ${col.headerClass}`}>
                        <span>{col.label}</span>
                        <span className="min-w-[1.25rem] h-5 flex items-center justify-center rounded-md bg-white/70 text-[11px] font-bold">{records.length}</span>
                      </div>
                      <div className="flex-1 p-2 space-y-1.5 overflow-y-auto max-h-[calc(70vh-7rem)]">
                        {records.length === 0 ? (
                          <p className="text-[11px] text-slate-400 py-6 text-center">{text.emptyColumn}</p>
                        ) : (
                          records.map((record: AttendanceRecord) => {
                            const employee = employees.find(e => e.id === record.userId);
                            return (
                              <div
                                key={record.id}
                                className="bg-white rounded-lg p-2 border border-slate-100 hover:border-sky-200 hover:shadow-sm transition-all group"
                              >
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                                    {employee && setView ? (
                                      <button
                                        onClick={() => setView('employee-profile', { employeeId: employee.id })}
                                        className="text-xs font-semibold text-slate-800 hover:text-blue-600 hover:underline text-left truncate block w-full leading-tight"
                                      >
                                        {employee.name}
                                      </button>
                                    ) : (
                                      <p className="text-xs font-semibold text-slate-800 truncate leading-tight">{employee?.name || record.userId}</p>
                                    )}
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="text-[11px] text-slate-500 tabular-nums">
                                        {new Date(record.timestamp).toLocaleTimeString(language === 'vi' ? 'vi-VN' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                      <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${record.type === AttendanceType.CHECK_IN ? 'bg-blue-100 text-blue-600' : 'bg-cyan-100 text-cyan-600'}`}>
                                        {record.type === AttendanceType.CHECK_IN ? text.checkIn : text.checkOut}
                                      </span>
                                    </div>
                                  </div>
                                  <button
                                    onClick={async () => {
                                      if (confirm(text.confirmDelete)) {
                                        if (record.photoUrl) await deleteAttendancePhoto(record.photoUrl);
                                        await deleteAttendance(record.id);
                                        loadData();
                                      }
                                    }}
                                    className="opacity-60 hover:opacity-100 text-red-500 hover:text-red-600 p-0.5 shrink-0 transition-opacity"
                                    title={text.delete}
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">{text.type}</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">{text.employee}</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">{text.time}</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">{text.location}</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">{text.photo}</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">{text.status}</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">{text.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredData.map((record: AttendanceRecord) => {
                  const employee = employees.find(e => e.id === record.userId);
                  const statusInfo = getStatusLabel(record.status);
                  return (
                    <tr key={record.id} className="hover:bg-sky-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold ${
                          record.type === AttendanceType.CHECK_IN ? 'bg-blue-100 text-blue-600' : 'bg-cyan-100 text-cyan-600'
                        }`}>
                          {record.type === AttendanceType.CHECK_IN ? text.checkIn : text.checkOut}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          {employee && setView ? (
                            <button
                              onClick={() => setView('employee-profile', { employeeId: employee.id })}
                              className="text-sm font-bold text-blue-600 hover:text-blue-700 hover:underline transition-colors text-left"
                            >
                              {employee.name}
                            </button>
                          ) : (
                            <p className="text-sm font-bold text-slate-800">{employee?.name || record.userId}</p>
                          )}
                          <p className="text-xs text-slate-500">{employee?.department || ''}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm text-slate-700">{new Date(record.timestamp).toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US')}</p>
                          <p className="text-xs text-slate-500">{new Date(record.timestamp).toLocaleTimeString(language === 'vi' ? 'vi-VN' : 'en-US', { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {record.location ? (
                          <p className="text-xs text-slate-600">
                            {record.location.address || `${record.location.lat.toFixed(6)}, ${record.location.lng.toFixed(6)}`}
                          </p>
                        ) : (
                          <p className="text-xs text-slate-400">-</p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {record.photoUrl ? (
                          (() => {
                            const photoUrl = record.photoUrl;
                            
                            // Debug: Log URL để kiểm tra có bị truncate không
                            if (photoUrl.includes('supabase.co/storage') && photoUrl.length < 100) {
                              console.warn('⚠️ URL seems truncated in render:', {
                                recordId: record.id,
                                photoUrl,
                                length: photoUrl.length,
                              });
                            }
                            
                            const isBase64 = isBase64DataUrl(photoUrl);
                            const isValid = isValidUrl(photoUrl);
                            const hasFailed = failedPhotoIds.has(record.id);

                            // Nếu URL không hợp lệ, hiển thị lỗi ngay
                            if (!isValid) {
                              return (
                                <div
                                  className="w-16 h-16 rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-[10px] text-slate-400 text-center leading-tight px-1"
                                  title="URL ảnh không hợp lệ"
                                >
                                  URL lỗi
                                </div>
                              );
                            }
                            
                            // Nếu đã fail và đã retry đủ lần, hiển thị "Không tải được"
                            // Nhưng chỉ khi đã trong viewport (đã thử load)
                            const retryCount = retryAttempts.get(record.id) || 0;
                            if (hasFailed && retryCount >= 2) {
                              return (
                                <div
                                  className="w-16 h-16 rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-[10px] text-slate-400 text-center leading-tight px-1"
                                  title="Ảnh không tải được sau nhiều lần thử (có thể do bản ghi cũ hoặc bucket chưa public)"
                                >
                                  Không tải được
                                </div>
                              );
                            }

                            // Base64: hiển thị trực tiếp (không cần check error)
                            if (isBase64) {
                              return (
                                <button
                                  onClick={() => setSelectedPhoto(photoUrl)}
                                  className="w-16 h-16 rounded-lg overflow-hidden border-2 border-slate-200 hover:border-blue-500 transition-colors"
                                >
                                  <img
                                    src={photoUrl}
                                    alt="Attendance photo"
                                    className="w-full h-full object-cover"
                                  />
                                </button>
                              );
                            }

                            // HTTP URL: Lazy load chỉ khi image trong viewport
                            const shouldLoad = visibleImageIds.has(record.id);
                            
                            // Debug: Log URL khi render
                            if (shouldLoad && photoUrl.includes('supabase.co/storage')) {
                              console.log('🖼️ Loading image:', {
                                recordId: record.id,
                                photoUrl,
                                urlLength: photoUrl.length,
                                isComplete: photoUrl.includes('CHECK_IN') || photoUrl.includes('CHECK_OUT'),
                              });
                            }
                            
                            // Nếu đã fail trước đó và chưa trong viewport, không thử lại ngay
                            // Chỉ hiển thị "Không tải được" nếu đã thử load và fail
                            if (hasFailed && !shouldLoad) {
                              return (
                                <div
                                  className="w-16 h-16 rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-[10px] text-slate-400 text-center leading-tight px-1"
                                  title="Ảnh không tải được (có thể do bản ghi cũ hoặc bucket chưa public)"
                                >
                                  Không tải được
                                </div>
                              );
                            }
                            
                            return (
                              <button
                                onClick={() => setSelectedPhoto(photoUrl)}
                                className="w-16 h-16 rounded-lg overflow-hidden border-2 border-slate-200 hover:border-blue-500 transition-colors bg-slate-100"
                                data-record-id={record.id}
                              >
                                {shouldLoad ? (
                                  <img
                                    src={photoUrl}
                                    alt="Attendance photo"
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                    decoding="async"
                                    sizes="(max-width: 768px) 100vw, 400px"
                                    crossOrigin="anonymous"
                                    onError={async (e) => {
                                      const target = e.target as HTMLImageElement;
                                      const currentAttempts = retryAttempts.get(record.id) || 0;
                                      const maxRetries = 2; // Retry tối đa 2 lần
                                      
                                      // Extract error details từ event
                                      const errorDetails: any = {
                                        photoUrl,
                                        recordId: record.id,
                                        userId: record.userId,
                                        timestamp: new Date(record.timestamp).toISOString(),
                                        type: record.type,
                                        urlParts: photoUrl.split('/'),
                                        isSupabaseUrl: photoUrl.includes('supabase.co/storage'),
                                        naturalWidth: target.naturalWidth,
                                        naturalHeight: target.naturalHeight,
                                        complete: target.complete,
                                        attempt: currentAttempts + 1,
                                      };
                                      
                                      // Test URL và check file existence
                                      const filename = extractFilenameFromUrl(photoUrl);
                                      errorDetails.extractedFilename = filename;
                                      
                                      // Test URL accessibility
                                      const urlTest = await testPhotoUrl(photoUrl);
                                      errorDetails.urlTest = urlTest;
                                      
                                      // Check if file exists on Storage
                                      const fileExists = await checkPhotoExists(photoUrl);
                                      errorDetails.fileExists = fileExists;
                                      
                                      console.warn(`❌ Failed to load photo for record ${record.id} (attempt ${currentAttempts + 1}/${maxRetries + 1}):`, errorDetails);
                                      
                                      // Nếu file không tồn tại hoặc URL không accessible, không retry
                                      if (!fileExists || !urlTest.success) {
                                        console.error(`❌ Photo URL invalid or file missing. Marking as failed immediately.`, {
                                          photoUrl,
                                          fileExists,
                                          urlTest,
                                        });
                                        setFailedPhotoIds((prev) => new Set(prev).add(record.id));
                                        return;
                                      }
                                      
                                      // Retry mechanism: thử lại sau 1 giây nếu chưa đạt max retries
                                      if (currentAttempts < maxRetries) {
                                        setRetryAttempts((prev) => {
                                          const next = new Map(prev);
                                          next.set(record.id, currentAttempts + 1);
                                          return next;
                                        });
                                        
                                        // Retry sau 1 giây bằng cách force re-render img
                                        setTimeout(() => {
                                          setVisibleImageIds((prev) => {
                                            const next = new Set(prev);
                                            next.delete(record.id); // Remove để trigger lại IntersectionObserver
                                            setTimeout(() => next.add(record.id), 100);
                                            return next;
                                          });
                                        }, 1000);
                                      } else {
                                        // Đã retry đủ, đánh dấu là failed
                                        console.error(`❌ Photo failed after ${maxRetries + 1} attempts. URL:`, photoUrl);
                                        setFailedPhotoIds((prev) => new Set(prev).add(record.id));
                                      }
                                    }}
                                    onLoad={() => {
                                      // Photo loaded successfully - remove from failed list if was there
                                      setFailedPhotoIds((prev) => {
                                        const next = new Set(prev);
                                        next.delete(record.id);
                                        return next;
                                      });
                                    }}
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-[8px] text-slate-400">
                                    Loading...
                                  </div>
                                )}
                              </button>
                            );
                          })()
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-xs font-bold px-2 py-1 rounded-lg ${statusInfo.className}`}>
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={async () => {
                            if (confirm(text.confirmDelete)) {
                              // Xóa ảnh khỏi Storage nếu có
                              if (record.photoUrl) {
                                await deleteAttendancePhoto(record.photoUrl);
                              }
                              await deleteAttendance(record.id);
                              loadData();
                            }
                          }}
                          className="text-sm text-red-600 hover:text-red-700 font-medium"
                        >
                          {text.delete}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            )}
          </div>
        </div>
      )}

      {/* Photo Modal */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-white rounded-2xl overflow-hidden shadow-2xl">
            <button
              onClick={() => setSelectedPhoto(null)}
              className="absolute top-4 right-4 z-10 w-10 h-10 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow-lg transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <img
              src={selectedPhoto}
              alt="Attendance photo"
              className="w-full h-full object-contain max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceManagement;
