import React, { useState, useEffect } from 'react';
import { PayrollRecord, User, UserRole } from '../../types';
import { getAllPayrolls, getAllUsers, calculatePayroll, createOrUpdatePayroll } from '../../services/db';
import { exportToCSV } from '../../utils/export';

interface PayrollManagementProps {
  onRegisterReload?: (handler: () => void | Promise<void>) => void;
}

const PayrollManagement: React.FC<PayrollManagementProps> = ({ onRegisterReload }) => {
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRecalculating, setIsRecalculating] = useState(false);

  useEffect(() => {
    const initData = async () => {
      try {
        setError(null);
        setLoading(true);
        const now = new Date();
        const currentMonth = `${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
        setSelectedMonth(currentMonth);
        await loadData(currentMonth);
        const users = await getAllUsers();
        setEmployees(users);
      } catch (err: any) {
        setError('Không thể tải dữ liệu: ' + (err?.message || 'Vui lòng thử lại'));
        console.error('Error initializing data:', err);
      } finally {
        setLoading(false);
      }
    };
    initData();
  }, []);

  useEffect(() => {
    if (onRegisterReload && selectedMonth) {
      onRegisterReload(async () => {
        try {
          setError(null);
          await loadData(selectedMonth);
          const users = await getAllUsers();
          setEmployees(users);
        } catch (err: any) {
          setError('Không thể tải dữ liệu: ' + (err?.message || 'Vui lòng thử lại'));
          console.error('Error reloading data:', err);
        }
      });
    }
  }, [onRegisterReload, selectedMonth]);

  const loadData = async (month: string) => {
    try {
      setError(null);
      const records = await getAllPayrolls(month);
      setPayrollRecords(records);
    } catch (err: any) {
      setError('Không thể tải bảng lương: ' + (err?.message || 'Vui lòng thử lại'));
      console.error('Error loading payroll data:', err);
      setPayrollRecords([]);
      throw err; // Re-throw để caller có thể handle
    }
  };

  useEffect(() => {
    if (selectedMonth) {
      loadData(selectedMonth).catch(() => {
        // Error đã được handle trong loadData
      });
    }
  }, [selectedMonth]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

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

  const handleExport = () => {
    if (payrollRecords.length === 0) {
      alert('Không có dữ liệu để xuất');
      return;
    }
    const filename = `payroll_${selectedMonth}_${Date.now()}.csv`;
    exportToCSV(payrollRecords, filename);
  };

  const handleRecalculateAll = async () => {
    if (!selectedMonth) {
      alert('Vui lòng chọn tháng');
      return;
    }

    if (!confirm(`Bạn có chắc muốn tính lại lương cho tất cả nhân viên trong tháng ${selectedMonth}?\n\nLưu ý: Thao tác này sẽ tính lại từ dữ liệu chấm công, nghỉ phép và đăng ký ca.`)) {
      return;
    }

    setIsRecalculating(true);
    setError(null);

    try {
      const activeEmployees = employees.filter(e => e.role !== UserRole.ADMIN && e.status === 'ACTIVE');
      let successCount = 0;
      let errorCount = 0;

      for (const employee of activeEmployees) {
        try {
          // Tính lại lương với tích hợp attendance, leave và shift
          const payroll = await calculatePayroll(
            employee,
            selectedMonth,
            undefined, // actualWorkDays - sẽ tính từ attendance
            undefined, // otHours - sẽ tính từ attendance
            0, // allowance
            0, // bonus
            true, // useAttendance
            true, // useLeave - trừ ngày nghỉ
            false // useShift - không dùng shift làm nguồn chính
          );

          // Lấy payroll hiện tại để giữ lại allowance và bonus nếu có
          const existingPayroll = payrollRecords.find(p => p.userId === employee.id);
          if (existingPayroll) {
            payroll.allowance = existingPayroll.allowance;
            payroll.bonus = existingPayroll.bonus;
            payroll.status = existingPayroll.status; // Giữ nguyên trạng thái thanh toán
          }

          await createOrUpdatePayroll(payroll);
          successCount++;
        } catch (err: any) {
          console.error(`Error calculating payroll for ${employee.name}:`, err);
          errorCount++;
        }
      }

      // Reload data
      await loadData(selectedMonth);

      if (errorCount > 0) {
        alert(`Tính lại lương hoàn tất!\n\nThành công: ${successCount} nhân viên\nLỗi: ${errorCount} nhân viên`);
      } else {
        alert(`Tính lại lương thành công cho ${successCount} nhân viên!`);
      }
    } catch (err: any) {
      setError('Lỗi khi tính lại lương: ' + (err?.message || 'Vui lòng thử lại'));
      console.error('Error recalculating payroll:', err);
    } finally {
      setIsRecalculating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm"
          >
            {getMonthOptions().map(month => (
              <option key={month} value={month}>
                Tháng {month.split('-')[0]}/{month.split('-')[1]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRecalculateAll}
            disabled={loading || isRecalculating || !selectedMonth}
            className="px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={`w-4 h-4 ${isRecalculating ? 'animate-spin' : ''}`}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            {isRecalculating ? 'Đang tính...' : 'Tính lại lương'}
          </button>
          <button
            onClick={handleExport}
            disabled={loading || payrollRecords.length === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Xuất CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm text-red-600 font-medium">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-sky-50">
          <p className="text-slate-400 font-medium">Đang tải dữ liệu...</p>
        </div>
      ) : payrollRecords.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-sky-50">
          <p className="text-slate-400 font-medium">Chưa có dữ liệu bảng lương</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-sky-50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">Nhân viên</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">Lương cơ bản</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">Ngày công</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">OT</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">Phụ cấp</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">Thưởng</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">Khấu trừ</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">Thực nhận</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payrollRecords.map((item: PayrollRecord) => {
                  const employee = employees.find(e => e.id === item.userId);
                  return (
                    <tr key={item.id} className="hover:bg-sky-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm font-bold text-slate-800">{employee?.name || item.userId}</p>
                          <p className="text-xs text-slate-500">{employee?.department || ''}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-slate-700">{formatCurrency(item.baseSalary)}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-slate-700">{item.actualWorkDays}/{item.standardWorkDays}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-slate-700">{item.otHours}h</p>
                        {item.otPay > 0 && (
                          <p className="text-xs text-green-600">+{formatCurrency(item.otPay)}</p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {item.allowance > 0 ? (
                          <p className="text-sm text-green-600">+{formatCurrency(item.allowance)}</p>
                        ) : (
                          <p className="text-sm text-slate-400">-</p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {item.bonus > 0 ? (
                          <p className="text-sm text-green-600">+{formatCurrency(item.bonus)}</p>
                        ) : (
                          <p className="text-sm text-slate-400">-</p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-red-600">-{formatCurrency(item.deductions)}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold text-blue-600">{formatCurrency(item.netSalary)}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-xs font-bold px-2 py-1 rounded-lg ${
                          item.status === 'PAID' ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'
                        }`}>
                          {item.status === 'PAID' ? 'Đã thanh toán' : 'Chờ thanh toán'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default PayrollManagement;
