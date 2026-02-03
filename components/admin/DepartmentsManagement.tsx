import React, { useState, useEffect } from 'react';
import { Department, User } from '../../types';
import { getAllUsers } from '../../services/db';

const DEPARTMENTS_KEY = 'hr_connect_departments';

const getDepartments = (): Department[] => {
  return JSON.parse(localStorage.getItem(DEPARTMENTS_KEY) || '[]');
};

const saveDepartments = (departments: Department[]) => {
  localStorage.setItem(DEPARTMENTS_KEY, JSON.stringify(departments));
};

const DepartmentsManagement: React.FC = () => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const departments = await getDepartments();
    setDepartments(departments);
    const users = await getAllUsers();
    setEmployees(users);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Tên phòng ban là bắt buộc');
      return;
    }

    try {
      if (editingDept) {
        // Update
        await updateDepartment(editingDept.id, {
          name: formData.name.trim(),
          code: formData.code.trim() || undefined,
        });
      } else {
        // Create
        await createDepartment({
          name: formData.name.trim(),
          code: formData.code.trim() || undefined,
          isActive: true,
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
      code: '',
    });
    setEditingDept(null);
    setShowForm(false);
  };

  const handleEdit = (dept: Department) => {
    setEditingDept(dept);
    setFormData({
      name: dept.name,
      code: dept.code || '',
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Bạn có chắc muốn xóa phòng ban này?')) {
      try {
        await deleteDepartment(id);
        loadData();
      } catch (error: any) {
        alert(error?.message || 'Có lỗi xảy ra khi xóa phòng ban');
      }
    }
  };

  const getManagerName = (managerId?: string) => {
    if (!managerId) return '-';
    const manager = employees.find(e => e.id === managerId);
    return manager?.name || '-';
  };

  const getEmployeeCount = (deptName: string) => {
    return employees.filter(e => e.department === deptName && e.role !== 'ADMIN').length;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800">Quản lý phòng ban</h2>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="px-6 py-3 rounded-xl text-sm font-bold bg-blue-600 text-white shadow-lg hover:bg-blue-700 transition-colors"
        >
          + Thêm phòng ban
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white p-5 rounded-3xl shadow-sm border border-sky-50">
          <h3 className="text-sm font-bold text-slate-700 mb-4">
            {editingDept ? 'Chỉnh sửa phòng ban' : 'Thêm phòng ban mới'}
          </h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Tên phòng ban *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
                placeholder="IT / HR / Kinh doanh"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Mã phòng ban (tùy chọn)</label>
              <input
                type="text"
                value={formData.code}
                onChange={e => setFormData({ ...formData, code: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
                placeholder="IT001"
              />
            </div>
          </div>
          <div className="flex space-x-3 mt-4">
            <button
              type="submit"
              className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors"
            >
              {editingDept ? 'Cập nhật' : 'Thêm'}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="px-6 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-200 transition-colors"
            >
              Hủy
            </button>
          </div>
        </form>
      )}

      {departments.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-sky-50">
          <p className="text-slate-400 font-medium">Chưa có phòng ban nào</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-sky-50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">Tên phòng ban</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">Mã</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">Trưởng phòng</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">Số nhân viên</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">Trạng thái</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {departments.map((dept) => (
                  <tr key={dept.id} className="hover:bg-sky-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-bold text-slate-800">{dept.name}</p>
                        {dept.description && (
                          <p className="text-xs text-slate-500 mt-1">{dept.description}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-slate-700">{dept.code || '-'}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-slate-700">{getManagerName(dept.managerId)}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-blue-600">{getEmployeeCount(dept.name)}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-bold px-2 py-1 rounded-lg ${
                        dept.isActive ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {dept.isActive ? 'Hoạt động' : 'Ngừng hoạt động'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEdit(dept)}
                          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                        >
                          Sửa
                        </button>
                        <button
                          onClick={() => handleDelete(dept.id)}
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

export default DepartmentsManagement;
