import React, { useState, useEffect } from 'react';
import { Branch, User } from '../../types';
import { getBranches, createBranch, updateBranch, deleteBranch, getAllUsers, updateUser } from '../../services/db';

interface BranchesManagementProps {
  onRegisterReload?: (handler: () => void | Promise<void>) => void;
  language: 'vi' | 'en';
}

type ViewMode = 'list' | 'form' | 'assign-employees';

const BranchesManagement: React.FC<BranchesManagementProps> = ({ onRegisterReload, language }) => {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [showForm, setShowForm] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [selectedBranchForAssign, setSelectedBranchForAssign] = useState<Branch | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    address: '',
    phone: '',
    managerId: '',
    isActive: true,
  });
  const [error, setError] = useState('');

  const t = {
    vi: {
      title: 'Quản lý chi nhánh',
      addBranch: '+ Thêm chi nhánh',
      closeForm: 'Đóng form',
      name: 'Tên chi nhánh',
      code: 'Mã chi nhánh',
      address: 'Địa chỉ',
      phone: 'Số điện thoại',
      manager: 'Quản lý',
      status: 'Trạng thái',
      active: 'Hoạt động',
      inactive: 'Ngừng hoạt động',
      actions: 'Thao tác',
      edit: 'Sửa',
      delete: 'Xóa',
      save: 'Lưu',
      create: 'Tạo chi nhánh',
      update: 'Cập nhật',
      cancel: 'Hủy',
      noBranches: 'Chưa có chi nhánh nào',
      selectManager: '-- Chọn quản lý --',
      noManager: 'Chưa có',
      nameRequired: 'Tên chi nhánh là bắt buộc',
      codeRequired: 'Mã chi nhánh là bắt buộc',
      confirmDelete: 'Bạn có chắc muốn xóa chi nhánh này?',
      namePlaceholder: 'Chi nhánh 1',
      codePlaceholder: 'CN1',
      addressPlaceholder: '99B Nguyễn Trãi, Ninh Kiều, Cần Thơ',
      phonePlaceholder: '0292 123 4567',
      assignEmployees: 'Gán nhân viên',
      assignEmployeesToBranch: 'Gán nhân viên vào chi nhánh',
      selectEmployees: 'Chọn nhân viên để gán vào chi nhánh này',
      employeesInBranch: 'Nhân viên trong chi nhánh',
      employeesNotInBranch: 'Nhân viên chưa có chi nhánh',
      assign: 'Gán vào chi nhánh',
      unassign: 'Bỏ gán',
      backToList: 'Quay lại danh sách',
      noEmployeesInBranch: 'Chưa có nhân viên nào trong chi nhánh này',
      noEmployeesAvailable: 'Không có nhân viên nào để gán',
      assignSuccess: 'Đã gán nhân viên thành công',
      unassignSuccess: 'Đã bỏ gán nhân viên thành công',
      selectAtLeastOne: 'Vui lòng chọn ít nhất một nhân viên',
      employee: 'Nhân viên',
      email: 'Email',
      department: 'Phòng ban',
    },
    en: {
      title: 'Branch Management',
      addBranch: '+ Add Branch',
      closeForm: 'Close Form',
      name: 'Branch Name',
      code: 'Branch Code',
      address: 'Address',
      phone: 'Phone',
      manager: 'Manager',
      status: 'Status',
      active: 'Active',
      inactive: 'Inactive',
      actions: 'Actions',
      edit: 'Edit',
      delete: 'Delete',
      save: 'Save',
      create: 'Create Branch',
      update: 'Update',
      cancel: 'Cancel',
      noBranches: 'No branches yet',
      selectManager: '-- Select Manager --',
      noManager: 'None',
      nameRequired: 'Branch name is required',
      codeRequired: 'Branch code is required',
      confirmDelete: 'Are you sure you want to delete this branch?',
      namePlaceholder: 'Branch 1',
      codePlaceholder: 'BR1',
      addressPlaceholder: '99B Nguyen Trai, Ninh Kieu, Can Tho',
      phonePlaceholder: '0292 123 4567',
      assignEmployees: 'Assign Employees',
      assignEmployeesToBranch: 'Assign Employees to Branch',
      selectEmployees: 'Select employees to assign to this branch',
      employeesInBranch: 'Employees in this branch',
      employeesNotInBranch: 'Employees not in this branch',
      assign: 'Assign',
      unassign: 'Unassign',
      backToList: 'Back to List',
      noEmployeesInBranch: 'No employees in this branch yet',
      noEmployeesAvailable: 'No employees available to assign',
      assignSuccess: 'Employees assigned successfully',
      unassignSuccess: 'Employees unassigned successfully',
      selectAtLeastOne: 'Please select at least one employee',
      employee: 'Employee',
      email: 'Email',
      department: 'Department',
    }
  };

  const text = t[language];

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (onRegisterReload) {
      onRegisterReload(loadData);
    }
  }, [onRegisterReload]);

  const loadData = async () => {
    const [branchesData, usersData] = await Promise.all([
      getBranches(),
      getAllUsers()
    ]);
    setBranches(branchesData);
    setUsers(usersData);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      address: '',
      phone: '',
      managerId: '',
      isActive: true,
    });
    setEditingBranch(null);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.name.trim()) {
      setError(text.nameRequired);
      return;
    }

    if (!formData.code.trim()) {
      setError(text.codeRequired);
      return;
    }

    try {
      if (editingBranch) {
        await updateBranch(editingBranch.id, {
          name: formData.name.trim(),
          code: formData.code.trim(),
          address: formData.address.trim() || undefined,
          phone: formData.phone.trim() || undefined,
          managerId: formData.managerId || undefined,
          isActive: formData.isActive,
        });
      } else {
        await createBranch({
          name: formData.name.trim(),
          code: formData.code.trim(),
          address: formData.address.trim() || undefined,
          phone: formData.phone.trim() || undefined,
          managerId: formData.managerId || undefined,
          isActive: formData.isActive,
        });
      }
      resetForm();
      setShowForm(false);
      loadData();
    } catch (err: any) {
      setError(err?.message || 'Có lỗi xảy ra');
    }
  };

  const handleEdit = (branch: Branch) => {
    setEditingBranch(branch);
    setFormData({
      name: branch.name,
      code: branch.code,
      address: branch.address || '',
      phone: branch.phone || '',
      managerId: branch.managerId || '',
      isActive: branch.isActive,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(text.confirmDelete)) return;
    try {
      await deleteBranch(id);
      loadData();
    } catch (err: any) {
      alert(err?.message || 'Có lỗi xảy ra');
    }
  };

  const getManagerName = (managerId?: string) => {
    if (!managerId) return text.noManager;
    const manager = users.find(u => u.id === managerId);
    return manager?.name || text.noManager;
  };

  const handleAssignEmployees = (branch: Branch) => {
    setSelectedBranchForAssign(branch);
    setViewMode('assign-employees');
    setSelectedUserIds(new Set());
  };

  const handleToggleUser = (userId: string) => {
    const newSet = new Set(selectedUserIds);
    if (newSet.has(userId)) {
      newSet.delete(userId);
    } else {
      newSet.add(userId);
    }
    setSelectedUserIds(newSet);
  };

  const handleAssignToBranch = async () => {
    if (selectedUserIds.size === 0) {
      alert(text.selectAtLeastOne);
      return;
    }
    if (!selectedBranchForAssign) return;

    try {
      await Promise.all(
        Array.from(selectedUserIds).map(userId =>
          updateUser(userId, { branchId: selectedBranchForAssign.id })
        )
      );
      alert(text.assignSuccess);
      setSelectedUserIds(new Set());
      loadData();
    } catch (err: any) {
      alert(err?.message || 'Có lỗi xảy ra');
    }
  };

  const handleUnassignFromBranch = async () => {
    if (selectedUserIds.size === 0) {
      alert(text.selectAtLeastOne);
      return;
    }

    try {
      await Promise.all(
        Array.from(selectedUserIds).map(userId =>
          updateUser(userId, { branchId: undefined })
        )
      );
      alert(text.unassignSuccess);
      setSelectedUserIds(new Set());
      loadData();
    } catch (err: any) {
      alert(err?.message || 'Có lỗi xảy ra');
    }
  };

  const employeesInBranch = selectedBranchForAssign
    ? users.filter(u => u.branchId === selectedBranchForAssign.id)
    : [];

  const employeesNotInBranch = users.filter(u => !u.branchId);

  // Render assign employees view
  if (viewMode === 'assign-employees' && selectedBranchForAssign) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">{text.assignEmployeesToBranch}</h2>
            <p className="text-sm text-slate-500 mt-1">
              {selectedBranchForAssign.name} ({selectedBranchForAssign.code})
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setViewMode('list');
              setSelectedBranchForAssign(null);
              setSelectedUserIds(new Set());
            }}
            className="px-6 py-3 rounded-xl text-sm font-bold bg-slate-200 text-slate-700 hover:bg-slate-300 transition-colors"
          >
            {text.backToList}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Employees in branch */}
          <div className="bg-white rounded-2xl shadow-sm border border-sky-50 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800">{text.employeesInBranch}</h3>
              <span className="text-sm text-slate-500">({employeesInBranch.length})</span>
            </div>
            
            {employeesInBranch.length === 0 ? (
              <p className="text-center py-8 text-slate-400">{text.noEmployeesInBranch}</p>
            ) : (
              <>
                <div className="space-y-2 mb-4 overflow-y-auto">
                  {employeesInBranch.map(user => (
                    <label
                      key={user.id}
                      className="flex items-center p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedUserIds.has(user.id)}
                        onChange={() => handleToggleUser(user.id)}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      <div className="ml-3 flex-1">
                        <p className="text-sm font-medium text-slate-800">{user.name}</p>
                        <p className="text-xs text-slate-500">{user.email}</p>
                        <p className="text-xs text-slate-400">{user.department}</p>
                      </div>
                    </label>
                  ))}
                </div>
                <button
                  onClick={handleUnassignFromBranch}
                  disabled={selectedUserIds.size === 0}
                  className="w-full py-2 rounded-xl text-sm font-bold bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {text.unassign} ({selectedUserIds.size})
                </button>
              </>
            )}
          </div>

          {/* Employees not in branch */}
          <div className="bg-white rounded-2xl shadow-sm border border-sky-50 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800">{text.employeesNotInBranch}</h3>
              <span className="text-sm text-slate-500">({employeesNotInBranch.length})</span>
            </div>
            
            {employeesNotInBranch.length === 0 ? (
              <p className="text-center py-8 text-slate-400">{text.noEmployeesAvailable}</p>
            ) : (
              <>
                <div className="space-y-2 mb-4 overflow-y-auto">
                  {employeesNotInBranch.map(user => (
                    <label
                      key={user.id}
                      className="flex items-center p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedUserIds.has(user.id)}
                        onChange={() => handleToggleUser(user.id)}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      <div className="ml-3 flex-1">
                        <p className="text-sm font-medium text-slate-800">{user.name}</p>
                        <p className="text-xs text-slate-500">{user.email}</p>
                        <p className="text-xs text-slate-400">{user.department}</p>
                      </div>
                    </label>
                  ))}
                </div>
                <button
                  onClick={handleAssignToBranch}
                  disabled={selectedUserIds.size === 0}
                  className="w-full py-2 rounded-xl text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {text.assign} ({selectedUserIds.size})
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800">{text.title}</h2>
        <button
          type="button"
          onClick={() => {
            if (showForm) {
              resetForm();
            }
            setShowForm(!showForm);
          }}
          className="px-6 py-3 rounded-xl text-sm font-bold bg-blue-600 text-white shadow-lg hover:bg-blue-700 transition-colors"
        >
          {showForm ? text.closeForm : text.addBranch}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl shadow-sm border border-sky-50 space-y-4">
          {error && <p className="text-sm text-red-600 font-medium bg-red-50 p-3 rounded-xl">{error}</p>}
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">{text.name} *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={e => setFormData(f => ({ ...f, name: e.target.value }))}
                placeholder={text.namePlaceholder}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
              />
            </div>
            
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">{text.code} *</label>
              <input
                type="text"
                required
                value={formData.code}
                onChange={e => setFormData(f => ({ ...f, code: e.target.value }))}
                placeholder={text.codePlaceholder}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
              />
            </div>
            
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">{text.address}</label>
              <input
                type="text"
                value={formData.address}
                onChange={e => setFormData(f => ({ ...f, address: e.target.value }))}
                placeholder={text.addressPlaceholder}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
              />
            </div>
            
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">{text.phone}</label>
              <input
                type="text"
                value={formData.phone}
                onChange={e => setFormData(f => ({ ...f, phone: e.target.value }))}
                placeholder={text.phonePlaceholder}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
              />
            </div>
            
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">{text.manager}</label>
              <select
                value={formData.managerId}
                onChange={e => setFormData(f => ({ ...f, managerId: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
              >
                <option value="">{text.selectManager}</option>
                {users.map(user => (
                  <option key={user.id} value={user.id}>
                    {user.name} ({user.email})
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">{text.status}</label>
              <select
                value={formData.isActive ? 'true' : 'false'}
                onChange={e => setFormData(f => ({ ...f, isActive: e.target.value === 'true' }))}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
              >
                <option value="true">{text.active}</option>
                <option value="false">{text.inactive}</option>
              </select>
            </div>
          </div>
          
          <div className="flex gap-3">
            <button
              type="submit"
              className="flex-1 py-3 rounded-xl text-sm font-bold bg-blue-600 text-white shadow-md hover:bg-blue-700 transition-colors"
            >
              {editingBranch ? text.update : text.create}
            </button>
            <button
              type="button"
              onClick={() => {
                resetForm();
                setShowForm(false);
              }}
              className="px-6 py-3 rounded-xl text-sm font-bold bg-slate-200 text-slate-700 hover:bg-slate-300 transition-colors"
            >
              {text.cancel}
            </button>
          </div>
        </form>
      )}

      {branches.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-sky-50">
          <p className="text-slate-400 font-medium">{text.noBranches}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-sky-50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">{text.name}</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">{text.code}</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">{text.address}</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">{text.phone}</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">{text.manager}</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">{text.status}</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">{text.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {branches.map((branch) => (
                  <tr key={branch.id} className="hover:bg-sky-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-slate-800">{branch.name}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-slate-700">{branch.code}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-slate-700">{branch.address || '-'}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-slate-700">{branch.phone || '-'}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-slate-700">{getManagerName(branch.managerId)}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-bold px-2 py-1 rounded ${
                        branch.isActive ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {branch.isActive ? text.active : text.inactive}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(branch)}
                          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                        >
                          {text.edit}
                        </button>
                        <button
                          onClick={() => handleAssignEmployees(branch)}
                          className="text-sm text-green-600 hover:text-green-700 font-medium"
                        >
                          {text.assignEmployees}
                        </button>
                        <button
                          onClick={() => handleDelete(branch.id)}
                          className="text-sm text-red-600 hover:text-red-700 font-medium"
                        >
                          {text.delete}
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

export default BranchesManagement;
