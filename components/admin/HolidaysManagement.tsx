import React, { useState, useEffect } from 'react';
import { Holiday } from '../../types';
import { getHolidays, createHoliday, updateHoliday, deleteHoliday } from '../../services/db';

interface HolidaysManagementProps {
  onRegisterReload?: (handler: () => void | Promise<void>) => void;
}

const HolidaysManagement: React.FC<HolidaysManagementProps> = ({ onRegisterReload }) => {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    date: '',
    type: 'NATIONAL' as 'NATIONAL' | 'COMPANY' | 'REGIONAL',
    isRecurring: true,
    description: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (onRegisterReload) {
      onRegisterReload(loadData);
    }
  }, [onRegisterReload]);

  const loadData = async () => {
    const holidays = await getHolidays();
    setHolidays(holidays.sort((a, b) => a.date - b.date));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.date) {
      alert('Tên và ngày là bắt buộc');
      return;
    }

    try {
      const dateTimestamp = new Date(formData.date).setHours(0, 0, 0, 0);
      
      if (editingHoliday) {
        // Update
        await updateHoliday(editingHoliday.id, {
          name: formData.name.trim(),
          date: dateTimestamp,
          type: formData.type,
          isRecurring: formData.isRecurring,
          description: formData.description.trim() || undefined,
        });
      } else {
        // Create
        await createHoliday({
          name: formData.name.trim(),
          date: dateTimestamp,
          type: formData.type,
          isRecurring: formData.isRecurring,
          description: formData.description.trim() || undefined,
        });
      }
      loadData();
      resetForm();
    } catch (error: any) {
      alert(error?.message || 'Có lỗi xảy ra');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      date: '',
      type: 'NATIONAL',
      isRecurring: true,
      description: '',
    });
    setEditingHoliday(null);
    setShowForm(false);
  };

  const handleEdit = (holiday: Holiday) => {
    setEditingHoliday(holiday);
    const date = new Date(holiday.date);
    setFormData({
      name: holiday.name,
      date: date.toISOString().split('T')[0],
      type: holiday.type,
      isRecurring: holiday.isRecurring,
      description: holiday.description || '',
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Bạn có chắc muốn xóa ngày lễ này?')) {
      try {
        await deleteHoliday(id);
        loadData();
      } catch (error: any) {
        alert(error?.message || 'Có lỗi xảy ra khi xóa ngày lễ');
      }
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'NATIONAL':
        return 'Quốc gia';
      case 'COMPANY':
        return 'Công ty';
      case 'REGIONAL':
        return 'Địa phương';
      default:
        return type;
    }
  };

  // Filter holidays by year
  const currentYear = new Date().getFullYear();
  const thisYearHolidays = holidays.filter(h => {
    const holidayYear = new Date(h.date).getFullYear();
    return holidayYear === currentYear || h.isRecurring;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800">Quản lý ngày lễ</h2>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="px-6 py-3 rounded-xl text-sm font-bold bg-blue-600 text-white shadow-lg hover:bg-blue-700 transition-colors"
        >
          + Thêm ngày lễ
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl shadow-sm border border-sky-50">
          <h3 className="text-lg font-bold text-slate-700 mb-4">
            {editingHoliday ? 'Chỉnh sửa ngày lễ' : 'Thêm ngày lễ mới'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Tên ngày lễ *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
                placeholder="Tết Nguyên Đán"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Ngày *</label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={e => setFormData({ ...formData, date: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Loại</label>
              <select
                value={formData.type}
                onChange={e => setFormData({ ...formData, type: e.target.value as any })}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
              >
                <option value="NATIONAL">Quốc gia</option>
                <option value="COMPANY">Công ty</option>
                <option value="REGIONAL">Địa phương</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Lặp lại hàng năm</label>
              <select
                value={formData.isRecurring ? 'true' : 'false'}
                onChange={e => setFormData({ ...formData, isRecurring: e.target.value === 'true' })}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
              >
                <option value="true">Có</option>
                <option value="false">Không</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-500 mb-1">Mô tả</label>
              <textarea
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
                rows={2}
                placeholder="Mô tả về ngày lễ..."
              />
            </div>
          </div>
          <div className="flex space-x-3 mt-4">
            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors"
            >
              {editingHoliday ? 'Cập nhật' : 'Tạo mới'}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="px-6 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-200 transition-colors"
            >
              Hủy
            </button>
          </div>
        </form>
      )}

      {thisYearHolidays.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-sky-50">
          <p className="text-slate-400 font-medium">Chưa có ngày lễ nào</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-sky-50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">Tên ngày lễ</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">Ngày</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">Loại</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">Lặp lại</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {thisYearHolidays.map((holiday) => (
                  <tr key={holiday.id} className="hover:bg-sky-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-bold text-slate-800">{holiday.name}</p>
                        {holiday.description && (
                          <p className="text-xs text-slate-500 mt-1">{holiday.description}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-slate-700">{new Date(holiday.date).toLocaleDateString('vi-VN')}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-bold px-2 py-1 rounded-lg ${
                        holiday.type === 'NATIONAL' ? 'bg-blue-100 text-blue-600' :
                        holiday.type === 'COMPANY' ? 'bg-purple-100 text-purple-600' :
                        'bg-green-100 text-green-600'
                      }`}>
                        {getTypeLabel(holiday.type)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-bold px-2 py-1 rounded-lg ${
                        holiday.isRecurring ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {holiday.isRecurring ? 'Có' : 'Không'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEdit(holiday)}
                          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                        >
                          Sửa
                        </button>
                        <button
                          onClick={() => handleDelete(holiday.id)}
                          className="text-sm text-red-600 hover:text-red-700 font-medium"
                        >
                          Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default HolidaysManagement;
