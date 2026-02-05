import React, { useState, useEffect } from 'react';
import { getAllAttendance, getShiftRegistrations, getAllUsers, getSystemConfigs, getConfigValue } from '../../services/db';

interface SettingsPanelProps {
  onRegisterReload?: (handler: () => void | Promise<void>) => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ onRegisterReload }) => {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalAttendance: 0,
    totalShiftRequests: 0,
  });
  const [configs, setConfigs] = useState<Record<string, string>>({});

  useEffect(() => {
    loadStats();
    loadConfigs();
  }, []);

  useEffect(() => {
    if (onRegisterReload) {
      onRegisterReload(loadStats);
    }
  }, [onRegisterReload]);

  const loadStats = async () => {
    const users = await getAllUsers();
    const attendance = await getAllAttendance();
    const shifts = await getShiftRegistrations(undefined, 'ADMIN' as any);
    setStats({
      totalUsers: users.length,
      totalAttendance: attendance.length,
      totalShiftRequests: shifts.length,
    });
  };

  const loadConfigs = async () => {
    try {
      const allConfigs = await getSystemConfigs();
      const configMap: Record<string, string> = {};
      allConfigs.forEach(config => {
        configMap[config.key] = config.value;
      });
      setConfigs(configMap);
    } catch (error) {
      console.error('Error loading configs:', error);
    }
  };

  return (
    <div className="space-y-6">
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
              <div className="text-xs text-slate-500 mt-1">
                Tọa độ: {configs.office_latitude || '10.040675858019696'}, {configs.office_longitude || '105.78463187148355'}
              </div>
            </div>

            <div className="p-4 bg-sky-50 rounded-xl">
              <label className="block text-xs font-bold text-slate-500 mb-2">Bán kính cho phép chấm công</label>
              <div className="text-sm text-slate-700 font-medium">
                {configs.office_radius_meters || '200'} mét
              </div>
            </div>

            <div className="p-4 bg-sky-50 rounded-xl">
              <label className="block text-xs font-bold text-slate-500 mb-2">Giờ làm việc tiêu chuẩn</label>
              <div className="text-sm text-slate-700 font-medium">
                {configs.work_start_time || '08:00'} - {configs.work_end_time || '17:00'} ({configs.work_hours_per_day || '8'} giờ/ngày)
              </div>
            </div>

            <div className="p-4 bg-sky-50 rounded-xl">
              <label className="block text-xs font-bold text-slate-500 mb-2">Số ngày công tiêu chuẩn/tháng</label>
              <div className="text-sm text-slate-700 font-medium">
                {configs.standard_work_days || '27'} ngày
              </div>
            </div>

            <div className="p-4 bg-sky-50 rounded-xl">
              <label className="block text-xs font-bold text-slate-500 mb-2">Tỷ lệ khấu trừ BHXH</label>
              <div className="text-sm text-slate-700 font-medium">
                {configs.social_insurance_rate || '10.5'}%
              </div>
            </div>

            <div className="p-4 bg-sky-50 rounded-xl">
              <label className="block text-xs font-bold text-slate-500 mb-2">Hệ số tính lương làm thêm giờ</label>
              <div className="text-sm text-slate-700 font-medium">
                {configs.overtime_rate || '1.5'}x
              </div>
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
