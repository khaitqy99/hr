import React, { useState, useEffect } from 'react';
import { User, UserRole, ContractType, EmployeeStatus, EMPLOYEE_STATUS_LABELS, CONTRACT_TYPE_LABELS, Department } from '../../types';
import { getAllUsers, createUser, getDepartments } from '../../services/db';
import { exportToCSV } from '../../utils/export';

interface UsersManagementProps {
  onEditUser: (user: User) => void;
  onRegisterReload?: (handler: () => void | Promise<void>) => void;
  language: 'vi' | 'en';
}

const defaultUserForm = {
  email: '',
  name: '',
  department: '',
  employeeCode: '',
};

const UsersManagement: React.FC<UsersManagementProps> = ({ onEditUser, onRegisterReload, language }) => {
  const [employees, setEmployees] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<'ALL' | EmployeeStatus>('ALL');
  const [showUserForm, setShowUserForm] = useState(false);
  const [userForm, setUserForm] = useState(defaultUserForm);
  const [userFormError, setUserFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; name?: string; department?: string }>({});

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (onRegisterReload) {
      onRegisterReload(loadData);
    }
  }, [onRegisterReload]);

  const t = {
    vi: {
      addEmployee: '+ Thêm nhân viên',
      closeForm: 'Đóng form',
      exportCSV: 'Xuất CSV',
      emailLogin: 'Email (đăng nhập)',
      fullName: 'Họ tên',
      department: 'Bộ phận',
      employeeCode: 'Mã nhân viên',
      createAccount: 'Tạo tài khoản',
      emailRequired: 'Email (đăng nhập) là bắt buộc',
      emailInvalid: 'Email không hợp lệ (ví dụ: user@example.com)',
      nameRequired: 'Họ tên là bắt buộc',
      departmentRequired: 'Bộ phận là bắt buộc',
      checkRequiredFields: 'Vui lòng kiểm tra lại các trường bắt buộc',
      unableToCreate: 'Không thể tạo user',
      noDataToExport: 'Không có dữ liệu để xuất',
      selectDepartment: '-- Chọn phòng ban --',
      noDepartments: '⚠️ Chưa có phòng ban nào. Vui lòng tạo phòng ban trước.',
      noEmployees: 'Chưa có nhân viên nào',
      employee: 'Nhân viên',
      email: 'Email',
      role: 'Vai trò',
      empCode: 'Mã NV',
      salary: 'Lương',
      status: 'Trạng thái',
      actions: 'Thao tác',
      edit: 'Chỉnh sửa',
      admin: 'Admin',
      employeeRole: 'Nhân viên',
      emailPlaceholder: 'user@congty.com',
      namePlaceholder: 'Nguyễn Văn A',
      codePlaceholder: 'NV001',
      exportFullName: 'Họ tên',
      exportDepartment: 'Phòng ban',
      exportEmployeeCode: 'Mã NV',
      exportJobTitle: 'Chức danh',
      exportRole: 'Vai trò',
      exportContractType: 'Loại hợp đồng',
      exportStatus: 'Trạng thái',
      exportGrossSalary: 'Lương cơ bản',
      exportSocialInsurance: 'Lương BHXH',
      exportTraineeSalary: 'Lương học việc',
      filterByStatus: 'Lọc theo trạng thái',
      allStatuses: 'Tất cả trạng thái',
      noFilteredEmployees: 'Không có nhân viên phù hợp trạng thái đã chọn',
    },
    en: {
      addEmployee: '+ Add Employee',
      closeForm: 'Close Form',
      exportCSV: 'Export CSV',
      emailLogin: 'Email (Login)',
      fullName: 'Full Name',
      department: 'Department',
      employeeCode: 'Employee Code',
      createAccount: 'Create Account',
      emailRequired: 'Email (login) is required',
      emailInvalid: 'Invalid email (e.g., user@example.com)',
      nameRequired: 'Full name is required',
      departmentRequired: 'Department is required',
      checkRequiredFields: 'Please check the required fields',
      unableToCreate: 'Unable to create user',
      noDataToExport: 'No data to export',
      selectDepartment: '-- Select Department --',
      noDepartments: '⚠️ No departments available. Please create a department first.',
      noEmployees: 'No employees yet',
      employee: 'Employee',
      email: 'Email',
      role: 'Role',
      empCode: 'Emp Code',
      salary: 'Salary',
      status: 'Status',
      actions: 'Actions',
      edit: 'Edit',
      admin: 'Admin',
      employeeRole: 'Employee',
      emailPlaceholder: 'user@company.com',
      namePlaceholder: 'John Doe',
      codePlaceholder: 'EMP001',
      exportFullName: 'Full Name',
      exportDepartment: 'Department',
      exportEmployeeCode: 'Employee Code',
      exportJobTitle: 'Job Title',
      exportRole: 'Role',
      exportContractType: 'Contract Type',
      exportStatus: 'Status',
      exportGrossSalary: 'Gross Salary',
      exportSocialInsurance: 'Social Insurance Salary',
      exportTraineeSalary: 'Trainee Salary',
      filterByStatus: 'Filter by status',
      allStatuses: 'All statuses',
      noFilteredEmployees: 'No employees match the selected status',
    }
  };

  const text = t[language];

  const loadData = async () => {
    const [users, depts] = await Promise.all([
      getAllUsers(),
      getDepartments()
    ]);
    setEmployees(users);
    setDepartments(depts.filter(d => d.isActive)); // Only get active departments
  };

  const validateForm = (): boolean => {
    const errors: { email?: string; name?: string; department?: string } = {};
    
    // Validate email with standard regex pattern
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!userForm.email.trim()) {
      errors.email = text.emailRequired;
    } else if (!emailRegex.test(userForm.email.trim())) {
      errors.email = text.emailInvalid;
    }
    
    // Validate name
    if (!userForm.name.trim()) {
      errors.name = text.nameRequired;
    }
    
    // Validate department
    if (!userForm.department.trim()) {
      errors.department = text.departmentRequired;
    }
    
    setFieldErrors(errors);
    setUserFormError(Object.keys(errors).length > 0 ? text.checkRequiredFields : '');
    
    return Object.keys(errors).length === 0;
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserFormError('');
    setFieldErrors({});
    
    if (!validateForm()) {
      return; // Stop if there are validation errors
    }
    
    try {
      await createUser({
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
      setUserFormError(err?.message || text.unableToCreate);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  const filteredEmployees = employees.filter(emp => {
    if (selectedStatus === 'ALL') return true;
    return emp.status === selectedStatus;
  });

  const handleExport = () => {
    if (filteredEmployees.length === 0) {
      alert(text.noDataToExport);
      return;
    }
    const exportData = filteredEmployees.map(emp => ({
      [text.exportFullName]: emp.name,
      [text.email]: emp.email,
      [text.exportDepartment]: emp.department,
      [text.exportEmployeeCode]: emp.employeeCode || '',
      [text.exportJobTitle]: emp.jobTitle || '',
      [text.exportRole]: emp.role === UserRole.ADMIN ? text.admin : text.employeeRole,
      [text.exportContractType]: emp.contractType ? CONTRACT_TYPE_LABELS[emp.contractType] : '',
      [text.exportStatus]: emp.status ? EMPLOYEE_STATUS_LABELS[emp.status] : '',
      [text.exportGrossSalary]: emp.grossSalary ? formatCurrency(emp.grossSalary) : '',
      [text.exportSocialInsurance]: emp.socialInsuranceSalary ? formatCurrency(emp.socialInsuranceSalary) : '',
      [text.exportTraineeSalary]: emp.traineeSalary ? formatCurrency(emp.traineeSalary) : '',
    }));
    exportToCSV(exportData, `users_${Date.now()}.csv`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 min-w-0">
          <label className="text-xs font-bold text-slate-500 uppercase shrink-0">{text.filterByStatus}</label>
          <select
            value={selectedStatus}
            onChange={e => setSelectedStatus(e.target.value as 'ALL' | EmployeeStatus)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white min-w-[12rem] max-w-full"
          >
            <option value="ALL">{text.allStatuses}</option>
            <option value={EmployeeStatus.ACTIVE}>{EMPLOYEE_STATUS_LABELS[EmployeeStatus.ACTIVE]}</option>
            <option value={EmployeeStatus.LEFT}>{EMPLOYEE_STATUS_LABELS[EmployeeStatus.LEFT]}</option>
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-3 shrink-0">
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
            {showUserForm ? text.closeForm : text.addEmployee}
          </button>
          <button
            onClick={handleExport}
            disabled={filteredEmployees.length === 0}
            className="px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            {text.exportCSV}
          </button>
        </div>
      </div>

      {showUserForm && (
        <form onSubmit={handleCreateUser} className="bg-white p-6 rounded-2xl shadow-sm border border-sky-50 space-y-4">
          {userFormError && <p className="text-sm text-red-600 font-medium bg-red-50 p-3 rounded-xl">{userFormError}</p>}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">{text.emailLogin} *</label>
              <input 
                type="email" 
                required 
                value={userForm.email} 
                onChange={e => {
                  setUserForm(f => ({ ...f, email: e.target.value }));
                  if (fieldErrors.email) setFieldErrors(prev => ({ ...prev, email: undefined }));
                }} 
                placeholder={text.emailPlaceholder} 
                className={`w-full rounded-xl border px-4 py-2.5 text-sm ${
                  fieldErrors.email ? 'border-red-300 bg-red-50' : 'border-slate-200'
                }`} 
              />
              {fieldErrors.email && <span className="text-xs text-red-600 mt-1 block">{fieldErrors.email}</span>}
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">{text.fullName} *</label>
              <input 
                type="text" 
                required 
                value={userForm.name} 
                onChange={e => {
                  setUserForm(f => ({ ...f, name: e.target.value }));
                  if (fieldErrors.name) setFieldErrors(prev => ({ ...prev, name: undefined }));
                }} 
                placeholder={text.namePlaceholder} 
                className={`w-full rounded-xl border px-4 py-2.5 text-sm ${
                  fieldErrors.name ? 'border-red-300 bg-red-50' : 'border-slate-200'
                }`} 
              />
              {fieldErrors.name && <span className="text-xs text-red-600 mt-1 block">{fieldErrors.name}</span>}
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">{text.department} *</label>
              <select
                required
                value={userForm.department}
                onChange={e => {
                  setUserForm(f => ({ ...f, department: e.target.value }));
                  if (fieldErrors.department) setFieldErrors(prev => ({ ...prev, department: undefined }));
                }}
                className={`w-full rounded-xl border px-4 py-2.5 text-sm ${
                  fieldErrors.department ? 'border-red-300 bg-red-50' : 'border-slate-200'
                }`}
              >
                <option value="">{text.selectDepartment}</option>
                {departments.map(dept => (
                  <option key={dept.id} value={dept.name}>
                    {dept.name} {dept.code ? `(${dept.code})` : ''}
                  </option>
                ))}
              </select>
              {fieldErrors.department && <span className="text-xs text-red-600 mt-1 block">{fieldErrors.department}</span>}
              {departments.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">
                  {text.noDepartments}
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">{text.employeeCode}</label>
              <input type="text" value={userForm.employeeCode} onChange={e => setUserForm(f => ({ ...f, employeeCode: e.target.value }))} placeholder={text.codePlaceholder} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm" />
            </div>
          </div>
          <button type="submit" className="w-full py-3 rounded-xl text-sm font-bold bg-blue-600 text-white shadow-md hover:bg-blue-700 transition-colors">{text.createAccount}</button>
        </form>
      )}

      {employees.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-sky-50">
          <p className="text-slate-400 font-medium">{text.noEmployees}</p>
        </div>
      ) : filteredEmployees.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-sky-50">
          <p className="text-slate-400 font-medium">{text.noFilteredEmployees}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-sky-50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">{text.employee}</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">{text.email}</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">{text.department}</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">{text.role}</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">{text.empCode}</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">{text.salary}</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">{text.status}</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">{text.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEmployees.map((emp: User) => (
                  <tr key={emp.id} className="hover:bg-sky-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        {emp.avatarUrl ? (
                          <img 
                            src={emp.avatarUrl} 
                            alt={emp.name}
                            className="w-10 h-10 rounded-full object-cover"
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
                          className={`w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-cyan-100 flex items-center justify-center text-blue-600 font-bold text-sm ${emp.avatarUrl ? 'hidden' : ''}`}
                        >
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
                      <span className={`text-xs font-bold px-2 py-1 rounded ${
                        emp.role === UserRole.ADMIN ? 'bg-purple-100 text-purple-600' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {emp.role === UserRole.ADMIN ? text.admin : text.employeeRole}
                      </span>
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
                        {text.edit}
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
