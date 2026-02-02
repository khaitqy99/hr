import React, { useState, useEffect } from 'react';
import { User, UserRole, PayrollRecord } from '../types';
import { getAllUsers, getPayroll, createOrUpdatePayroll, calculatePayroll, calculateAttendanceStats } from '../services/db';

interface SalaryManagementProps {
  user: User;
  setView?: (view: string) => void;
}

const SalaryManagement: React.FC<SalaryManagementProps> = ({ user, setView }) => {
  const [employees, setEmployees] = useState<User[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<User | null>(null);
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [salaryForm, setSalaryForm] = useState({
    actualWorkDays: 22,
    otHours: 0,
    allowance: 0,
    bonus: 0,
  });
  const [attendanceStats, setAttendanceStats] = useState<{ actualWorkDays: number; otHours: number } | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [useAttendanceData, setUseAttendanceData] = useState(true);

  useEffect(() => {
    const loadEmployees = async () => {
      const allUsers = await getAllUsers();
      const allEmployees = allUsers.filter((e: User) => e.role !== UserRole.ADMIN);
      setEmployees(allEmployees);
      
      // Set default month to current month
      const now = new Date();
      const currentMonth = `${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
      setSelectedMonth(currentMonth);
    };
    loadEmployees();
  }, []);

  useEffect(() => {
    const loadPayrollData = async () => {
      if (selectedEmployee && selectedMonth) {
        const records = await getPayroll(selectedEmployee.id, selectedMonth);
        setPayrollRecords(records);
        
        // Load attendance stats
        const stats = await calculateAttendanceStats(selectedEmployee.id, selectedMonth);
        setAttendanceStats(stats);
        
        // Auto-fill form with attendance data if useAttendanceData is true
        if (useAttendanceData) {
          setSalaryForm(prev => ({
            ...prev,
            actualWorkDays: stats.actualWorkDays,
            otHours: stats.otHours,
          }));
        }
      }
    };
    loadPayrollData();
  }, [selectedEmployee, selectedMonth, useAttendanceData]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  const handleCalculateSalary = async () => {
    if (!selectedEmployee || !selectedMonth) return;
    setIsCalculating(true);
    
    try {
      const payroll = await calculatePayroll(
        selectedEmployee,
        selectedMonth,
        useAttendanceData ? undefined : salaryForm.actualWorkDays,
        useAttendanceData ? undefined : salaryForm.otHours,
        salaryForm.allowance,
        salaryForm.bonus,
        useAttendanceData
      );
      
      await createOrUpdatePayroll(payroll);
      
      // Reload payroll records
      const records = await getPayroll(selectedEmployee.id, selectedMonth);
      setPayrollRecords(records);
      
      alert('Tính lương thành công!');
    } catch (error: any) {
      alert('Lỗi: ' + (error?.message || 'Không thể tính lương'));
    } finally {
      setIsCalculating(false);
    }
  };

  const getCurrentMonthPayroll = (): PayrollRecord | null => {
    if (!selectedMonth || !selectedEmployee) return null;
    return payrollRecords.find(r => r.month === selectedMonth) || null;
  };

  // Generate month options (current month and previous 5 months)
  const getMonthOptions = (): string[] => {
    const options: string[] = [];
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const month = `${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}`;
      options.push(month);
    }
    return options;
  };

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="px-6 h-[73px] border-b border-slate-200 flex flex-col justify-center">
          <h1 className="text-lg font-bold text-slate-800 leading-tight">HR Connect</h1>
          <p className="text-xs text-slate-500 mt-0.5 leading-tight">Quản trị hệ thống</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          <button
            onClick={() => setView && setView('admin')}
            className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition-all"
          >
            <span className="text-lg">📋</span>
            <span>Quản lý</span>
          </button>
          <button
            className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium bg-blue-600 text-white shadow-md"
          >
            <span className="text-lg">💰</span>
            <span>Tính lương</span>
          </button>
        </nav>
        <div className="p-4 border-t border-slate-200">
          <div className="flex items-center space-x-3 px-4 py-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-white font-bold text-xs">
              {user.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-800 truncate">{user.name}</p>
              <p className="text-[10px] text-slate-500">{user.role}</p>
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
              <div>
                <h1 className="text-lg font-bold text-slate-800 leading-tight">Tính lương</h1>
                <p className="text-xs text-slate-500 mt-0.5 leading-tight">Tính lương cho nhân viên dựa trên chấm công</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3 px-4 py-2 bg-slate-50 rounded-xl">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-white font-bold text-xs">
                  {user.name.charAt(0)}
                </div>
                <div className="text-left">
                  <p className="text-xs font-bold text-slate-800">{user.name}</p>
                  <p className="text-[10px] text-slate-500">{user.role}</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto p-6">
            <div className="space-y-6 fade-up">
              {/* Employee Selection */}
              <div className="bg-white p-5 rounded-3xl shadow-sm border border-sky-50">
                <label className="block text-xs font-bold text-slate-500 mb-2">Chọn nhân viên</label>
                <select
                  value={selectedEmployee?.id || ''}
                  onChange={(e) => {
                    const emp = employees.find(em => em.id === e.target.value);
                    setSelectedEmployee(emp || null);
                  }}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
                >
                  <option value="">-- Chọn nhân viên --</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} - {emp.department} {emp.employeeCode ? `(${emp.employeeCode})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {selectedEmployee && (
                <>
                  {/* Employee Info Card */}
                  <div className="bg-white p-5 rounded-3xl shadow-sm border border-sky-50">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-100 to-cyan-100 flex items-center justify-center text-blue-600 font-bold text-lg">
                        {selectedEmployee.name.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-slate-800">{selectedEmployee.name}</p>
                        <p className="text-xs text-slate-500">{selectedEmployee.email}</p>
                        <p className="text-xs text-slate-400 mt-1">
                          {selectedEmployee.department}
                          {selectedEmployee.jobTitle ? ` · ${selectedEmployee.jobTitle}` : ''}
                          {selectedEmployee.employeeCode ? ` · ${selectedEmployee.employeeCode}` : ''}
                        </p>
                      </div>
                    </div>
                    {selectedEmployee.grossSalary && (
                      <div className="mt-3 pt-3 border-t border-slate-100">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600">Lương cơ bản:</span>
                          <span className="font-bold text-blue-600">{formatCurrency(selectedEmployee.grossSalary)}</span>
                        </div>
                      </div>
                    )}
                    {!selectedEmployee.grossSalary && !selectedEmployee.traineeSalary && (
                      <div className="mt-3 pt-3 border-t border-slate-100">
                        <p className="text-xs text-red-500">Nhân viên chưa có thông tin lương cơ bản</p>
                      </div>
                    )}
                  </div>

                  {/* Month Selector */}
                  <div className="bg-white p-5 rounded-3xl shadow-sm border border-sky-50">
                    <label className="block text-xs font-bold text-slate-500 mb-2">Chọn tháng</label>
                    <select
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
                    >
                      {getMonthOptions().map(month => (
                        <option key={month} value={month}>
                          Tháng {month.split('-')[0]}/{month.split('-')[1]}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Current Payroll Display */}
                  {selectedMonth && getCurrentMonthPayroll() && (
                    <div className="bg-gradient-to-br from-blue-50 to-cyan-50 p-5 rounded-3xl border border-blue-100">
                      <div className="flex justify-between items-center mb-4">
                        <span className="text-sm font-bold text-slate-700">Bảng lương tháng {selectedMonth}</span>
                        <span className={`text-xs font-bold px-3 py-1 rounded-full ${getCurrentMonthPayroll()?.status === 'PAID' ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}`}>
                          {getCurrentMonthPayroll()?.status === 'PAID' ? 'Đã thanh toán' : 'Chờ thanh toán'}
                        </span>
                      </div>
                      {getCurrentMonthPayroll() && (
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-600">Lương cơ bản:</span>
                            <span className="font-bold text-slate-800">{formatCurrency(getCurrentMonthPayroll()!.baseSalary)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-600">Ngày công thực tế:</span>
                            <span className="font-medium text-slate-700">{getCurrentMonthPayroll()!.actualWorkDays}/{getCurrentMonthPayroll()!.standardWorkDays}</span>
                          </div>
                          {getCurrentMonthPayroll()!.otHours > 0 && (
                            <div className="flex justify-between text-sm">
                              <span className="text-slate-600">Làm thêm giờ ({getCurrentMonthPayroll()!.otHours}h):</span>
                              <span className="font-bold text-green-600">+{formatCurrency(getCurrentMonthPayroll()!.otPay)}</span>
                            </div>
                          )}
                          {getCurrentMonthPayroll()!.allowance > 0 && (
                            <div className="flex justify-between text-sm">
                              <span className="text-slate-600">Phụ cấp:</span>
                              <span className="font-bold text-green-600">+{formatCurrency(getCurrentMonthPayroll()!.allowance)}</span>
                            </div>
                          )}
                          {getCurrentMonthPayroll()!.bonus > 0 && (
                            <div className="flex justify-between text-sm">
                              <span className="text-slate-600">Thưởng:</span>
                              <span className="font-bold text-green-600">+{formatCurrency(getCurrentMonthPayroll()!.bonus)}</span>
                            </div>
                          )}
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-600">Khấu trừ:</span>
                            <span className="font-bold text-red-600">-{formatCurrency(getCurrentMonthPayroll()!.deductions)}</span>
                          </div>
                          <div className="pt-3 border-t border-blue-200 flex justify-between">
                            <span className="text-sm font-bold text-slate-700">Thực nhận:</span>
                            <span className="text-lg font-extrabold text-blue-600">{formatCurrency(getCurrentMonthPayroll()!.netSalary)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Attendance Stats Display */}
                  {selectedMonth && attendanceStats && (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold text-green-700">Thống kê chấm công tháng {selectedMonth}</span>
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={useAttendanceData}
                            onChange={(e) => {
                              setUseAttendanceData(e.target.checked);
                              if (e.target.checked && attendanceStats) {
                                setSalaryForm(prev => ({
                                  ...prev,
                                  actualWorkDays: attendanceStats.actualWorkDays,
                                  otHours: attendanceStats.otHours,
                                }));
                              }
                            }}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                          />
                          <span className="text-xs font-medium text-green-700">Tự động từ chấm công</span>
                        </label>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="text-slate-600">Ngày công:</span>
                          <span className="font-bold text-green-700 ml-2">{attendanceStats.actualWorkDays} ngày</span>
                        </div>
                        <div>
                          <span className="text-slate-600">Giờ OT:</span>
                          <span className="font-bold text-green-700 ml-2">{attendanceStats.otHours}h</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Salary Calculation Form */}
                  {selectedMonth && (
                    <div className="bg-white p-5 rounded-3xl shadow-sm border border-sky-50">
                      <h4 className="text-sm font-bold text-slate-700 mb-4">Tính lương mới</h4>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">
                            Ngày công thực tế
                            {useAttendanceData && attendanceStats && (
                              <span className="text-green-600 ml-2">(Tự động: {attendanceStats.actualWorkDays})</span>
                            )}
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={31}
                            value={salaryForm.actualWorkDays}
                            onChange={(e) => setSalaryForm(f => ({ ...f, actualWorkDays: Number(e.target.value) }))}
                            disabled={useAttendanceData}
                            className={`w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm ${useAttendanceData ? 'bg-slate-100 text-slate-500' : ''}`}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">
                            Giờ làm thêm (OT)
                            {useAttendanceData && attendanceStats && (
                              <span className="text-green-600 ml-2">(Tự động: {attendanceStats.otHours}h)</span>
                            )}
                          </label>
                          <input
                            type="number"
                            min={0}
                            step="0.1"
                            value={salaryForm.otHours}
                            onChange={(e) => setSalaryForm(f => ({ ...f, otHours: Number(e.target.value) }))}
                            disabled={useAttendanceData}
                            className={`w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm ${useAttendanceData ? 'bg-slate-100 text-slate-500' : ''}`}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">Phụ cấp (VNĐ)</label>
                          <input
                            type="number"
                            min={0}
                            value={salaryForm.allowance}
                            onChange={(e) => setSalaryForm(f => ({ ...f, allowance: Number(e.target.value) }))}
                            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">Thưởng (VNĐ)</label>
                          <input
                            type="number"
                            min={0}
                            value={salaryForm.bonus}
                            onChange={(e) => setSalaryForm(f => ({ ...f, bonus: Number(e.target.value) }))}
                            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
                          />
                        </div>
                        <button
                          onClick={handleCalculateSalary}
                          disabled={isCalculating || !selectedEmployee || (!selectedEmployee.grossSalary && !selectedEmployee.traineeSalary)}
                          className={`w-full py-3 rounded-xl text-sm font-bold shadow-md active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${
                            useAttendanceData 
                              ? 'bg-green-600 text-white hover:bg-green-700' 
                              : 'bg-blue-600 text-white hover:bg-blue-700'
                          }`}
                        >
                          {isCalculating ? 'Đang tính...' : useAttendanceData ? 'Tính lương từ chấm công' : 'Tính lương'}
                        </button>
                        {!selectedEmployee?.grossSalary && !selectedEmployee?.traineeSalary && (
                          <p className="text-xs text-red-500 text-center">Nhân viên chưa có thông tin lương cơ bản</p>
                        )}
                        {useAttendanceData && attendanceStats && attendanceStats.actualWorkDays === 0 && (
                          <p className="text-xs text-orange-500 text-center">Chưa có dữ liệu chấm công cho tháng này</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Payroll History */}
                  {payrollRecords.length > 0 && (
                    <div className="bg-white p-5 rounded-3xl shadow-sm border border-sky-50">
                      <h4 className="text-sm font-bold text-slate-700 mb-3">Lịch sử bảng lương</h4>
                      <div className="space-y-2">
                        {payrollRecords.slice(0, 5).map(record => (
                          <div
                            key={record.id}
                            className="flex justify-between items-center p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors"
                            onClick={() => setSelectedMonth(record.month)}
                          >
                            <div>
                              <p className="text-sm font-bold text-slate-700">Tháng {record.month}</p>
                              <p className="text-xs text-slate-500">{record.actualWorkDays} ngày công</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-blue-600">{formatCurrency(record.netSalary)}</p>
                              <p className={`text-xs font-medium ${record.status === 'PAID' ? 'text-green-600' : 'text-orange-600'}`}>
                                {record.status === 'PAID' ? 'Đã thanh toán' : 'Chờ thanh toán'}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalaryManagement;
