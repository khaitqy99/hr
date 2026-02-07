import React, { useState, useEffect } from 'react';
import { PayrollRecord, User, UserRole, AttendanceRecord, AttendanceType, ShiftRegistration, OffType, Holiday, ContractType } from '../../types';
import { getAllPayrolls, getAllUsers, calculatePayroll, createOrUpdatePayroll, getShiftRegistrations, getAllAttendance, getHolidays, getConfigNumber } from '../../services/db';
import { exportMultipleTablesToCSV } from '../../utils/export';

interface PayrollManagementProps {
  onRegisterReload?: (handler: () => void | Promise<void>) => void;
  setView?: (view: string, options?: { replace?: boolean; adminPath?: string; employeeId?: string }) => void;
}

const PayrollManagement: React.FC<PayrollManagementProps> = ({ onRegisterReload, setView }) => {
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

  const handleExport = async () => {
    if (payrollRecords.length === 0) {
      alert('Không có dữ liệu để xuất');
      return;
    }

    try {
      // Lấy tất cả dữ liệu cần thiết
      const [allAttendance, allShifts, holidays] = await Promise.all([
        getAllAttendance(10000), // Lấy nhiều records để đảm bảo có đủ dữ liệu
        getShiftRegistrations(undefined, UserRole.ADMIN),
        getHolidays(),
      ]);

      const [monthStr, yearStr] = selectedMonth.split('-');
      const targetMonth = parseInt(monthStr);
      const targetYear = parseInt(yearStr);
      const monthStart = new Date(targetYear, targetMonth - 1, 1).getTime();
      const monthEnd = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999).getTime();

      // Lọc dữ liệu theo tháng
      const attendanceInMonth = allAttendance.filter(record => {
        return record.timestamp >= monthStart && record.timestamp <= monthEnd;
      });

      const shiftsInMonth = allShifts.filter(shift => {
        return shift.date >= monthStart && shift.date <= monthEnd;
      });

      // Tạo danh sách các ngày trong tháng
      const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();
      const dateColumns: string[] = [];
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(targetYear, targetMonth - 1, day);
        const dateStr = `${String(day).padStart(2, '0')}/${String(targetMonth).padStart(2, '0')}/${targetYear}`;
        dateColumns.push(dateStr);
      }

      // Lấy config
      const [standardWorkDays, workHoursPerDay, overtimeRate] = await Promise.all([
        getConfigNumber('standard_work_days', 27),
        getConfigNumber('work_hours_per_day', 8),
        getConfigNumber('overtime_rate', 1.5),
      ]);

      // Tạo dữ liệu CSV
      const csvRows: any[] = [];

      // Tạo header - chỉ giữ lại các cột có dữ liệu trong hệ thống
      const headers = [
        'Họ Tên',
        'Bộ Phận',
        'Lương Tổng',
        'Ngày công - Số ngày',
        'Ngày công - Lương',
        'Tăng ca bắt buộc x1.5 - Số giờ',
        'Tăng ca bắt buộc x1.5 - Lương',
        'Phụ cấp',
        'Thưởng',
        'Khấu trừ',
        'Thực nhận',
        'Ghi Chú',
      ];

      // Thêm các cột ngày
      dateColumns.forEach(dateStr => {
        headers.push(`${dateStr} - IN`, `${dateStr} - OUT`);
      });

      csvRows.push(headers);

      // Xử lý từng nhân viên
      for (const payroll of payrollRecords) {
        const employee = employees.find(e => e.id === payroll.userId);
        if (!employee) continue;

        // Lấy attendance của nhân viên trong tháng
        const empAttendance = attendanceInMonth.filter(a => a.userId === payroll.userId);
        
        // Nhóm attendance theo ngày
        const attendanceByDate: Record<string, { checkIn?: AttendanceRecord; checkOut?: AttendanceRecord }> = {};
        empAttendance.forEach(record => {
          const date = new Date(record.timestamp);
          const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
          if (!attendanceByDate[dateKey]) {
            attendanceByDate[dateKey] = {};
          }
          if (record.type === AttendanceType.CHECK_IN) {
            attendanceByDate[dateKey].checkIn = record;
          } else if (record.type === AttendanceType.CHECK_OUT) {
            attendanceByDate[dateKey].checkOut = record;
          }
        });

        // Lấy shifts của nhân viên trong tháng
        const empShifts = shiftsInMonth.filter(s => s.userId === payroll.userId);

        // Tính toán các giá trị - chỉ sử dụng dữ liệu có trong payroll record
        const baseSalary = payroll.baseSalary;
        
        // Tính lương theo ngày công từ payroll (đã được tính trong hệ thống)
        const workDaySalary = (baseSalary / standardWorkDays) * payroll.actualWorkDays;
        
        // Sử dụng OT hours và OT pay từ payroll (đã được tính trong hệ thống)
        const mandatoryOTHours = payroll.otHours || 0;
        const mandatoryOTSalary = payroll.otPay || 0;

        // Tạo row cho nhân viên - chỉ các cột có dữ liệu trong hệ thống
        const row: any[] = [
          employee.name,
          employee.department || '',
          baseSalary.toLocaleString('vi-VN'),
          payroll.actualWorkDays,
          Math.round(workDaySalary).toLocaleString('vi-VN'),
          mandatoryOTHours.toFixed(1),
          Math.round(mandatoryOTSalary).toLocaleString('vi-VN'),
          payroll.allowance.toLocaleString('vi-VN'),
          payroll.bonus.toLocaleString('vi-VN'),
          payroll.deductions.toLocaleString('vi-VN'),
          payroll.netSalary.toLocaleString('vi-VN'),
          '', // Ghi chú
        ];

        // Thêm dữ liệu IN/OUT cho từng ngày
        const DEFAULT_IN = '09:00';
        const DEFAULT_OUT = '18:00';
        
        dateColumns.forEach(dateStr => {
          const [dayStr, monthStr, yearStr] = dateStr.split('/');
          const dateKey = `${yearStr}-${monthStr.padStart(2, '0')}-${dayStr.padStart(2, '0')}`;
          const dayAttendance = attendanceByDate[dateKey];
          
          // Tìm shift cho ngày này
          const dayTimestamp = new Date(parseInt(yearStr), parseInt(monthStr) - 1, parseInt(dayStr)).getTime();
          const dayShift = empShifts.find(s => {
            const shiftDate = new Date(s.date);
            return shiftDate.getDate() === parseInt(dayStr) && 
                   shiftDate.getMonth() + 1 === parseInt(monthStr) &&
                   shiftDate.getFullYear() === parseInt(yearStr);
          });

          let inValue = '';
          let outValue = '';

          // Kiểm tra ngày lễ
          const date = new Date(parseInt(yearStr), parseInt(monthStr) - 1, parseInt(dayStr));
          const isHolidayDate = holidays.some(h => {
            const hDate = new Date(h.date);
            if (h.isRecurring) {
              return hDate.getMonth() === date.getMonth() && hDate.getDate() === date.getDate();
            } else {
              return hDate.getTime() === date.getTime();
            }
          });

          // Logic hiển thị giống như phần đăng ký ca
          if (isHolidayDate) {
            inValue = 'LỄ';
            outValue = 'LỄ';
          } else if (dayShift) {
            if (dayShift.shift === 'OFF') {
              if (dayShift.offType === OffType.LE) {
                inValue = 'LỄ';
                outValue = 'LỄ';
              } else {
                // Hiển thị loại OFF
                if (dayShift.offType === OffType.OFF_DK) {
                  inValue = 'OFF DK';
                } else if (dayShift.offType === OffType.OFF_PN) {
                  inValue = 'OFF PN';
                } else if (dayShift.offType === OffType.OFF_KL) {
                  inValue = 'OFF KL';
                } else if (dayShift.offType === OffType.CT) {
                  inValue = 'CT';
                } else {
                  inValue = 'OFF';
                }
                outValue = '';
              }
            } else if (dayShift.shift === 'CUSTOM') {
              // Nếu có attendance thực tế, ưu tiên hiển thị attendance
              if (dayAttendance?.checkIn) {
                const time = new Date(dayAttendance.checkIn.timestamp);
                inValue = `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`;
              } else {
                // Hiển thị giờ từ shift đăng ký
                inValue = dayShift.startTime || DEFAULT_IN;
              }
              
              if (dayAttendance?.checkOut) {
                const time = new Date(dayAttendance.checkOut.timestamp);
                outValue = `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`;
                // Kiểm tra có làm thêm không
                if (dayAttendance.checkOut.status === 'OVERTIME') {
                  outValue += ' BB';
                }
              } else {
                // Hiển thị giờ từ shift đăng ký
                outValue = dayShift.endTime || DEFAULT_OUT;
              }
              
              // Nếu là học việc
              if (employee.contractType === ContractType.TRIAL) {
                inValue = 'HV';
                outValue = 'HV';
              }
            }
          } else {
            // Không có shift đăng ký, chỉ hiển thị attendance nếu có
            if (dayAttendance?.checkIn) {
              const time = new Date(dayAttendance.checkIn.timestamp);
              inValue = `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`;
            }
            if (dayAttendance?.checkOut) {
              const time = new Date(dayAttendance.checkOut.timestamp);
              outValue = `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`;
              // Kiểm tra có làm thêm không
              if (dayAttendance.checkOut.status === 'OVERTIME') {
                outValue += ' BB';
              }
            }
          }

          row.push(inValue, outValue);
        });

        csvRows.push(row);
      }

      // Xuất CSV
      const csvContent = csvRows.map(row => 
        row.map((cell: any) => {
          const str = String(cell);
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        }).join(',')
      ).join('\n');

      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `bang_luong_chi_tiet_${selectedMonth}_${Date.now()}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      alert('Đã xuất thành công file CSV bảng lương chi tiết!');
    } catch (error: any) {
      alert('Lỗi khi xuất dữ liệu: ' + (error?.message || 'Vui lòng thử lại'));
      console.error('Error exporting data:', error);
    }
  };

  const handleRecalculateAll = async () => {
    if (!selectedMonth) {
      alert('Vui lòng chọn tháng');
      return;
    }

    if (!confirm(`Bạn có chắc muốn tính lại lương cho tất cả nhân viên trong tháng ${selectedMonth}?\n\nLưu ý: Thao tác này sẽ tính lại từ đăng ký ca và nghỉ phép (không dùng chấm công).`)) {
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
          // Tính lương dựa trên đăng ký ca (shift), không phụ thuộc check-in/check-out
          const payroll = await calculatePayroll(
            employee,
            selectedMonth,
            undefined, // actualWorkDays - lấy từ đăng ký ca
            undefined, // otHours
            0, // allowance
            0, // bonus
            false, // useAttendance - không dùng chấm công
            true, // useLeave - trừ ngày nghỉ phép
            true // useShift - ngày công từ đăng ký ca
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
                          {employee && setView ? (
                            <button
                              onClick={() => setView('employee-profile', { employeeId: employee.id })}
                              className="text-sm font-bold text-blue-600 hover:text-blue-700 hover:underline transition-colors text-left"
                            >
                              {employee.name}
                            </button>
                          ) : (
                            <p className="text-sm font-bold text-slate-800">{employee?.name || item.userId}</p>
                          )}
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
