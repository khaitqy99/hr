import React, { useState, useEffect } from 'react';
import { PayrollRecord, User } from '../../types';
import { getAllPayrolls, getAllUsers } from '../../services/db';

interface PayrollManagementProps {
  onRegisterReload?: (handler: () => void | Promise<void>) => void;
}

const PayrollManagement: React.FC<PayrollManagementProps> = ({ onRegisterReload }) => {
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800">Quản lý bảng lương</h2>
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
