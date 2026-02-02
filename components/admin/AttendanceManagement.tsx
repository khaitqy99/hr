import React, { useState, useEffect } from 'react';
import { AttendanceRecord, AttendanceType, AttendanceStatus, User, UserRole } from '../../types';
import { getAllAttendance, deleteAttendance, getAllUsers } from '../../services/db';

const AttendanceManagement: React.FC = () => {
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [attendanceFilter, setAttendanceFilter] = useState<string>('ALL');
  const [selectedEmployeeForAttendance, setSelectedEmployeeForAttendance] = useState<string>('ALL');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const records = await getAllAttendance();
    const users = await getAllUsers();
    setAttendanceRecords(records);
    setEmployees(users);
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

  const getStatusLabel = (status: AttendanceStatus) => {
    switch (status) {
      case AttendanceStatus.ON_TIME:
        return { label: 'Đúng giờ', className: 'bg-green-100 text-green-600' };
      case AttendanceStatus.LATE:
        return { label: 'Trễ', className: 'bg-orange-100 text-orange-600' };
      case AttendanceStatus.EARLY_LEAVE:
        return { label: 'Về sớm', className: 'bg-yellow-100 text-yellow-600' };
      case AttendanceStatus.OVERTIME:
        return { label: 'Tăng ca', className: 'bg-purple-100 text-purple-600' };
      default:
        return { label: status, className: 'bg-slate-100 text-slate-600' };
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800">Quản lý chấm công</h2>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-sky-50">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-2">Lọc theo thời gian</label>
            <div className="flex space-x-2">
              {['TODAY', 'WEEK', 'MONTH', 'ALL'].map(f => (
                <button
                  key={f}
                  onClick={() => setAttendanceFilter(f)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    attendanceFilter === f ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {f === 'TODAY' ? 'Hôm nay' : f === 'WEEK' ? 'Tuần' : f === 'MONTH' ? 'Tháng' : 'Tất cả'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-2">Lọc theo nhân viên</label>
            <select
              value={selectedEmployeeForAttendance}
              onChange={(e) => setSelectedEmployeeForAttendance(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
            >
              <option value="ALL">Tất cả nhân viên</option>
              {employees.filter(e => e.role !== UserRole.ADMIN).map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name} - {emp.department}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      {filteredData.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-sky-50">
          <p className="text-slate-400 font-medium">Chưa có dữ liệu chấm công</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-sky-50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">Loại</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">Nhân viên</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">Thời gian</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">Vị trí</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">Trạng thái</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">Thao tác</th>
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
                          {record.type === AttendanceType.CHECK_IN ? 'Vào' : 'Ra'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm font-bold text-slate-800">{employee?.name || record.userId}</p>
                          <p className="text-xs text-slate-500">{employee?.department || ''}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm text-slate-700">{new Date(record.timestamp).toLocaleDateString('vi-VN')}</p>
                          <p className="text-xs text-slate-500">{new Date(record.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</p>
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
                        <span className={`text-xs font-bold px-2 py-1 rounded-lg ${statusInfo.className}`}>
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={async () => {
                            if (confirm('Bạn có chắc muốn xóa bản ghi này?')) {
                              await deleteAttendance(record.id);
                              loadData();
                            }
                          }}
                          className="text-sm text-red-600 hover:text-red-700 font-medium"
                        >
                          Xóa
                        </button>
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
