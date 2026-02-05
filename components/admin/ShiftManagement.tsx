import React, { useState, useEffect, useMemo } from 'react';
import { ShiftRegistration, RequestStatus, User, UserRole, ShiftTime, OFF_TYPE_LABELS } from '../../types';
import { getShiftRegistrations, updateShiftStatus, getAllUsers } from '../../services/db';

const DAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const DEFAULT_IN = '09:00';
const DEFAULT_OUT = '18:00';

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

interface ShiftManagementProps {
  onRegisterReload?: (handler: () => void | Promise<void>) => void;
}

const ShiftManagement: React.FC<ShiftManagementProps> = ({ onRegisterReload }) => {
  const [shiftRequests, setShiftRequests] = useState<ShiftRegistration[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [weekStart, setWeekStart] = useState<Date>(() => getWeekStart(new Date()));
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [departmentFilter, setDepartmentFilter] = useState<string>('');
  const [searchName, setSearchName] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadData();
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

  const showMsg = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleAction = async (id: string, status: RequestStatus) => {
    setActionLoadingId(id);
    setMessage(null);
    try {
      await updateShiftStatus(id, status);
      await loadData();
      showMsg('success', status === RequestStatus.APPROVED ? 'Đã chấp thuận.' : 'Đã từ chối.');
    } catch (e) {
      showMsg('error', 'Cập nhật thất bại. Thử lại.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleBulkAction = async (userId: string, status: RequestStatus) => {
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
      showMsg('success', `Đã ${status === RequestStatus.APPROVED ? 'chấp thuận' : 'từ chối'} ${pendingInWeek.length} đăng ký.`);
    } catch (e) {
      showMsg('error', 'Cập nhật thất bại. Thử lại.');
    } finally {
      setActionLoadingId(null);
    }
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

  const departments = useMemo(
    () => Array.from(new Set(employees.map((u) => u.department).filter(Boolean))).sort(),
    [employees]
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-bold text-slate-800">Quản lý đăng ký ca</h2>
      </div>

      {message && (
        <div
          className={`rounded-xl px-4 py-2 text-sm font-medium ${
            message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
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
        <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-slate-100">
          <span className="text-xs font-medium text-slate-500">Lọc:</span>
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white text-slate-700"
          >
            <option value="">Tất cả bộ phận</option>
            {departments.map((d) => (
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
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-bold text-slate-600 uppercase border-r border-b border-slate-300 first:border-l">
                  Nhân viên
                </th>
                <th className="px-2 py-2 text-left text-xs font-bold text-slate-600 uppercase border-r border-b border-slate-300">
                  Bộ phận
                </th>
                {weekDates.map((d, i) => (
                  <th key={toDateKey(d)} colSpan={2} className="px-1 py-2 text-center text-xs font-bold text-slate-700 border-r border-b border-slate-300">
                    {DAY_LABELS[i]} {d.getDate()}/{d.getMonth() + 1}
                  </th>
                ))}
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
                        <span className="text-sm font-medium text-slate-800">{emp.name}</span>
                      </td>
                      <td className="px-2 py-2 border-r border-b border-slate-200">
                        <span className="text-xs text-slate-700">{emp.department || '—'}</span>
                      </td>
                      {weekDates.map((date) => {
                        const reg = getShiftFor(emp.id, date);
                        if (!reg) {
                          return (
                            <React.Fragment key={toDateKey(date)}>
                              <td className="px-1 py-2 border-r border-b border-slate-200 text-center text-xs text-slate-300">
                                —
                              </td>
                              <td className="px-1 py-2 border-r border-b border-slate-200 text-center text-xs text-slate-300">
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
                                className="px-2 py-2 border-r border-b border-slate-200 bg-red-50/80 text-red-700 text-xs font-medium text-center align-top"
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
                                    <div className="flex gap-1 mt-1" onClick={(e) => e.stopPropagation()}>
                                      <button
                                        type="button"
                                        disabled={actionLoadingId === reg.id}
                                        onClick={() => handleAction(reg.id, RequestStatus.APPROVED)}
                                        className="px-2 py-0.5 bg-blue-600 text-white rounded-lg text-[10px] font-medium hover:bg-blue-700 disabled:opacity-50"
                                        title="Chấp thuận"
                                      >
                                        Duyệt
                                      </button>
                                      <button
                                        type="button"
                                        disabled={actionLoadingId === reg.id}
                                        onClick={() => handleAction(reg.id, RequestStatus.REJECTED)}
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
                              className="px-1 py-2 border-r border-b border-slate-200 text-center text-xs relative align-top"
                              onClick={(e) => e.stopPropagation()}
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
                                    onClick={() => handleAction(reg.id, RequestStatus.APPROVED)}
                                    className="px-2 py-0.5 bg-blue-600 text-white rounded-lg text-[10px] font-medium hover:bg-blue-700 disabled:opacity-50"
                                    title="Chấp thuận"
                                  >
                                    Duyệt
                                  </button>
                                  <button
                                    type="button"
                                    disabled={actionLoadingId === reg.id}
                                    onClick={() => handleAction(reg.id, RequestStatus.REJECTED)}
                                    className="px-2 py-0.5 bg-white border border-slate-300 text-slate-600 rounded-lg text-[10px] font-medium hover:bg-slate-50 disabled:opacity-50"
                                    title="Từ chối"
                                  >
                                    Từ chối
                                  </button>
                                </div>
                              )}
                            </td>
                            <td className="px-1 py-2 border-r border-b border-slate-200 text-center text-xs align-top font-medium text-slate-800">
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
    </div>
  );
};

export default ShiftManagement;
