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
  const [workHoursPerDay, setWorkHoursPerDay] = useState(8);
  const [selectedPayrollDetail, setSelectedPayrollDetail] = useState<{ payroll: PayrollRecord; employee: User } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [shiftDetails, setShiftDetails] = useState<ShiftRegistration[]>([]);

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
        // Load work hours per day config
        const hours = await getConfigNumber('work_hours_per_day', 8);
        setWorkHoursPerDay(hours);
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
        'Giờ làm việc',
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

        // Helper function để format số tiền với dấu phẩy ngăn cách
        const formatNumber = (num: number): string => {
          return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        };

        // Tạo row cho nhân viên - chỉ các cột có dữ liệu trong hệ thống
        const row: any[] = [
          employee.name,
          employee.department || '',
          formatNumber(baseSalary), // Format với dấu phẩy: 5,000,000
          (payroll.actualWorkDays * workHoursPerDay).toFixed(1) + 'h',
          payroll.actualWorkDays.toFixed(2),
          formatNumber(Math.round(workDaySalary)), // Format với dấu phẩy
          mandatoryOTHours.toFixed(1),
          formatNumber(Math.round(mandatoryOTSalary)), // Format với dấu phẩy
          formatNumber(payroll.allowance), // Format với dấu phẩy
          formatNumber(payroll.bonus), // Format với dấu phẩy
          formatNumber(payroll.deductions), // Format với dấu phẩy
          formatNumber(payroll.netSalary), // Format với dấu phẩy
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

          // Logic hiển thị theo đăng ký ca
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
              // Luôn hiển thị giờ từ shift đăng ký
              inValue = dayShift.startTime || DEFAULT_IN;
              outValue = dayShift.endTime || DEFAULT_OUT;
            } else {
              // Ca cố định (MORNING, AFTERNOON, EVENING)
              inValue = DEFAULT_IN;
              outValue = DEFAULT_OUT;
            }
          } else {
            // Không có shift đăng ký - để trống
            inValue = '';
            outValue = '';
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

  const handleViewPayrollDetail = async (payroll: PayrollRecord, employee: User) => {
    setSelectedPayrollDetail({ payroll, employee });
    setDetailLoading(true);
    try {
      // Load shift details for the month
      const shifts = await getShiftRegistrations(employee.id);
      const [monthStr, yearStr] = selectedMonth.split('-');
      const targetMonth = parseInt(monthStr);
      const targetYear = parseInt(yearStr);
      
      const monthShifts = shifts.filter(shift => {
        const shiftDate = new Date(shift.date);
        return shiftDate.getMonth() + 1 === targetMonth && 
               shiftDate.getFullYear() === targetYear;
      });
      
      setShiftDetails(monthShifts);
    } catch (err) {
      console.error('Error loading shift details:', err);
      setShiftDetails([]);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleUpdatePayrollStatus = async (status: 'PAID' | 'PENDING') => {
    if (!selectedPayrollDetail) return;
    
    try {
      const updatedPayroll = {
        ...selectedPayrollDetail.payroll,
        status
      };
      
      await createOrUpdatePayroll(updatedPayroll);
      
      // Update local state
      setSelectedPayrollDetail({
        ...selectedPayrollDetail,
        payroll: updatedPayroll
      });
      
      // Refresh payroll list
      await loadData(selectedMonth);
      
      alert(status === 'PAID' ? 'Đã đánh dấu thanh toán thành công!' : 'Đã chuyển về chờ thanh toán!');
    } catch (err) {
      console.error('Error updating payroll status:', err);
      alert('Có lỗi khi cập nhật trạng thái!');
    }
  };

  return (
    <div className="space-y-6">
      {/* Payroll Detail Modal */}
      {selectedPayrollDetail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-white">{selectedPayrollDetail.employee.name}</h3>
                <p className="text-sm text-blue-100">Chi tiết lương tháng {selectedMonth}</p>
              </div>
              <button
                onClick={() => setSelectedPayrollDetail(null)}
                className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {detailLoading ? (
                <div className="text-center py-12">
                  <p className="text-slate-400">Đang tải chi tiết...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* LEFT COLUMN - Summary & Breakdown */}
                  <div className="space-y-6">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-blue-50 rounded-xl p-4">
                        <p className="text-xs font-bold text-blue-600 mb-1">Lương cơ bản</p>
                        <p className="text-lg font-bold text-blue-700">{formatCurrency(selectedPayrollDetail.payroll.baseSalary)}</p>
                      </div>
                      <div className="bg-green-50 rounded-xl p-4">
                        <p className="text-xs font-bold text-green-600 mb-1">Giờ làm việc</p>
                        <p className="text-lg font-bold text-green-700">{(selectedPayrollDetail.payroll.actualWorkDays * workHoursPerDay).toFixed(1)}h</p>
                        <p className="text-xs text-green-600">{selectedPayrollDetail.payroll.actualWorkDays.toFixed(2)} công</p>
                      </div>
                      <div className="bg-purple-50 rounded-xl p-4">
                        <p className="text-xs font-bold text-purple-600 mb-1">Giờ OT</p>
                        <p className="text-lg font-bold text-purple-700">{selectedPayrollDetail.payroll.otHours}h</p>
                        <p className="text-xs text-purple-600">+{formatCurrency(selectedPayrollDetail.payroll.otPay)}</p>
                      </div>
                      <div className="bg-orange-50 rounded-xl p-4">
                        <p className="text-xs font-bold text-orange-600 mb-1">Thực nhận</p>
                        <p className="text-lg font-bold text-orange-700">{formatCurrency(selectedPayrollDetail.payroll.netSalary)}</p>
                      </div>
                    </div>

                    {/* Salary Breakdown */}
                    <div className="bg-slate-50 rounded-xl p-6 space-y-3">
                      <h4 className="text-sm font-bold text-slate-700 mb-4">Chi tiết tính lương</h4>
                      
                      <div className="flex justify-between items-center py-2 border-b border-slate-200">
                        <span className="text-sm text-slate-600">Lương theo ngày công</span>
                        <span className="text-sm font-bold text-slate-800">
                          {formatCurrency((selectedPayrollDetail.payroll.baseSalary / selectedPayrollDetail.payroll.standardWorkDays) * selectedPayrollDetail.payroll.actualWorkDays)}
                        </span>
                      </div>
                      
                      <div className="flex justify-between items-center py-2 border-b border-slate-200">
                        <span className="text-sm text-slate-600">
                          Công thức: (LCB / {selectedPayrollDetail.payroll.standardWorkDays}) × {selectedPayrollDetail.payroll.actualWorkDays.toFixed(2)}
                        </span>
                        <span className="text-xs text-slate-500">
                          = ({formatCurrency(selectedPayrollDetail.payroll.baseSalary)} / {selectedPayrollDetail.payroll.standardWorkDays}) × {selectedPayrollDetail.payroll.actualWorkDays.toFixed(2)}
                        </span>
                      </div>

                    {selectedPayrollDetail.payroll.otHours > 0 && (
                      <>
                        <div className="flex justify-between items-center py-2 border-b border-slate-200">
                          <span className="text-sm text-slate-600">Lương OT ({selectedPayrollDetail.payroll.otHours}h × 1.5)</span>
                          <span className="text-sm font-bold text-green-600">+{formatCurrency(selectedPayrollDetail.payroll.otPay)}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-slate-200">
                          <span className="text-sm text-slate-600">
                            Công thức: (LCB / {selectedPayrollDetail.payroll.standardWorkDays} / {workHoursPerDay}) × 1.5 × {selectedPayrollDetail.payroll.otHours}
                          </span>
                          <span className="text-xs text-slate-500">
                            = {formatCurrency(selectedPayrollDetail.payroll.baseSalary / selectedPayrollDetail.payroll.standardWorkDays / workHoursPerDay)} × 1.5 × {selectedPayrollDetail.payroll.otHours}
                          </span>
                        </div>
                      </>
                    )}

                    {selectedPayrollDetail.payroll.allowance > 0 && (
                      <div className="flex justify-between items-center py-2 border-b border-slate-200">
                        <span className="text-sm text-slate-600">Phụ cấp</span>
                        <span className="text-sm font-bold text-green-600">+{formatCurrency(selectedPayrollDetail.payroll.allowance)}</span>
                      </div>
                    )}

                    {selectedPayrollDetail.payroll.bonus > 0 && (
                      <div className="flex justify-between items-center py-2 border-b border-slate-200">
                        <span className="text-sm text-slate-600">Thưởng</span>
                        <span className="text-sm font-bold text-green-600">+{formatCurrency(selectedPayrollDetail.payroll.bonus)}</span>
                      </div>
                    )}

                    {selectedPayrollDetail.payroll.deductions > 0 && (
                      <div className="flex justify-between items-center py-2 border-b border-slate-200">
                        <span className="text-sm text-slate-600">Khấu trừ (BHXH, v.v.)</span>
                        <span className="text-sm font-bold text-red-600">-{formatCurrency(selectedPayrollDetail.payroll.deductions)}</span>
                      </div>
                    )}

                    <div className="flex justify-between items-center py-3 bg-blue-50 rounded-lg px-4 mt-4">
                      <span className="text-base font-bold text-blue-700">Tổng thực nhận</span>
                      <span className="text-xl font-bold text-blue-700">{formatCurrency(selectedPayrollDetail.payroll.netSalary)}</span>
                    </div>
                  </div>
                </div>

                {/* RIGHT COLUMN - Shift Details */}
                <div>
                  {shiftDetails.length > 0 && (
                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden h-full">
                      <div className="bg-slate-50 px-6 py-3 border-b border-slate-200">
                        <h4 className="text-sm font-bold text-slate-700">Chi tiết ca làm việc ({shiftDetails.length} ca)</h4>
                      </div>
                      <div className="max-h-[600px] overflow-y-auto">
                        <table className="w-full">
                          <thead className="bg-slate-50 sticky top-0">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-bold text-slate-600 w-1/2 border-r border-slate-200">Ngày / Ca / Loại</th>
                              <th className="px-4 py-2 text-right text-xs font-bold text-slate-600 w-1/2">Giờ / Tiền</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {(() => {
                              let totalMoney = 0;
                              const dailyRate = selectedPayrollDetail.payroll.baseSalary / selectedPayrollDetail.payroll.standardWorkDays;
                              const hourlyRate = dailyRate / workHoursPerDay;
                              
                              const rows = shiftDetails
                                .sort((a, b) => a.date - b.date)
                                .map((shift, idx) => {
                                  const date = new Date(shift.date);
                                  const dateStr = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
                                  
                                  let shiftLabel = shift.shift;
                                  let hours = workHoursPerDay;
                                  let typeLabel = 'Làm việc';
                                  let typeColor = 'text-green-600 bg-green-50';
                                  let money = 0;

                                  if (shift.shift === 'CUSTOM' && shift.startTime && shift.endTime) {
                                    shiftLabel = `${shift.startTime} - ${shift.endTime}`;
                                    const [startHour, startMin] = shift.startTime.split(':').map(Number);
                                    const [endHour, endMin] = shift.endTime.split(':').map(Number);
                                    hours = ((endHour * 60 + endMin) - (startHour * 60 + startMin)) / 60;
                                    const regularHours = Math.min(hours, workHoursPerDay);
                                    money = hourlyRate * regularHours;
                                  } else if (shift.shift === 'OFF') {
                                    if (shift.offType === OffType.OFF_PN) {
                                      typeLabel = 'Phép năm';
                                      typeColor = 'text-blue-600 bg-blue-50';
                                      money = dailyRate;
                                    } else if (shift.offType === OffType.LE) {
                                      typeLabel = 'Nghỉ lễ';
                                      typeColor = 'text-purple-600 bg-purple-50';
                                      money = dailyRate;
                                    } else if (shift.offType === OffType.OFF_DK) {
                                      typeLabel = 'OFF định kỳ';
                                      typeColor = 'text-slate-600 bg-slate-50';
                                      hours = 0;
                                      money = 0;
                                    } else if (shift.offType === OffType.OFF_KL) {
                                      typeLabel = 'OFF không lương';
                                      typeColor = 'text-red-600 bg-red-50';
                                      hours = 0;
                                      money = 0;
                                    } else {
                                      typeLabel = 'OFF';
                                      typeColor = 'text-slate-600 bg-slate-50';
                                      hours = 0;
                                      money = 0;
                                    }
                                    shiftLabel = shift.offType || 'OFF';
                                  } else {
                                    money = dailyRate;
                                  }

                                  totalMoney += money;

                                  return (
                                    <tr key={idx} className="hover:bg-slate-50">
                                      <td className="px-4 py-3 border-r border-slate-100">
                                        <div className="space-y-1">
                                          <p className="text-sm font-bold text-slate-700">{dateStr}</p>
                                          <p className="text-xs text-slate-600">{shiftLabel}</p>
                                          <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded ${typeColor}`}>
                                            {typeLabel}
                                          </span>
                                        </div>
                                      </td>
                                      <td className="px-4 py-3 text-right">
                                        <div className="space-y-1">
                                          <p className="text-sm font-bold text-slate-800">
                                            {hours > 0 ? `${Math.min(hours, workHoursPerDay).toFixed(1)}h` : '-'}
                                          </p>
                                          <p className="text-base font-bold text-blue-600">
                                            {money > 0 ? formatCurrency(Math.round(money)) : '-'}
                                          </p>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                });

                              // Add total row
                              rows.push(
                                <tr key="total" className="bg-gradient-to-r from-blue-50 to-blue-100 font-bold border-t-2 border-blue-200">
                                  <td className="px-4 py-3 border-r border-blue-200">
                                    <div className="space-y-1">
                                      <p className="text-sm text-blue-700">Tổng cộng</p>
                                      <p className="text-xs text-blue-600">{selectedPayrollDetail.payroll.actualWorkDays.toFixed(2)} công</p>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    <div className="space-y-1">
                                      <p className="text-sm text-blue-700">
                                        {(selectedPayrollDetail.payroll.actualWorkDays * workHoursPerDay).toFixed(1)}h
                                      </p>
                                      <p className="text-lg text-blue-700">
                                        {formatCurrency(Math.round(totalMoney))}
                                      </p>
                                    </div>
                                  </td>
                                </tr>
                              );

                              return rows;
                            })()}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="border-t border-slate-200 px-6 py-4 bg-slate-50 flex justify-between items-center">
              <div>
                {selectedPayrollDetail.payroll.status === 'PENDING' ? (
                  <button
                    onClick={() => handleUpdatePayrollStatus('PAID')}
                    className="px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 transition-colors flex items-center gap-2"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Đánh dấu đã thanh toán
                  </button>
                ) : (
                  <button
                    onClick={() => handleUpdatePayrollStatus('PENDING')}
                    className="px-4 py-2 bg-orange-600 text-white rounded-xl text-sm font-bold hover:bg-orange-700 transition-colors flex items-center gap-2"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Chuyển về chờ thanh toán
                  </button>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setSelectedPayrollDetail(null)}
                  className="px-4 py-2 bg-slate-200 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-300 transition-colors"
                >
                  Đóng
                </button>
                {setView && (
                  <button
                    onClick={() => {
                      setSelectedPayrollDetail(null);
                      setView('employee-profile', { employeeId: selectedPayrollDetail.employee.id });
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors"
                  >
                    Xem hồ sơ nhân viên
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

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
          <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">Nhân viên</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">Lương cơ bản</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">Giờ làm việc</th>
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
                          {employee ? (
                            <button
                              onClick={() => handleViewPayrollDetail(item, employee)}
                              className="text-sm font-bold text-blue-600 hover:text-blue-700 hover:underline transition-colors text-left"
                            >
                              {employee.name}
                            </button>
                          ) : (
                            <p className="text-sm font-bold text-slate-800">{item.userId}</p>
                          )}
                          <p className="text-xs text-slate-500">{employee?.department || ''}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-slate-700">{formatCurrency(item.baseSalary)}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-slate-700">{(item.actualWorkDays * workHoursPerDay).toFixed(1)}h</p>
                        <p className="text-xs text-slate-500">({item.actualWorkDays.toFixed(2)} công)</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-slate-700">{item.actualWorkDays.toFixed(2)}/{item.standardWorkDays}</p>
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
