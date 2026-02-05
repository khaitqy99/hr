import React, { useState, useEffect } from 'react';
import { User, UserRole, ShiftRegistration, AttendanceRecord, AttendanceType, EmployeeStatus, Department } from '../../types';
import { getAllUsers, getShiftRegistrations, getAllAttendance, getDepartments } from '../../services/db';

interface ReportsDashboardProps {
  onRegisterReload?: (handler: () => void | Promise<void>) => void;
}

const ReportsDashboard: React.FC<ReportsDashboardProps> = ({ onRegisterReload }) => {
  const [employees, setEmployees] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [shiftRequests, setShiftRequests] = useState<ShiftRegistration[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (onRegisterReload) {
      onRegisterReload(loadData);
    }
  }, [onRegisterReload]);

  const loadData = async () => {
    const [users, depts, shifts, attendance] = await Promise.all([
      getAllUsers(),
      getDepartments(),
      getShiftRegistrations(undefined, UserRole.ADMIN),
      getAllAttendance()
    ]);
    setEmployees(users);
    setDepartments(depts.filter(d => d.isActive));
    setShiftRequests(shifts);
    setAttendanceRecords(attendance);
  };

  const todayAttendanceCount = new Set(
    attendanceRecords.filter(r => {
      const today = new Date().setHours(0, 0, 0, 0);
      return r.timestamp >= today && r.type === AttendanceType.CHECK_IN;
    }).map(r => r.userId)
  ).size;

  const totalActiveEmployees = employees.filter(e => e.role !== UserRole.ADMIN && e.status === EmployeeStatus.ACTIVE).length;

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-2xl border border-blue-200">
          <div className="text-3xl font-bold text-blue-600">{employees.filter(e => e.role !== UserRole.ADMIN).length}</div>
          <div className="text-sm text-blue-700 font-medium mt-2">Tổng nhân viên</div>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-2xl border border-green-200">
          <div className="text-3xl font-bold text-green-600">
            {employees.filter(e => e.status === EmployeeStatus.ACTIVE && e.role !== UserRole.ADMIN).length}
          </div>
          <div className="text-sm text-green-700 font-medium mt-2">Đang làm việc</div>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-2xl border border-purple-200">
          <div className="text-3xl font-bold text-purple-600">
            {shiftRequests.filter(r => r.status === 'PENDING').length}
          </div>
          <div className="text-sm text-purple-700 font-medium mt-2">Đăng ký ca chờ</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Department Stats */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-sky-50">
          <h3 className="text-lg font-bold text-slate-700 mb-4">Thống kê theo phòng ban</h3>
          <div className="space-y-3">
            {departments.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">Chưa có phòng ban nào</p>
            ) : (
              departments.map(dept => {
                const deptEmployees = employees.filter(e => e.department === dept.name && e.role !== UserRole.ADMIN);
                const activeCount = deptEmployees.filter(e => e.status === EmployeeStatus.ACTIVE).length;
                return (
                  <div key={dept.id} className="flex justify-between items-center p-4 bg-slate-50 rounded-xl">
                    <div>
                      <span className="text-sm font-medium text-slate-700">{dept.name}</span>
                      {dept.code && (
                        <span className="text-xs text-slate-500 ml-2">({dept.code})</span>
                      )}
                    </div>
                    <span className="text-sm font-bold text-blue-600">{activeCount}/{deptEmployees.length}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Attendance Summary */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-sky-50">
          <h3 className="text-lg font-bold text-slate-700 mb-4">Tổng quan chấm công hôm nay</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-4 bg-green-50 rounded-xl">
              <span className="text-sm text-green-700 font-medium">Đã chấm công</span>
              <span className="text-lg font-bold text-green-600">{todayAttendanceCount}</span>
            </div>
            <div className="flex justify-between items-center p-4 bg-orange-50 rounded-xl">
              <span className="text-sm text-orange-700 font-medium">Chưa chấm công</span>
              <span className="text-lg font-bold text-orange-600">{totalActiveEmployees - todayAttendanceCount}</span>
            </div>
            <div className="pt-4 border-t border-slate-200">
              <div className="text-xs text-slate-500 mb-2">Tỷ lệ chấm công</div>
              <div className="w-full bg-slate-200 rounded-full h-3">
                <div
                  className="bg-blue-600 h-3 rounded-full transition-all"
                  style={{ width: `${totalActiveEmployees > 0 ? (todayAttendanceCount / totalActiveEmployees) * 100 : 0}%` }}
                ></div>
              </div>
              <div className="text-xs text-slate-600 mt-1">
                {totalActiveEmployees > 0 ? Math.round((todayAttendanceCount / totalActiveEmployees) * 100) : 0}%
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* System Info */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-sky-50">
        <h3 className="text-lg font-bold text-slate-700 mb-4">Thông tin hệ thống</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-slate-50 rounded-xl">
            <div className="text-2xl font-bold text-slate-700">{employees.length}</div>
            <div className="text-xs text-slate-500 mt-1">Tổng người dùng</div>
          </div>
          <div className="text-center p-4 bg-slate-50 rounded-xl">
            <div className="text-2xl font-bold text-slate-700">{attendanceRecords.length}</div>
            <div className="text-xs text-slate-500 mt-1">Bản ghi chấm công</div>
          </div>
          <div className="text-center p-4 bg-slate-50 rounded-xl">
            <div className="text-2xl font-bold text-slate-700">{shiftRequests.length}</div>
            <div className="text-xs text-slate-500 mt-1">Đăng ký ca</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportsDashboard;
