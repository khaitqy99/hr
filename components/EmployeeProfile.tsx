import React, { useState, useEffect } from 'react';
import { User, UserRole, ContractType, EmployeeStatus, CONTRACT_TYPE_LABELS, EMPLOYEE_STATUS_LABELS } from '../types';
import { getAllUsers, updateUser } from '../services/db';

interface EmployeeProfileProps {
  employeeId: string;
  currentUser: User;
  onBack: () => void;
  setView?: (view: string) => void;
}

const EmployeeProfile: React.FC<EmployeeProfileProps> = ({ employeeId, currentUser, onBack, setView }) => {
  const [employee, setEmployee] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({
    email: '',
    name: '',
    department: '',
    employeeCode: '',
    jobTitle: '',
    grossSalary: '' as number | '',
    socialInsuranceSalary: '' as number | '',
    traineeSalary: '' as number | '',
    contractType: ContractType.OFFICIAL,
    startDate: '' as string | '',
    status: EmployeeStatus.ACTIVE,
    role: UserRole.EMPLOYEE,
  });
  const [editFormError, setEditFormError] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    const loadEmployee = async () => {
      const employees = await getAllUsers();
      const found = employees.find((e: User) => e.id === employeeId);
      if (found) {
        setEmployee(found);
        setEditForm({
          email: found.email,
          name: found.name,
          department: found.department,
          employeeCode: found.employeeCode || '',
          jobTitle: found.jobTitle || '',
          grossSalary: found.grossSalary ?? '',
          socialInsuranceSalary: found.socialInsuranceSalary ?? '',
          traineeSalary: found.traineeSalary ?? '',
        contractType: found.contractType ?? ContractType.OFFICIAL,
        startDate: found.startDate ? new Date(found.startDate).toISOString().split('T')[0] : '',
        status: found.status ?? EmployeeStatus.ACTIVE,
        role: found.role,
      });
      }
    };
    loadEmployee();
  }, [employeeId]);

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee) return;
    setEditFormError('');
    if (!editForm.email.trim()) { setEditFormError('Email (đăng nhập) là bắt buộc'); return; }
    if (!editForm.name.trim()) { setEditFormError('Họ tên là bắt buộc'); return; }
    if (!editForm.department.trim()) { setEditFormError('Bộ phận là bắt buộc'); return; }
    const gross = typeof editForm.grossSalary === 'number' ? editForm.grossSalary : (editForm.grossSalary === '' ? undefined : Number(String(editForm.grossSalary).replace(/\D/g, '')));
    const bhxh = typeof editForm.socialInsuranceSalary === 'number' ? editForm.socialInsuranceSalary : (editForm.socialInsuranceSalary === '' ? undefined : Number(String(editForm.socialInsuranceSalary).replace(/\D/g, '')));
    const trainee = typeof editForm.traineeSalary === 'number' ? editForm.traineeSalary : (editForm.traineeSalary === '' ? undefined : Number(String(editForm.traineeSalary).replace(/\D/g, '')));
    const startDate = editForm.startDate ? new Date(editForm.startDate).getTime() : undefined;
    try {
      await updateUser(employee.id, {
        name: editForm.name.trim(),
        email: editForm.email.trim(),
        role: editForm.role,
        department: editForm.department.trim(),
        employeeCode: editForm.employeeCode.trim() || undefined,
        jobTitle: editForm.jobTitle.trim() || undefined,
        contractType: editForm.contractType,
        startDate,
        status: editForm.status,
        grossSalary: gross,
        socialInsuranceSalary: bhxh,
        traineeSalary: trainee,
      });
      // Reload employee data
      const employees = await getAllUsers();
      const updated = employees.find((e: User) => e.id === employeeId);
      if (updated) {
        setEmployee(updated);
        setIsEditing(false);
      }
    } catch (err: any) {
      setEditFormError(err?.message || 'Không thể cập nhật thông tin');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  if (!employee) {
    return (
      <div className="p-10 text-center">
        <p className="text-slate-400">Không tìm thấy nhân viên</p>
        <button onClick={onBack} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl">Quay lại</button>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="px-6 h-[73px] border-b border-slate-200 flex flex-col justify-center">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Y99 HR Logo" className="w-6 h-6 object-contain" />
            <h1 className="text-lg font-bold text-slate-800 leading-tight">Y99 HR</h1>
          </div>
          <p className="text-xs text-slate-500 mt-0.5 leading-tight">Quản trị hệ thống</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          <button
            onClick={onBack}
            className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition-all"
          >
            <span className="text-lg">📋</span>
            <span>Quản lý</span>
          </button>
          <button
            onClick={() => setView && setView('salary-management')}
            className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition-all"
          >
            <span className="text-lg">💰</span>
            <span>Tính lương</span>
          </button>
        </nav>
        <div className="p-4 border-t border-slate-200">
          <div className="flex items-center space-x-3 px-4 py-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-white font-bold text-xs">
              {currentUser.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-800 truncate">{currentUser.name}</p>
              <p className="text-[10px] text-slate-500">{currentUser.role}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 px-6 h-[73px] sticky top-0 z-10 flex items-center">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center space-x-4">
              <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-slate-600">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
              </button>
              <div>
                <h1 className="text-lg font-bold text-slate-800 leading-tight">Hồ sơ nhân viên</h1>
                <p className="text-xs text-slate-500 mt-0.5 leading-tight">Chi tiết thông tin nhân viên</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3 px-4 py-2 bg-slate-50 rounded-xl">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-white font-bold text-xs">
                  {currentUser.name.charAt(0)}
                </div>
                <div className="text-left">
                  <p className="text-xs font-bold text-slate-800">{currentUser.name}</p>
                  <p className="text-[10px] text-slate-500">{currentUser.role}</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="w-full p-6">
            <div className="space-y-6 fade-up">
                      {/* Employee Card */}
              <div className="bg-white p-5 rounded-3xl shadow-sm border border-sky-50">
                <div className="flex items-center space-x-4 mb-4">
                  {employee.avatarUrl ? (
                    <img 
                      src={employee.avatarUrl} 
                      alt={employee.name}
                      className="w-16 h-16 rounded-full object-cover"
                      onError={(e) => {
                        // Fallback to initial if image fails to load
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const fallback = target.nextElementSibling as HTMLElement;
                        if (fallback) fallback.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div 
                    className={`w-16 h-16 rounded-full bg-gradient-to-br from-blue-100 to-cyan-100 flex items-center justify-center text-blue-600 font-bold text-xl ${employee.avatarUrl ? 'hidden' : ''}`}
                  >
                    {employee.name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <p className="text-lg font-bold text-slate-800">{employee.name}</p>
                    <p className="text-sm text-slate-500">{employee.email}</p>
                    <p className="text-xs text-slate-400 mt-1">{employee.department}{employee.jobTitle ? ` · ${employee.jobTitle}` : ''}{employee.employeeCode ? ` · ${employee.employeeCode}` : ''}</p>
                  </div>
                </div>
                {!isEditing && (
                  <button 
                    onClick={() => setIsEditing(true)} 
                    className="w-full py-3 rounded-xl text-sm font-bold bg-blue-600 text-white shadow-md active:scale-[0.98]"
                  >
                    Chỉnh sửa hồ sơ
                  </button>
                )}
              </div>

              {/* Edit Form */}
              {isEditing && (
                <form onSubmit={handleUpdateUser} className="bg-white p-5 rounded-3xl shadow-sm border border-sky-50 space-y-4">
                  {editFormError && <p className="text-sm text-red-600 font-medium">{editFormError}</p>}
                  
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Email (đăng nhập) *</label>
                    <input type="email" required value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} placeholder="user@congty.com" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm" />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Họ tên *</label>
                    <input type="text" required value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} placeholder="Nguyễn Văn A" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm" />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Bộ phận *</label>
                    <input type="text" required value={editForm.department} onChange={e => setEditForm(f => ({ ...f, department: e.target.value }))} placeholder="IT / HR / Kinh doanh" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Mã nhân viên</label>
                      <input type="text" value={editForm.employeeCode} onChange={e => setEditForm(f => ({ ...f, employeeCode: e.target.value }))} placeholder="NV001" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Chức danh</label>
                      <input type="text" value={editForm.jobTitle} onChange={e => setEditForm(f => ({ ...f, jobTitle: e.target.value }))} placeholder="Nhân viên / Trưởng nhóm" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm" />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Lương thỏa thuận (gross)</label>
                      <input type="number" min={0} value={editForm.grossSalary === '' ? '' : editForm.grossSalary} onChange={e => setEditForm(f => ({ ...f, grossSalary: e.target.value === '' ? '' : Number(e.target.value) }))} placeholder="VNĐ" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Lương BHXH</label>
                      <input type="number" min={0} value={editForm.socialInsuranceSalary === '' ? '' : editForm.socialInsuranceSalary} onChange={e => setEditForm(f => ({ ...f, socialInsuranceSalary: e.target.value === '' ? '' : Number(e.target.value) }))} placeholder="VNĐ" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm" />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Lương học việc (nếu có)</label>
                    <input type="number" min={0} value={editForm.traineeSalary === '' ? '' : editForm.traineeSalary} onChange={e => setEditForm(f => ({ ...f, traineeSalary: e.target.value === '' ? '' : Number(e.target.value) }))} placeholder="VNĐ" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Loại hợp đồng</label>
                      <select value={editForm.contractType} onChange={e => setEditForm(f => ({ ...f, contractType: e.target.value as ContractType }))} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm">
                        {(Object.keys(CONTRACT_TYPE_LABELS) as ContractType[]).map(k => <option key={k} value={k}>{CONTRACT_TYPE_LABELS[k]}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Trạng thái</label>
                      <select value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value as EmployeeStatus }))} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm">
                        {(Object.keys(EMPLOYEE_STATUS_LABELS) as EmployeeStatus[]).map(k => <option key={k} value={k}>{EMPLOYEE_STATUS_LABELS[k]}</option>)}
                      </select>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Ngày vào làm</label>
                      <input type="date" value={editForm.startDate} onChange={e => setEditForm(f => ({ ...f, startDate: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Vai trò</label>
                      <select value={editForm.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value as UserRole }))} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm">
                        <option value={UserRole.EMPLOYEE}>Nhân viên</option>
                        <option value={UserRole.ADMIN}>Admin</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      type="button" 
                      onClick={() => {
                        setIsEditing(false);
                        // Reset form to current employee data
                        setEditForm({
                          email: employee.email,
                          name: employee.name,
                          department: employee.department,
                          employeeCode: employee.employeeCode || '',
                          jobTitle: employee.jobTitle || '',
                          grossSalary: employee.grossSalary ?? '',
                          socialInsuranceSalary: employee.socialInsuranceSalary ?? '',
                          traineeSalary: employee.traineeSalary ?? '',
                          contractType: employee.contractType ?? ContractType.OFFICIAL,
                          startDate: employee.startDate ? new Date(employee.startDate).toISOString().split('T')[0] : '',
                          status: employee.status ?? EmployeeStatus.ACTIVE,
                          role: employee.role,
                        });
                        setEditFormError('');
                      }}
                      className="py-3 rounded-xl text-sm font-bold bg-slate-100 text-slate-600 active:scale-[0.98]"
                    >
                      Hủy
                    </button>
                    <button type="submit" className="py-3 rounded-xl text-sm font-bold bg-blue-600 text-white shadow-md active:scale-[0.98]">
                      Cập nhật
                    </button>
                  </div>
                </form>
              )}

              {/* Info Display (when not editing) */}
              {!isEditing && (
                <div className="bg-white p-5 rounded-3xl shadow-sm border border-sky-50 space-y-4">
                  <h3 className="text-sm font-bold text-slate-700 mb-3">Thông tin chi tiết</h3>
                  
                  <div className="space-y-3">
                    {/* Thông tin cơ bản */}
                    <div className="pb-3 border-b border-slate-100">
                      <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Thông tin cơ bản</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-xs text-slate-500">Email:</span>
                          <span className="text-sm font-medium text-slate-800">{employee.email}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-xs text-slate-500">Họ tên:</span>
                          <span className="text-sm font-medium text-slate-800">{employee.name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-xs text-slate-500">Bộ phận:</span>
                          <span className="text-sm font-medium text-slate-800">{employee.department}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-xs text-slate-500">Mã nhân viên:</span>
                          <span className="text-sm font-medium text-slate-800">{employee.employeeCode || <span className="text-slate-400 italic">Chưa cập nhật</span>}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-xs text-slate-500">Chức danh:</span>
                          <span className="text-sm font-medium text-slate-800">{employee.jobTitle || <span className="text-slate-400 italic">Chưa cập nhật</span>}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-xs text-slate-500">Vai trò:</span>
                          <span className="text-sm font-medium text-slate-800">
                            {employee.role === UserRole.ADMIN ? 'Admin' : 'Nhân viên'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Thông tin lương */}
                    <div className="pb-3 border-b border-slate-100">
                      <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Thông tin lương</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-xs text-slate-500">Lương thỏa thuận (gross):</span>
                          <span className="text-sm font-bold text-blue-600">
                            {employee.grossSalary != null ? formatCurrency(employee.grossSalary) : <span className="text-slate-400 italic">Chưa cập nhật</span>}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-xs text-slate-500">Lương BHXH:</span>
                          <span className="text-sm font-medium text-slate-800">
                            {employee.socialInsuranceSalary != null ? formatCurrency(employee.socialInsuranceSalary) : <span className="text-slate-400 italic">Chưa cập nhật</span>}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-xs text-slate-500">Lương học việc:</span>
                          <span className="text-sm font-medium text-slate-800">
                            {employee.traineeSalary != null ? formatCurrency(employee.traineeSalary) : <span className="text-slate-400 italic">Chưa cập nhật</span>}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Thông tin hợp đồng */}
                    <div>
                      <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Thông tin hợp đồng</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-xs text-slate-500">Loại hợp đồng:</span>
                          <span className="text-sm font-medium text-slate-800">
                            {employee.contractType ? CONTRACT_TYPE_LABELS[employee.contractType] : <span className="text-slate-400 italic">Chưa cập nhật</span>}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-xs text-slate-500">Ngày vào làm:</span>
                          <span className="text-sm font-medium text-slate-800">
                            {employee.startDate ? new Date(employee.startDate).toLocaleDateString('vi-VN') : <span className="text-slate-400 italic">Chưa cập nhật</span>}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-xs text-slate-500">Trạng thái:</span>
                          <span className={`text-xs font-bold px-2 py-1 rounded ${employee.status === EmployeeStatus.ACTIVE ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-500'}`}>
                            {employee.status ? EMPLOYEE_STATUS_LABELS[employee.status] : 'Chưa cập nhật'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeProfile;
