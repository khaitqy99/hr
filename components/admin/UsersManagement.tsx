import React, { useState, useEffect } from 'react';
import { User, UserRole, ContractType, EmployeeStatus, EMPLOYEE_STATUS_LABELS } from '../../types';
import { getAllUsers, createUser } from '../../services/db';

interface UsersManagementProps {
  onEditUser: (user: User) => void;
}

const defaultUserForm = {
  email: '',
  name: '',
  department: '',
  employeeCode: '',
};

const UsersManagement: React.FC<UsersManagementProps> = ({ onEditUser }) => {
  const [employees, setEmployees] = useState<User[]>([]);
  const [showUserForm, setShowUserForm] = useState(false);
  const [userForm, setUserForm] = useState(defaultUserForm);
  const [userFormError, setUserFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; name?: string; department?: string }>({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const users = await getAllUsers();
    setEmployees(users);
  };

  const validateForm = (): boolean => {
    const errors: { email?: string; name?: string; department?: string } = {};
    
    // Validate email
    if (!userForm.email.trim()) {
      errors.email = 'Email (đăng nhập) là bắt buộc';
    } else if (!userForm.email.includes('@') || !userForm.email.includes('.')) {
      errors.email = 'Email không hợp lệ';
    }
    
    // Validate name
    if (!userForm.name.trim()) {
      errors.name = 'Họ tên là bắt buộc';
    }
    
    // Validate department
    if (!userForm.department.trim()) {
      errors.department = 'Bộ phận là bắt buộc';
    }
    
    setFieldErrors(errors);
    setUserFormError(Object.keys(errors).length > 0 ? 'Vui lòng kiểm tra lại các trường bắt buộc' : '');
    
    return Object.keys(errors).length === 0;
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    setUserFormError('');
    setFieldErrors({});
    
    if (!validateForm()) {
      return; // Dừng nếu có lỗi validation
    }
    
    try {
      createUser({
        name: userForm.name.trim(),
        email: userForm.email.trim(),
        role: UserRole.EMPLOYEE,
        department: userForm.department.trim(),
        employeeCode: userForm.employeeCode.trim() || undefined,
        contractType: ContractType.OFFICIAL,
        status: EmployeeStatus.ACTIVE,
      });
      setUserForm(defaultUserForm);
      setFieldErrors({});
      setShowUserForm(false);
      loadData();
    } catch (err: any) {
      setUserFormError(err?.message || 'Không thể tạo user');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800">Quản lý nhân viên</h2>
        <button
          type="button"
          onClick={() => { 
            setShowUserForm(!showUserForm); 
            setUserFormError(''); 
            setFieldErrors({});
            setUserForm(defaultUserForm); 
          }}
          className="px-6 py-3 rounded-xl text-sm font-bold bg-blue-600 text-white shadow-lg hover:bg-blue-700 transition-colors"
        >
          {showUserForm ? 'Đóng form' : '+ Thêm nhân viên'}
        </button>
      </div>

      {showUserForm && (
        <form onSubmit={handleCreateUser} className="bg-white p-6 rounded-2xl shadow-sm border border-sky-50 space-y-4">
          {userFormError && <p className="text-sm text-red-600 font-medium bg-red-50 p-3 rounded-xl">{userFormError}</p>}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Email (đăng nhập) *</label>
              <input 
                type="email" 
                required 
                value={userForm.email} 
                onChange={e => {
                  setUserForm(f => ({ ...f, email: e.target.value }));
                  if (fieldErrors.email) setFieldErrors(prev => ({ ...prev, email: undefined }));
                }} 
                placeholder="user@congty.com" 
                className={`w-full rounded-xl border px-4 py-2.5 text-sm ${
                  fieldErrors.email ? 'border-red-300 bg-red-50' : 'border-slate-200'
                }`} 
              />
              {fieldErrors.email && <span className="text-xs text-red-600 mt-1 block">{fieldErrors.email}</span>}
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Họ tên *</label>
              <input 
                type="text" 
                required 
                value={userForm.name} 
                onChange={e => {
                  setUserForm(f => ({ ...f, name: e.target.value }));
                  if (fieldErrors.name) setFieldErrors(prev => ({ ...prev, name: undefined }));
                }} 
                placeholder="Nguyễn Văn A" 
                className={`w-full rounded-xl border px-4 py-2.5 text-sm ${
                  fieldErrors.name ? 'border-red-300 bg-red-50' : 'border-slate-200'
                }`} 
              />
              {fieldErrors.name && <span className="text-xs text-red-600 mt-1 block">{fieldErrors.name}</span>}
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Bộ phận *</label>
              <input 
                type="text" 
                required 
                value={userForm.department} 
                onChange={e => {
                  setUserForm(f => ({ ...f, department: e.target.value }));
                  if (fieldErrors.department) setFieldErrors(prev => ({ ...prev, department: undefined }));
                }} 
                placeholder="IT / HR / Kinh doanh" 
                className={`w-full rounded-xl border px-4 py-2.5 text-sm ${
                  fieldErrors.department ? 'border-red-300 bg-red-50' : 'border-slate-200'
                }`} 
              />
              {fieldErrors.department && <span className="text-xs text-red-600 mt-1 block">{fieldErrors.department}</span>}
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Mã nhân viên</label>
              <input type="text" value={userForm.employeeCode} onChange={e => setUserForm(f => ({ ...f, employeeCode: e.target.value }))} placeholder="NV001" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm" />
            </div>
          </div>
          <button type="submit" className="w-full py-3 rounded-xl text-sm font-bold bg-blue-600 text-white shadow-md hover:bg-blue-700 transition-colors">Tạo tài khoản</button>
        </form>
      )}

      {employees.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-sky-50">
          <p className="text-slate-400 font-medium">Chưa có nhân viên nào</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-sky-50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">Nhân viên</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">Email</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">Phòng ban</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">Mã NV</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">Lương</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">Trạng thái</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {employees.map((emp: User) => (
                  <tr key={emp.id} className="hover:bg-sky-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-cyan-100 flex items-center justify-center text-blue-600 font-bold text-sm">
                          {emp.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800">{emp.name}</p>
                          {emp.jobTitle && <p className="text-xs text-slate-500">{emp.jobTitle}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-slate-700">{emp.email}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-slate-700">{emp.department}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-slate-700">{emp.employeeCode || '-'}</p>
                    </td>
                    <td className="px-6 py-4">
                      {emp.grossSalary != null ? (
                        <p className="text-sm font-bold text-blue-600">{formatCurrency(emp.grossSalary)}</p>
                      ) : (
                        <p className="text-sm text-slate-400">-</p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {emp.status && (
                        <span className={`text-xs font-bold px-2 py-1 rounded ${emp.status === EmployeeStatus.ACTIVE ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-500'}`}>
                          {EMPLOYEE_STATUS_LABELS[emp.status]}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => onEditUser(emp)}
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                      >
                        Chỉnh sửa
                      </button>
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

export default UsersManagement;
