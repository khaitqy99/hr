import React, { useState, useEffect } from 'react';
import { getAllUsers, getAllAttendance, getShiftRegistrations, getAllPayrolls, getDepartments } from '../../services/db';
import { UserRole, ShiftTime, OFF_TYPE_LABELS, Department, User } from '../../types';
import { exportToCSV } from '../../utils/export';

interface DataExportManagementProps {
  onRegisterReload?: (handler: () => void | Promise<void>) => void;
}

const DataExportManagement: React.FC<DataExportManagementProps> = ({ onRegisterReload }) => {
  const [exportType, setExportType] = useState<string>('USERS');
  const [isExporting, setIsExporting] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  
  // Filters
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>('');

  useEffect(() => {
    loadInitialData();
    if (onRegisterReload) {
      onRegisterReload(async () => {
        await loadInitialData();
      });
    }
  }, [onRegisterReload]);

  const loadInitialData = async () => {
    const [depts, users] = await Promise.all([
      getDepartments(),
      getAllUsers()
    ]);
    setDepartments(depts.filter(d => d.isActive));
    setEmployees(users.filter(u => u.role !== UserRole.ADMIN));
    
    // Set default month cho payroll
    const now = new Date();
    const currentMonth = `${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
    setSelectedMonth(currentMonth);
  };


  // Helper để filter theo thời gian
  const filterByDateRange = <T extends { timestamp?: number; date?: number; createdAt?: number; startDate?: number; endDate?: number }>(
    data: T[],
    startDateStr: string,
    endDateStr: string
  ): T[] => {
    if (!startDateStr && !endDateStr) return data;
    
    const start = startDateStr ? new Date(startDateStr + 'T00:00:00').getTime() : 0;
    const end = endDateStr ? new Date(endDateStr + 'T23:59:59').getTime() : Date.now();
    
    return data.filter(item => {
      const itemDate = item.timestamp || item.date || item.createdAt || item.startDate || item.endDate || 0;
      return itemDate >= start && itemDate <= end;
    });
  };

  // Helper để filter theo phòng ban và nhân viên
  const filterByUser = <T extends { userId?: string }>(
    data: T[],
    department: string,
    employeeId: string
  ): T[] => {
    let filtered = data;
    
    if (employeeId) {
      filtered = filtered.filter(item => item.userId === employeeId);
    } else if (department) {
      const deptUserIds = employees
        .filter(u => u.department === department)
        .map(u => u.id);
      filtered = filtered.filter(item => item.userId && deptUserIds.includes(item.userId));
    }
    
    return filtered;
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const month = selectedMonth || `${String(new Date().getMonth() + 1).padStart(2, '0')}-${new Date().getFullYear()}`;
      
      switch (exportType) {
        case 'USERS': {
          let users = (await getAllUsers()).filter(u => u.role !== UserRole.ADMIN);
          
          // Filter theo phòng ban
          if (selectedDepartment) {
            users = users.filter(u => u.department === selectedDepartment);
          }
          
          // Filter theo nhân viên cụ thể
          if (selectedEmployee) {
            users = users.filter(u => u.id === selectedEmployee);
          }
          
          exportToCSV(users, `users_${Date.now()}.csv`);
          break;
        }
        case 'ATTENDANCE': {
          let attendance = await getAllAttendance(5000); // Tăng limit để có thể filter tốt hơn
          
          // Filter theo thời gian
          if (startDate || endDate) {
            attendance = filterByDateRange(attendance, startDate, endDate);
          }
          
          // Filter theo phòng ban/nhân viên
          attendance = filterByUser(attendance, selectedDepartment, selectedEmployee);
          
          exportToCSV(attendance, `attendance_${Date.now()}.csv`);
          break;
        }
        case 'SHIFTS': {
          let shifts = await getShiftRegistrations(undefined, UserRole.ADMIN);
          
          // Filter theo thời gian
          if (startDate || endDate) {
            shifts = filterByDateRange(shifts, startDate, endDate);
          }
          
          // Filter theo phòng ban/nhân viên
          shifts = filterByUser(shifts, selectedDepartment, selectedEmployee);
          
          const shiftsWithLabel = shifts.map(s => ({
            ...s,
            offTypeLabel: s.shift === ShiftTime.OFF && s.offType && OFF_TYPE_LABELS[s.offType] ? OFF_TYPE_LABELS[s.offType] : (s.shift === ShiftTime.OFF ? 'Ngày off' : '')
          }));
          exportToCSV(shiftsWithLabel, `shift_registrations_${Date.now()}.csv`);
          break;
        }
        case 'PAYROLL': {
          let payrolls = await getAllPayrolls(month);
          
          // Filter theo phòng ban/nhân viên
          payrolls = filterByUser(payrolls, selectedDepartment, selectedEmployee);
          
          exportToCSV(payrolls, `payroll_${month}_${Date.now()}.csv`);
          break;
        }
        case 'ALL': {
          const allData: any = {};
          
          // Load users với filter
          let users = (await getAllUsers()).filter(u => u.role !== UserRole.ADMIN);
          if (selectedDepartment) users = users.filter(u => u.department === selectedDepartment);
          if (selectedEmployee) users = users.filter(u => u.id === selectedEmployee);
          allData.users = users;
          
          // Load attendance với filter
          let attendance = await getAllAttendance(5000);
          if (startDate || endDate) attendance = filterByDateRange(attendance, startDate, endDate);
          attendance = filterByUser(attendance, selectedDepartment, selectedEmployee);
          allData.attendance = attendance;
          
          // Load shifts với filter
          let shifts = await getShiftRegistrations(undefined, UserRole.ADMIN);
          if (startDate || endDate) shifts = filterByDateRange(shifts, startDate, endDate);
          shifts = filterByUser(shifts, selectedDepartment, selectedEmployee);
          allData.shifts = shifts;
          
          allData.payrolls = await getAllPayrolls(month);
          
          const jsonData = JSON.stringify(allData, null, 2);
          const blob = new Blob([jsonData], { type: 'application/json' });
          const link = document.createElement('a');
          const url = URL.createObjectURL(blob);
          link.setAttribute('href', url);
          link.setAttribute('download', `hr_data_backup_${Date.now()}.json`);
          link.style.visibility = 'hidden';
          document.body.appendChild(link);
          link.click();
          setTimeout(() => {
            URL.revokeObjectURL(url);
            document.body.removeChild(link);
          }, 100);
          break;
        }
      }
      alert('Xuất dữ liệu thành công!');
    } catch (error) {
      alert('Lỗi khi xuất dữ liệu: ' + (error as Error).message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);
          // In production, you would validate and import data here
          alert('Chức năng import đang được phát triển. Dữ liệu đã được đọc thành công.');
        } catch (error) {
          alert('Lỗi khi đọc file: ' + (error as Error).message);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Export */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-sky-50">
          <h3 className="text-lg font-bold text-slate-700 mb-4">Xuất dữ liệu</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-2">Chọn loại dữ liệu</label>
              <select
                value={exportType}
                onChange={e => {
                  setExportType(e.target.value);
                  // Reset filters khi đổi loại export
                  setSelectedDepartment('');
                  setSelectedEmployee('');
                  setStartDate('');
                  setEndDate('');
                }}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
              >
                <option value="USERS">Danh sách nhân viên</option>
                <option value="ATTENDANCE">Lịch sử chấm công</option>
                <option value="SHIFTS">Đăng ký ca</option>
                <option value="PAYROLL">Bảng lương</option>
                <option value="ALL">Tất cả (Backup JSON)</option>
              </select>
            </div>

            {/* Filter theo phòng ban */}
            {(exportType === 'USERS' || exportType === 'ATTENDANCE' || exportType === 'SHIFTS' || exportType === 'ALL') && (
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2">Phòng ban (tùy chọn)</label>
                <select
                  value={selectedDepartment}
                  onChange={e => {
                    setSelectedDepartment(e.target.value);
                    setSelectedEmployee(''); // Reset employee khi đổi department
                  }}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
                >
                  <option value="">Tất cả phòng ban</option>
                  {departments.map(dept => (
                    <option key={dept.id} value={dept.name}>{dept.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Filter theo nhân viên */}
            {(exportType === 'USERS' || exportType === 'ATTENDANCE' || exportType === 'SHIFTS' || exportType === 'ALL') && (
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2">Nhân viên (tùy chọn)</label>
                <select
                  value={selectedEmployee}
                  onChange={e => setSelectedEmployee(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
                >
                  <option value="">Tất cả nhân viên</option>
                  {employees
                    .filter(emp => !selectedDepartment || emp.department === selectedDepartment)
                    .map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.name} - {emp.department}</option>
                    ))}
                </select>
              </div>
            )}

            {/* Filter theo thời gian */}
            {(exportType === 'ATTENDANCE' || exportType === 'SHIFTS' || exportType === 'ALL') && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-2">Từ ngày</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-2">Đến ngày</label>
                  <input
                    type="date"
                    value={endDate}
                    min={startDate}
                    onChange={e => setEndDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
                  />
                </div>
              </div>
            )}

            {/* Chọn tháng cho payroll */}
            {exportType === 'PAYROLL' && (
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2">Chọn tháng</label>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
                />
              </div>
            )}

            <button
              onClick={handleExport}
              disabled={isExporting}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExporting ? 'Đang xuất...' : 'Xuất dữ liệu'}
            </button>
          </div>
        </div>

        {/* Import */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-sky-50">
          <h3 className="text-lg font-bold text-slate-700 mb-4">Nhập dữ liệu</h3>
          <div className="space-y-4">
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
              <p className="text-xs text-yellow-700">
                ⚠️ Chức năng nhập dữ liệu đang được phát triển. Vui lòng sử dụng file JSON backup đã xuất trước đó.
              </p>
            </div>
            <button
              onClick={handleImport}
              className="w-full px-6 py-3 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 transition-colors"
            >
              Nhập từ file JSON
            </button>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
        <h3 className="text-sm font-bold text-blue-700 mb-2">Hướng dẫn</h3>
        <ul className="text-xs text-blue-600 space-y-1 list-disc list-inside">
          <li>Xuất dữ liệu CSV: Sử dụng để phân tích trong Excel hoặc Google Sheets</li>
          <li>Xuất Backup JSON: Sao lưu toàn bộ dữ liệu hệ thống</li>
          <li>Nhập dữ liệu: Khôi phục từ file backup JSON</li>
          <li>Dữ liệu được xuất theo múi giờ Việt Nam</li>
        </ul>
      </div>
    </div>
  );
};

export default DataExportManagement;
