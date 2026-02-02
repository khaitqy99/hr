import React, { useState, useEffect } from 'react';
import { SystemConfig } from '../../types';

const CONFIG_KEY = 'hr_connect_system_config';

const getConfigs = (): SystemConfig[] => {
  const defaultConfigs: SystemConfig[] = [
    { id: 'office-lat', key: 'office_latitude', value: '10.040675858019696', description: 'Vĩ độ văn phòng', category: 'ATTENDANCE', updatedAt: Date.now() },
    { id: 'office-lng', key: 'office_longitude', value: '105.78463187148355', description: 'Kinh độ văn phòng', category: 'ATTENDANCE', updatedAt: Date.now() },
    { id: 'office-radius', key: 'office_radius_meters', value: '200', description: 'Bán kính cho phép chấm công (mét)', category: 'ATTENDANCE', updatedAt: Date.now() },
    { id: 'work-start', key: 'work_start_time', value: '08:00', description: 'Giờ bắt đầu làm việc', category: 'ATTENDANCE', updatedAt: Date.now() },
    { id: 'work-end', key: 'work_end_time', value: '17:00', description: 'Giờ kết thúc làm việc', category: 'ATTENDANCE', updatedAt: Date.now() },
    { id: 'work-hours', key: 'work_hours_per_day', value: '8', description: 'Số giờ làm việc mỗi ngày', category: 'ATTENDANCE', updatedAt: Date.now() },
    { id: 'standard-days', key: 'standard_work_days', value: '27', description: 'Số ngày công tiêu chuẩn mỗi tháng', category: 'PAYROLL', updatedAt: Date.now() },
    { id: 'insurance-rate', key: 'social_insurance_rate', value: '10.5', description: 'Tỷ lệ khấu trừ BHXH (%)', category: 'PAYROLL', updatedAt: Date.now() },
    { id: 'ot-rate', key: 'overtime_rate', value: '1.5', description: 'Hệ số tính lương làm thêm giờ', category: 'PAYROLL', updatedAt: Date.now() },
  ];
  
  const saved = localStorage.getItem(CONFIG_KEY);
  if (saved) {
    return JSON.parse(saved);
  }
  localStorage.setItem(CONFIG_KEY, JSON.stringify(defaultConfigs));
  return defaultConfigs;
};

const saveConfigs = (configs: SystemConfig[]) => {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(configs));
};

const SystemConfigManagement: React.FC = () => {
  const [configs, setConfigs] = useState<SystemConfig[]>([]);
  const [editingConfig, setEditingConfig] = useState<SystemConfig | null>(null);
  const [editValue, setEditValue] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setConfigs(getConfigs());
  };

  const handleEdit = (config: SystemConfig) => {
    setEditingConfig(config);
    setEditValue(config.value);
  };

  const handleSave = () => {
    if (!editingConfig) return;
    
    const allConfigs = getConfigs();
    const index = allConfigs.findIndex(c => c.id === editingConfig.id);
    if (index !== -1) {
      allConfigs[index] = {
        ...allConfigs[index],
        value: editValue,
        updatedAt: Date.now(),
      };
      saveConfigs(allConfigs);
      loadData();
      setEditingConfig(null);
      setEditValue('');
    }
  };

  const handleCancel = () => {
    setEditingConfig(null);
    setEditValue('');
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'ATTENDANCE':
        return 'Chấm công';
      case 'PAYROLL':
        return 'Lương';
      case 'GENERAL':
        return 'Chung';
      case 'NOTIFICATION':
        return 'Thông báo';
      default:
        return category;
    }
  };

  const groupedConfigs = configs.reduce((acc, config) => {
    if (!acc[config.category]) {
      acc[config.category] = [];
    }
    acc[config.category].push(config);
    return acc;
  }, {} as Record<string, SystemConfig[]>);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800">Cấu hình hệ thống</h2>
      </div>

      {Object.entries(groupedConfigs).map(([category, categoryConfigs]) => (
        <div key={category} className="bg-white p-6 rounded-2xl shadow-sm border border-sky-50">
          <h3 className="text-lg font-bold text-slate-700 mb-4">{getCategoryLabel(category)}</h3>
          <div className="space-y-3">
            {categoryConfigs.map((config) => (
              <div key={config.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                <div className="flex-1">
                  <p className="text-sm font-bold text-slate-800">{config.description || config.key}</p>
                  <p className="text-xs text-slate-500 mt-1">{config.key}</p>
                </div>
                <div className="flex items-center space-x-3">
                  {editingConfig?.id === config.id ? (
                    <>
                      <input
                        type="text"
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm w-32"
                      />
                      <button
                        onClick={handleSave}
                        className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors"
                      >
                        Lưu
                      </button>
                      <button
                        onClick={handleCancel}
                        className="px-4 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-200 transition-colors"
                      >
                        Hủy
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="text-sm font-medium text-slate-700">{config.value}</span>
                      <button
                        onClick={() => handleEdit(config)}
                        className="px-4 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors"
                      >
                        Sửa
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default SystemConfigManagement;
