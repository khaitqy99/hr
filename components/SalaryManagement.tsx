import React, { useState, useEffect } from 'react';
import { User, UserRole, PayrollRecord } from '../types';
import { getAllUsers, getPayroll, createOrUpdatePayroll, calculatePayroll, calculateShiftWorkDays, getIncompleteAttendanceDays, calculateAttendanceStats } from '../services/db';

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
    deductions: undefined as number | undefined,
  });
  const [shiftWorkDays, setShiftWorkDays] = useState<number | null>(null);
  const [incompleteDays, setIncompleteDays] = useState<{ date: string; hasCheckIn: boolean; hasCheckOut: boolean }[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [calculationMethod, setCalculationMethod] = useState<'shift' | 'attendance' | 'manual'>('shift');
  const [attendanceStats, setAttendanceStats] = useState<{ actualWorkDays: number; otHours: number } | null>(null);

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
        const [days, incomplete, attStats] = await Promise.all([
          calculateShiftWorkDays(selectedEmployee.id, selectedMonth),
          getIncompleteAttendanceDays(selectedEmployee.id, selectedMonth),
          calculateAttendanceStats(selectedEmployee.id, selectedMonth),
        ]);
        setShiftWorkDays(days);
        setIncompleteDays(incomplete);
        setAttendanceStats(attStats);
        if (calculationMethod === 'shift') {
          setSalaryForm(prev => ({ ...prev, actualWorkDays: days, otHours: 0 }));
        } else if (calculationMethod === 'attendance') {
          setSalaryForm(prev => ({ ...prev, actualWorkDays: attStats.actualWorkDays, otHours: attStats.otHours }));
        }
      }
    };
    loadPayrollData();
  }, [selectedEmployee, selectedMonth, calculationMethod]);

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
        calculationMethod === 'manual' ? salaryForm.actualWorkDays : undefined,
        calculationMethod === 'manual' ? salaryForm.otHours : undefined,
        salaryForm.allowance,
        salaryForm.bonus,
        calculationMethod === 'attendance', // useAttendance - dùng chấm công khi chọn attendance
        true,  // useLeave
        calculationMethod === 'shift', // useShift - dùng đăng ký ca khi chọn shift
        salaryForm.deductions // customDeductions - khấu trừ nhập tay
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
    <div
      className="flex app-viewport app-safe-x bg-slate-50"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
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
                <p className="text-xs text-slate-500 mt-0.5 leading-tight">Tính lương cho nhân viên dựa trên đăng ký ca</p>
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
          <div className="w-full p-6">
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
                            <span className="font-medium text-slate-700">{getCurrentMonthPayroll()!.actualWorkDays.toFixed(2)}/{getCurrentMonthPayroll()!.standardWorkDays}</span>
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

                  {/* Lựa chọn phương thức tính công */}
                  {selectedMonth && (
                    <div className="bg-white p-5 rounded-3xl shadow-sm border border-sky-50">
                      <label className="block text-xs font-bold text-slate-500 mb-3">Phương thức tính công</label>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setCalculationMethod('shift');
                            if (shiftWorkDays !== null) {
                              setSalaryForm(prev => ({ ...prev, actualWorkDays: shiftWorkDays, otHours: 0 }));
                            }
                          }}
                          className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                            calculationMethod === 'shift'
                              ? 'border-blue-500 bg-blue-50/50 shadow-sm shadow-blue-100'
                              : 'border-slate-200 hover:border-slate-300 bg-white'
                          }`}
                        >
                          <div>
                            <p className="text-sm font-bold text-slate-800">Đăng ký ca</p>
                            <p className="text-xs text-slate-500 mt-1">Dựa trên các ca làm việc được duyệt trước đó.</p>
                          </div>
                          {shiftWorkDays !== null && (
                            <span className="mt-3 text-xs font-semibold text-blue-600 bg-blue-100/50 px-2 py-0.5 rounded-lg w-max">
                              {shiftWorkDays.toFixed(2)} ngày công
                            </span>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setCalculationMethod('attendance');
                            if (attendanceStats !== null) {
                              setSalaryForm(prev => ({ 
                                ...prev, 
                                actualWorkDays: attendanceStats.actualWorkDays, 
                                otHours: attendanceStats.otHours 
                              }));
                            }
                          }}
                          className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                            calculationMethod === 'attendance'
                              ? 'border-emerald-500 bg-emerald-50/50 shadow-sm shadow-emerald-100'
                              : 'border-slate-200 hover:border-slate-300 bg-white'
                          }`}
                        >
                          <div>
                            <p className="text-sm font-bold text-slate-800">Check-in / Check-out</p>
                            <p className="text-xs text-slate-500 mt-1">Dựa trên chấm công thực tế của nhân viên.</p>
                          </div>
                          {attendanceStats !== null && (
                            <span className="mt-3 text-xs font-semibold text-emerald-600 bg-emerald-100/50 px-2 py-0.5 rounded-lg w-max">
                              {attendanceStats.actualWorkDays} công / {attendanceStats.otHours}h OT
                            </span>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setCalculationMethod('manual');
                          }}
                          className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                            calculationMethod === 'manual'
                              ? 'border-orange-500 bg-orange-50/50 shadow-sm shadow-orange-100'
                              : 'border-slate-200 hover:border-slate-300 bg-white'
                          }`}
                        >
                          <div>
                            <p className="text-sm font-bold text-slate-800">Nhập tay</p>
                            <p className="text-xs text-slate-500 mt-1">Tự nhập số ngày công và giờ tăng ca tùy ý.</p>
                          </div>
                          <span className="mt-3 text-xs font-semibold text-orange-600 bg-orange-100/50 px-2 py-0.5 rounded-lg w-max">
                            Tự chỉnh sửa
                          </span>
                        </button>
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
                            {calculationMethod === 'shift' && shiftWorkDays !== null && (
                              <span className="text-green-600 ml-2">(Từ đăng ký ca: {shiftWorkDays.toFixed(2)})</span>
                            )}
                            {calculationMethod === 'attendance' && attendanceStats !== null && (
                              <span className="text-emerald-600 ml-2">(Từ chấm công: {attendanceStats.actualWorkDays})</span>
                            )}
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={31}
                            step={0.01}
                            value={salaryForm.actualWorkDays}
                            onChange={(e) => {
                              const value = Number(e.target.value);
                              setSalaryForm(f => ({ ...f, actualWorkDays: value >= 0 ? value : 0 }));
                            }}
                            disabled={calculationMethod !== 'manual'}
                            className={`w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm ${calculationMethod !== 'manual' ? 'bg-slate-100 text-slate-500' : ''}`}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">
                            Giờ làm thêm (OT)
                            {calculationMethod === 'shift' && (
                              <span className="text-slate-400 ml-2">(Nhập tay nếu có)</span>
                            )}
                            {calculationMethod === 'attendance' && attendanceStats !== null && (
                              <span className="text-emerald-600 ml-2">(Từ chấm công: {attendanceStats.otHours}h)</span>
                            )}
                          </label>
                          <input
                            type="number"
                            min={0}
                            step="0.1"
                            value={salaryForm.otHours}
                            onChange={(e) => {
                              const value = Number(e.target.value);
                              setSalaryForm(f => ({ ...f, otHours: value >= 0 ? value : 0 }));
                            }}
                            disabled={calculationMethod === 'attendance'}
                            className={`w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm ${calculationMethod === 'attendance' ? 'bg-slate-100 text-slate-500' : ''}`}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">Phụ cấp (VNĐ)</label>
                          <input
                            type="number"
                            min={0}
                            value={salaryForm.allowance}
                            onChange={(e) => {
                              const value = Number(e.target.value);
                              setSalaryForm(f => ({ ...f, allowance: value >= 0 ? value : 0 }));
                            }}
                            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">Thưởng (VNĐ)</label>
                          <input
                            type="number"
                            min={0}
                            value={salaryForm.bonus}
                            onChange={(e) => {
                              const value = Number(e.target.value);
                              setSalaryForm(f => ({ ...f, bonus: value >= 0 ? value : 0 }));
                            }}
                            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">Khấu trừ (VNĐ) — Tùy chọn</label>
                          <input
                            type="number"
                            min={0}
                            placeholder="Trống = Lương BHXH × tỷ lệ"
                            value={salaryForm.deductions === undefined ? '' : salaryForm.deductions}
                            onChange={(e) => {
                              const value = e.target.value === '' ? undefined : Number(e.target.value);
                              setSalaryForm(f => ({ ...f, deductions: value }));
                            }}
                            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
                          />
                        </div>
                        <button
                          onClick={handleCalculateSalary}
                          disabled={isCalculating || !selectedEmployee || (!selectedEmployee.grossSalary && !selectedEmployee.traineeSalary)}
                          className={`w-full py-3 rounded-xl text-sm font-bold shadow-md active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${
                            calculationMethod === 'shift'
                              ? 'bg-green-600 text-white hover:bg-green-700'
                              : calculationMethod === 'attendance'
                              ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                              : 'bg-blue-600 text-white hover:bg-blue-700'
                          }`}
                        >
                          {isCalculating
                            ? 'Đang tính...'
                            : calculationMethod === 'shift'
                            ? 'Tính lương từ đăng ký ca'
                            : calculationMethod === 'attendance'
                            ? 'Tính lương từ chấm công'
                            : 'Tính lương'}
                        </button>
                        {!selectedEmployee?.grossSalary && !selectedEmployee?.traineeSalary && (
                          <p className="text-xs text-red-500 text-center">Nhân viên chưa có thông tin lương cơ bản</p>
                        )}
                        {calculationMethod === 'shift' && shiftWorkDays !== null && shiftWorkDays === 0 && (
                          <p className="text-xs text-orange-500 text-center">Chưa có đăng ký ca đã duyệt cho tháng này</p>
                        )}
                        {calculationMethod === 'attendance' && attendanceStats !== null && attendanceStats.actualWorkDays === 0 && (
                          <p className="text-xs text-orange-500 text-center">Chưa có dữ liệu check-in/check-out hợp lệ cho tháng này</p>
                        )}
                        {calculationMethod !== 'shift' && incompleteDays.length > 0 && (
                          <div className="mt-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-left">
                            <p className="text-xs font-bold text-amber-800 mb-1">Ngày thiếu chấm công (tham khảo):</p>
                            <p className="text-xs text-amber-700 mb-2">
                              {incompleteDays.map(d => `${d.date} (${d.hasCheckIn ? 'có vào' : 'thiếu vào'}, ${d.hasCheckOut ? 'có ra' : 'thiếu ra'})`).join(', ')}
                            </p>
                          </div>
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
                              <p className="text-xs text-slate-500">{record.actualWorkDays.toFixed(2)} ngày công</p>
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
