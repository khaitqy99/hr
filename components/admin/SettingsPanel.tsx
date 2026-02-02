import React, { useState, useEffect } from 'react';
import { getAllAttendance, getLeaveRequests, getShiftRegistrations, getAllUsers } from '../../services/db';

const SettingsPanel: React.FC = () => {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalAttendance: 0,
    totalLeaveRequests: 0,
    totalShiftRequests: 0,
  });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    const users = await getAllUsers();
    const attendance = await getAllAttendance();
    const leaves = await getLeaveRequests(undefined, 'ADMIN' as any);
    const shifts = await getShiftRegistrations(undefined, 'ADMIN' as any);
    setStats({
      totalUsers: users.length,
      totalAttendance: attendance.length,
      totalLeaveRequests: leaves.length,
      totalShiftRequests: shifts.length,
    });
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-800">Cài đặt hệ thống</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* System Settings */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-sky-50">
          <h3 className="text-lg font-bold text-slate-700 mb-4">Cấu hình hệ thống</h3>
          
          <div className="space-y-4">
            <div className="p-4 bg-sky-50 rounded-xl">
              <label className="block text-xs font-bold text-slate-500 mb-2">Địa chỉ văn phòng</label>
              <div className="text-sm text-slate-700 font-medium">
                99B Nguyễn Trãi, Ninh Kiều, Cần Thơ
              </div>
            </div>

            <div className="p-4 bg-sky-50 rounded-xl">
              <label className="block text-xs font-bold text-slate-500 mb-2">Bán kính cho phép chấm công</label>
              <div className="text-sm text-slate-700 font-medium">200 mét</div>
            </div>

            <div className="p-4 bg-sky-50 rounded-xl">
              <label className="block text-xs font-bold text-slate-500 mb-2">Giờ làm việc tiêu chuẩn</label>
              <div className="text-sm text-slate-700 font-medium">08:00 - 17:00 (8 giờ/ngày)</div>
            </div>

            <div className="p-4 bg-sky-50 rounded-xl">
              <label className="block text-xs font-bold text-slate-500 mb-2">Số ngày công tiêu chuẩn/tháng</label>
              <div className="text-sm text-slate-700 font-medium">27 ngày</div>
            </div>

            <div className="p-4 bg-sky-50 rounded-xl">
              <label className="block text-xs font-bold text-slate-500 mb-2">Tỷ lệ khấu trừ BHXH</label>
              <div className="text-sm text-slate-700 font-medium">10.5%</div>
            </div>
          </div>
        </div>

        {/* System Info */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-sky-50">
          <h3 className="text-lg font-bold text-slate-700 mb-4">Thông tin hệ thống</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-4 bg-slate-50 rounded-xl">
              <span className="text-sm text-slate-600">Tổng số người dùng:</span>
              <span className="text-sm font-bold text-slate-700">{stats.totalUsers}</span>
            </div>
            <div className="flex justify-between items-center p-4 bg-slate-50 rounded-xl">
              <span className="text-sm text-slate-600">Tổng số bản ghi chấm công:</span>
              <span className="text-sm font-bold text-slate-700">{stats.totalAttendance}</span>
            </div>
            <div className="flex justify-between items-center p-4 bg-slate-50 rounded-xl">
              <span className="text-sm text-slate-600">Tổng số đơn nghỉ phép:</span>
              <span className="text-sm font-bold text-slate-700">{stats.totalLeaveRequests}</span>
            </div>
            <div className="flex justify-between items-center p-4 bg-slate-50 rounded-xl">
              <span className="text-sm text-slate-600">Tổng số đăng ký ca:</span>
              <span className="text-sm font-bold text-slate-700">{stats.totalShiftRequests}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;
