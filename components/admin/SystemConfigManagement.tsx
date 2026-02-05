import React, { useState, useEffect } from 'react';
import { SystemConfig } from '../../types';
import { getSystemConfigs, updateSystemConfig } from '../../services/db';

interface SystemConfigManagementProps {
  onRegisterReload?: (handler: () => void | Promise<void>) => void;
}

const SystemConfigManagement: React.FC<SystemConfigManagementProps> = ({ onRegisterReload }) => {
  const [configs, setConfigs] = useState<SystemConfig[]>([]);
  const [editingConfig, setEditingConfig] = useState<SystemConfig | null>(null);
  const [editValue, setEditValue] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (onRegisterReload) {
      onRegisterReload(loadData);
    }
  }, [onRegisterReload]);

  const loadData = async () => {
    const configs = await getSystemConfigs();
    setConfigs(configs);
  };

  const handleEdit = (config: SystemConfig) => {
    setEditingConfig(config);
    setEditValue(config.value);
  };

  const handleSave = async () => {
    if (!editingConfig) return;
    
    try {
      await updateSystemConfig(editingConfig.id, editValue);
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
