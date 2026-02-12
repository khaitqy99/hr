import React, { useState, useEffect } from 'react';
import { SystemConfig } from '../../types';
import { getSystemConfigs, updateSystemConfig, createSystemConfig, isSupabaseAvailable } from '../../services/db';
import { supabase } from '../../services/supabase';

const DEFAULT_SYSTEM_CONFIGS = [
  // General (Chung)
  {
    key: 'office_latitude',
    value: '10.040675858019696',
    description: 'Vĩ độ văn phòng (Lat)',
    category: 'GENERAL'
  },
  {
    key: 'office_longitude',
    value: '105.78463187148355',
    description: 'Kinh độ văn phòng (Lng)',
    category: 'GENERAL'
  },
  {
    key: 'office_radius_meters',
    value: '200',
    description: 'Bán kính chấm công (mét)',
    category: 'GENERAL'
  },


  // Attendance (Chấm công)

  {
    key: 'work_hours_per_day',
    value: '8',
    description: 'Số giờ làm việc tiêu chuẩn/ngày',
    category: 'ATTENDANCE'
  },


  // Payroll (Lương)
  {
    key: 'standard_work_days',
    value: '26',
    description: 'Số ngày công tiêu chuẩn/tháng',
    category: 'PAYROLL'
  },
  {
    key: 'social_insurance_amount',
    value: '0',
    description: 'Số tiền đóng BHXH cố định',
    category: 'PAYROLL'
  },
  {
    key: 'overtime_rate',
    value: '1.5',
    description: 'Hệ số tăng ca',
    category: 'PAYROLL'
  }
];

interface SystemConfigManagementProps {
  onRegisterReload?: (handler: () => void | Promise<void>) => void;
}

const SystemConfigManagement: React.FC<SystemConfigManagementProps> = ({ onRegisterReload }) => {
  const [configs, setConfigs] = useState<SystemConfig[]>([]);
  const [editingConfig, setEditingConfig] = useState<SystemConfig | null>(null);
  const [editValue, setEditValue] = useState('');
  const [initializing, setInitializing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (onRegisterReload) {
      onRegisterReload(loadData);
    }
  }, [onRegisterReload]);

  const loadData = async () => {
    const allConfigs = await getSystemConfigs();
    const dbConfigMap = new Map(allConfigs.map(c => [c.key, c]));

    // Merge default configs with DB configs
    const mergedConfigs: SystemConfig[] = DEFAULT_SYSTEM_CONFIGS.map(def => {
      const existing = dbConfigMap.get(def.key);
      if (existing) {
        return {
          ...existing,
          description: def.description, // Prioritize description from code
          category: def.category as any
        };
      }
      // Config not found in DB -> return temp config
      return {
        id: `temp_${def.key}`,
        key: def.key,
        value: def.value,
        description: def.description,
        category: def.category as any,
        updatedAt: Date.now()
      };
    });
    setConfigs(mergedConfigs);
  };

  const handleEdit = (config: SystemConfig) => {
    setEditingConfig(config);
    setEditValue(config.value);
  };

  const handleSave = async () => {
    if (!editingConfig) return;

    try {
      if (editingConfig.id.startsWith('temp_')) {
        await createSystemConfig(
          editingConfig.key,
          editValue,
          editingConfig.description,
          editingConfig.category
        );
      } else {
        await updateSystemConfig(editingConfig.id, editValue);
      }

      loadData();
      setEditingConfig(null);
      setEditValue('');
    } catch (error: any) {
      alert(error?.message || 'Có lỗi xảy ra khi cập nhật cấu hình');
    }
  };

  const handleCancel = () => {
    setEditingConfig(null);
    setEditValue('');
  };

  const handleInitialize = async () => {
    if (!confirm('Bạn có chắc chắn muốn khởi tạo cấu hình mặc định? Dữ liệu hiện tại (nếu có) sẽ không bị ghi đè.')) return;

    setInitializing(true);
    try {
      if (isSupabaseAvailable()) {
        const { error } = await (supabase.from('system_configs') as any).upsert(
          DEFAULT_SYSTEM_CONFIGS.map(c => ({
            key: c.key,
            value: c.value,
            description: c.description,
            category: c.category,
            updated_at: Math.floor(Date.now() / 1000)
          })),
          { onConflict: 'key' }
        );

        if (error) throw error;
      } else {
        // Fallback localStorage
        const existingRaw = localStorage.getItem('hr_connect_system_configs');
        const existing: SystemConfig[] = existingRaw ? JSON.parse(existingRaw) : [];

        let addedCount = 0;
        DEFAULT_SYSTEM_CONFIGS.forEach(def => {
          if (!existing.find(e => e.key === def.key)) {
            existing.push({
              id: 'cfg_' + Date.now() + Math.random().toString(36).substr(2, 9),
              key: def.key,
              value: def.value,
              description: def.description,
              category: def.category as any,
              updatedAt: Date.now()
            });
            addedCount++;
          }
        });

        if (addedCount > 0) {
          localStorage.setItem('hr_connect_system_configs', JSON.stringify(existing));
        }
      }

      await loadData();
      alert('Đã khởi tạo cấu hình mặc định thành công!');
    } catch (error: any) {
      console.error('Error initializing configs:', error);
      alert('Lỗi khởi tạo cấu hình: ' + (error.message || 'Unknown error'));
    } finally {
      setInitializing(false);
    }
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
      {configs.length === 0 && (
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 text-center">
          <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">Chưa có cấu hình hệ thống</h3>
          <p className="text-slate-500 mb-6 max-w-md mx-auto">
            Hệ thống cần một số cấu hình mặc định để hoạt động chính xác (chấm công, tính lương, v.v.).
          </p>
          <button
            onClick={handleInitialize}
            disabled={initializing}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2 mx-auto"
          >
            {initializing ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Đang khởi tạo...
              </>
            ) : (
              'Khởi tạo cấu hình mặc định'
            )}
          </button>
        </div>
      )}

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
