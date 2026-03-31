import React, { useState, useEffect } from 'react';
import { User, UserRole, ContractType, EmployeeStatus, CONTRACT_TYPE_LABELS, EMPLOYEE_STATUS_LABELS, Department, Branch } from '../types';
import { getAllUsers, updateUser, getDepartments, getBranches } from '../services/db';

interface EmployeeProfileProps {
  employeeId: string;
  currentUser: User;
  onBack: () => void;
  setView?: (view: string) => void;
}

const EmployeeProfile: React.FC<EmployeeProfileProps> = ({ employeeId, currentUser, onBack, setView }) => {
  const [employee, setEmployee] = useState<User | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [editForm, setEditForm] = useState({
    email: '',
    name: '',
    department: '',
    branchId: '',
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
      const [employees, depts, branchesData] = await Promise.all([
        getAllUsers(),
        getDepartments(),
        getBranches()
      ]);
      setDepartments(depts.filter(d => d.isActive)); // Chỉ lấy phòng ban đang hoạt động
      setBranches(branchesData.filter(b => b.isActive)); // Chỉ lấy chi nhánh đang hoạt động
      const found = employees.find((e: User) => e.id === employeeId);
      if (found) {
        setEmployee(found);
        setEditForm({
          email: found.email,
          name: found.name,
          department: found.department,
          branchId: found.branchId || '',
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
        branchId: editForm.branchId || undefined,
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

  const isViewingOwnProfile = currentUser.role === UserRole.EMPLOYEE && employeeId === currentUser.id;
  const isAdmin = currentUser.role === UserRole.ADMIN;

  // Mobile layout for employees viewing their own profile
  if (isViewingOwnProfile) {
    return (
      <div className="space-y-6 fade-up">
        {/* Header Card */}
        <div className="bg-gradient-to-r from-blue-600 to-cyan-500 rounded-3xl p-6 text-white shadow-lg shadow-blue-200">
          <div className="flex items-center space-x-4 mb-4">
            {employee.avatarUrl ? (
              <img 
                src={employee.avatarUrl} 
                alt={employee.name}
                className="w-16 h-16 rounded-full object-cover border-2 border-white"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const fallback = target.nextElementSibling as HTMLElement;
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
            ) : null}
            <div 
              className={`w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white font-bold text-xl border-2 border-white ${employee.avatarUrl ? 'hidden' : ''}`}
            >
              {employee.name.charAt(0)}
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold">{employee.name}</h2>
              <p className="text-sm text-blue-100">{employee.email}</p>
              <p className="text-xs text-blue-200 mt-1">{employee.department}{employee.jobTitle ? ` · ${employee.jobTitle}` : ''}{employee.employeeCode ? ` · ${employee.employeeCode}` : ''}</p>
            </div>
          </div>
        </div>
        {/* Info Display */}
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
                {employee.branchId && branches.find(b => b.id === employee.branchId) && (
                  <div className="flex justify-between">
                    <span className="text-xs text-slate-500">Chi nhánh:</span>
                    <span className="text-sm font-medium text-slate-800">
                      {branches.find(b => b.id === employee.branchId)?.name}
                    </span>
                  </div>
                )}
                {employee.employeeCode && (
                  <div className="flex justify-between">
                    <span className="text-xs text-slate-500">Mã nhân viên:</span>
                    <span className="text-sm font-medium text-slate-800">{employee.employeeCode}</span>
                  </div>
                )}
                {employee.jobTitle && (
                  <div className="flex justify-between">
                    <span className="text-xs text-slate-500">Chức danh:</span>
                    <span className="text-sm font-medium text-slate-800">{employee.jobTitle}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-xs text-slate-500">Vai trò:</span>
                  <span className="text-sm font-medium text-slate-800">
                    {employee.role === UserRole.ADMIN ? 'Admin' : 'Nhân viên'}
                  </span>
                </div>
              </div>
            </div>

            {/* Thông tin lương */}
            {(employee.grossSalary != null || employee.socialInsuranceSalary != null || employee.traineeSalary != null) && (
              <div className="pb-3 border-b border-slate-100">
                <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Thông tin lương</h4>
                <div className="space-y-2">
                  {employee.grossSalary != null && (
                    <div className="flex justify-between">
                      <span className="text-xs text-slate-500">Lương thỏa thuận (gross):</span>
                      <span className="text-sm font-bold text-blue-600">{formatCurrency(employee.grossSalary)}</span>
                    </div>
                  )}
                  {employee.socialInsuranceSalary != null && (
                    <div className="flex justify-between">
                      <span className="text-xs text-slate-500">Lương BHXH:</span>
                      <span className="text-sm font-medium text-slate-800">{formatCurrency(employee.socialInsuranceSalary)}</span>
                    </div>
                  )}
                  {employee.traineeSalary != null && (
                    <div className="flex justify-between">
                      <span className="text-xs text-slate-500">Lương học việc:</span>
                      <span className="text-sm font-medium text-slate-800">{formatCurrency(employee.traineeSalary)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Thông tin hợp đồng */}
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Thông tin hợp đồng</h4>
              <div className="space-y-2">
                {employee.contractType && (
                  <div className="flex justify-between">
                    <span className="text-xs text-slate-500">Loại hợp đồng:</span>
                    <span className="text-sm font-medium text-slate-800">{CONTRACT_TYPE_LABELS[employee.contractType]}</span>
                  </div>
                )}
                {employee.startDate && (
                  <div className="flex justify-between">
                    <span className="text-xs text-slate-500">Ngày vào làm:</span>
                    <span className="text-sm font-medium text-slate-800">{new Date(employee.startDate).toLocaleDateString('vi-VN')}</span>
                  </div>
                )}
                {employee.status && (
                  <div className="flex justify-between">
                    <span className="text-xs text-slate-500">Trạng thái:</span>
                    <span className={`text-xs font-bold px-2 py-1 rounded ${employee.status === EmployeeStatus.ACTIVE ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-500'}`}>
                      {EMPLOYEE_STATUS_LABELS[employee.status]}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Note */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
          <p className="text-xs text-blue-700 text-center">
            💡 Liên hệ HR để cập nhật thông tin
          </p>
        </div>
      </div>
    );
  }

  // Desktop layout for admin viewing employee profile
  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="px-6 h-[73px] border-b border-slate-200 flex flex-col justify-center">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Y99 HR Logo" className="h-6 w-auto max-w-6 object-contain" />
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
                {!isEditing && isAdmin && (
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
                    <select
                      required
                      value={editForm.department}
                      onChange={e => setEditForm(f => ({ ...f, department: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
                    >
                      <option value="">-- Chọn phòng ban --</option>
                      {departments.map(dept => (
                        <option key={dept.id} value={dept.name}>
                          {dept.name} {dept.code ? `(${dept.code})` : ''}
                        </option>
                      ))}
                    </select>
                    {departments.length === 0 && (
                      <p className="text-xs text-amber-600 mt-1">
                        ⚠️ Chưa có phòng ban nào. Vui lòng tạo phòng ban trước.
                      </p>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Chi nhánh</label>
                    <select
                      value={editForm.branchId}
                      onChange={e => setEditForm(f => ({ ...f, branchId: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
                    >
                      <option value="">-- Chọn chi nhánh --</option>
                      {branches.map(branch => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name} ({branch.code})
                        </option>
                      ))}
                    </select>
                    {branches.length === 0 && (
                      <p className="text-xs text-amber-600 mt-1">
                        ⚠️ Chưa có chi nhánh nào. Vui lòng tạo chi nhánh trước.
                      </p>
                    )}
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

              {/* Quick Actions (when not editing and admin) */}
              {!isEditing && isAdmin && setView && (
                <div className="bg-white p-5 rounded-3xl shadow-sm border border-sky-50">
                  <h3 className="text-sm font-bold text-slate-700 mb-3">Thao tác nhanh</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <button
                      onClick={() => {
                        setView('admin', { adminPath: 'attendance' });
                        // Có thể filter theo employeeId sau này
                      }}
                      className="px-4 py-3 rounded-xl text-sm font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors flex items-center justify-center gap-2"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Xem chấm công
                    </button>
                    <button
                      onClick={() => {
                        setView('admin', { adminPath: 'shift' });
                        // Có thể filter theo employeeId sau này
                      }}
                      className="px-4 py-3 rounded-xl text-sm font-medium bg-purple-50 text-purple-600 hover:bg-purple-100 transition-colors flex items-center justify-center gap-2"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                      </svg>
                      Xem đăng ký ca
                    </button>
                    <button
                      onClick={() => {
                        setView('admin', { adminPath: 'payroll' });
                        // Có thể filter theo employeeId sau này
                      }}
                      className="px-4 py-3 rounded-xl text-sm font-medium bg-green-50 text-green-600 hover:bg-green-100 transition-colors flex items-center justify-center gap-2"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
                      </svg>
                      Xem bảng lương
                    </button>
                  </div>
                </div>
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
