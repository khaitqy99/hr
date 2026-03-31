import React, { useState, useEffect, useMemo } from 'react';
import { PayrollRecord, User, UserRole, AttendanceRecord, AttendanceType, ShiftRegistration, OffType, Holiday, ContractType, Branch } from '../../types';
import { getAllPayrolls, getAllUsers, calculatePayroll, createOrUpdatePayroll, getShiftRegistrations, getAllAttendance, getHolidays, getConfigNumber, updateShiftRegistration, setPayrollNoLunchBreakDates, getBranches } from '../../services/db';
import { exportMultipleTablesToCSV } from '../../utils/export';
import {
  calculateRegularAndOTHoursWithNoLunchBreak,
  calculateTotalWorkedHoursWithNoLunchBreak,
  payrollNoLunchKey,
} from '../../utils/payrollHours';

/** Kỳ lương: [01/MM, 02/MM+1) theo local time (bao gồm cả ngày 01 tháng sau). */
const getPayrollCycleRange = (month: string): { start: number; endExclusive: number } => {
  const [monthStr, yearStr] = month.split('-');
  const targetMonth = parseInt(monthStr, 10);
  const targetYear = parseInt(yearStr, 10);
  const start = new Date(targetYear, targetMonth - 1, 1).getTime();
  const endExclusive = new Date(targetYear, targetMonth, 2).getTime();
  return { start, endExclusive };
};

const isInPayrollCycle = (timestamp: number, month: string): boolean => {
  const { start, endExclusive } = getPayrollCycleRange(month);
  return timestamp >= start && timestamp < endExclusive;
};

const formatPayrollCycleLabel = (month: string): string => {
  const { start } = getPayrollCycleRange(month);
  const [monthStr, yearStr] = month.split('-');
  const targetMonth = parseInt(monthStr, 10);
  const targetYear = parseInt(yearStr, 10);
  const startDate = new Date(start);
  const endDate = new Date(targetYear, targetMonth, 1);
  const ddmmyyyy = (d: Date) =>
    `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  return `${ddmmyyyy(startDate)} - ${ddmmyyyy(endDate)}`;
};

const filterShiftsByPayrollCycle = (shifts: ShiftRegistration[], month: string): ShiftRegistration[] => {
  return shifts.filter(shift => isInPayrollCycle(shift.date, month));
};

interface PayrollManagementProps {
  onRegisterReload?: (handler: () => void | Promise<void>) => void;
  setView?: (view: string, options?: { replace?: boolean; adminPath?: string; employeeId?: string }) => void;
  language: 'vi' | 'en';
}

const PayrollManagement: React.FC<PayrollManagementProps> = ({ onRegisterReload, setView, language }) => {
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [filterBranch, setFilterBranch] = useState<string>('ALL');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [workHoursPerDay, setWorkHoursPerDay] = useState(8);
  const [selectedPayrollDetail, setSelectedPayrollDetail] = useState<{ payroll: PayrollRecord; employee: User } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [shiftDetails, setShiftDetails] = useState<ShiftRegistration[]>([]);
  const [allShiftsInMonth, setAllShiftsInMonth] = useState<ShiftRegistration[]>([]);
  /** Mỗi khóa `tháng::userId` → danh sách shift.date được đánh dấu “không nghỉ trưa”. */
  const [noLunchBreakByKey, setNoLunchBreakByKey] = useState<Record<string, number[]>>({});
  const [isRecalculatingDetail, setIsRecalculatingDetail] = useState(false);
  const [editingNoteShiftId, setEditingNoteShiftId] = useState<string | null>(null);
  const [noteInputValue, setNoteInputValue] = useState<string>('');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [selectedUpgradePlan, setSelectedUpgradePlan] = useState<'STARTER' | 'PRO' | 'ULTRA' | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const t = {
    vi: {
      month: 'Kỳ lương',
      recalculate: 'Tính lại lương',
      exportCSV: 'Xuất CSV',
      employee: 'Nhân viên',
      department: 'Phòng ban',
      branch: 'Chi nhánh',
      allBranches: 'Tất cả chi nhánh',
      baseSalary: 'Lương cơ bản',
      workDays: 'Ngày công',
      overtime: 'Tăng ca',
      allowance: 'Phụ cấp',
      bonus: 'Thưởng',
      deduction: 'Khấu trừ',
      netSalary: 'Thực lãnh',
      actions: 'Thao tác',
      viewDetails: 'Chi tiết',
      noData: 'Chưa có dữ liệu lương',
      loading: 'Đang tải...',
      recalculating: 'Đang tính lại...',
      selectMonth: 'Vui lòng chọn tháng',
      confirmRecalculate: 'Bạn có chắc muốn tính lại lương cho tất cả nhân viên trong kỳ {month}?\n\nLưu ý: Thao tác này sẽ tính lại từ đăng ký ca và nghỉ phép (không dùng chấm công).',
      recalculateSuccess: 'Tính lại lương thành công cho {count} nhân viên!',
      recalculateComplete: 'Tính lại lương hoàn tất!\n\nThành công: {success} nhân viên\nLỗi: {error} nhân viên',
      recalculateError: 'Lỗi khi tính lại lương: {error}',
      loadError: 'Không thể tải dữ liệu: {error}',
      loadPayrollError: 'Không thể tải bảng lương: {error}',
      noDataToExport: 'Không có dữ liệu để xuất',
      exportSuccess: 'Đã xuất thành công file CSV bảng lương chi tiết!',
      exportError: 'Lỗi khi xuất dữ liệu: {error}',
      payrollDetail: 'Chi tiết kỳ lương {month}',
      close: 'Đóng',
      viewProfile: 'Xem hồ sơ nhân viên',
      salaryBreakdown: 'Chi tiết tính lương',
      workShiftSalary: 'Lương theo ca làm việc',
      overtimeSalary: 'Lương OT ({hours}h × 1.5)',
      totalBeforeDeduction: 'Tổng trước khấu trừ',
      socialInsurance: 'BHXH (10.5%)',
      totalAfterDeduction: 'Tổng sau khấu trừ',
      shiftDetails: 'Chi tiết ca làm việc',
      date: 'Ngày',
      type: 'Loại',
      hours: 'Giờ',
      salary: 'Lương',
      note: 'Ghi chú',
      noNote: 'Chưa có ghi chú',
      addNote: 'Thêm ghi chú',
      editNote: 'Sửa ghi chú',
      saveNote: 'Lưu',
      cancelNote: 'Hủy',
      offNoSalary: 'OFF không lương',
      totalActualHours: 'Tổng giờ thực tế',
      standardWorkDays: 'Ngày công chuẩn',
      actualWorkDays: 'Ngày công thực tế',
      recalculateDetail: 'Tính lại',
      recalculatingDetail: 'Đang tính...',
      markAsPaid: 'Đánh dấu đã thanh toán',
      markAsPending: 'Chuyển về chờ thanh toán',
      markPaidSuccess: 'Đã đánh dấu thanh toán thành công!',
      markPendingSuccess: 'Đã chuyển về chờ thanh toán!',
      updateStatusError: 'Có lỗi khi cập nhật trạng thái!',
      status: 'Trạng thái',
      paid: 'Đã thanh toán',
      pending: 'Chờ thanh toán',
      shiftNotFound: 'Không tìm thấy ca làm việc!',
      noteSaved: 'Đã lưu ghi chú thành công!',
      noteSaveError: 'Có lỗi khi lưu ghi chú!',
    },
    en: {
      month: 'Payroll Cycle',
      recalculate: 'Recalculate Payroll',
      exportCSV: 'Export CSV',
      employee: 'Employee',
      department: 'Department',
      branch: 'Branch',
      allBranches: 'All Branches',
      baseSalary: 'Base Salary',
      workDays: 'Work Days',
      overtime: 'Overtime',
      allowance: 'Allowance',
      bonus: 'Bonus',
      deduction: 'Deduction',
      netSalary: 'Net Salary',
      actions: 'Actions',
      viewDetails: 'Details',
      noData: 'No payroll data yet',
      loading: 'Loading...',
      recalculating: 'Recalculating...',
      selectMonth: 'Please select a month',
      confirmRecalculate: 'Are you sure you want to recalculate payroll for all employees in cycle {month}?\n\nNote: This will recalculate based on shift registrations and leave (not attendance records).',
      recalculateSuccess: 'Successfully recalculated payroll for {count} employees!',
      recalculateComplete: 'Recalculation complete!\n\nSuccess: {success} employees\nErrors: {error} employees',
      recalculateError: 'Error recalculating payroll: {error}',
      loadError: 'Unable to load data: {error}',
      loadPayrollError: 'Unable to load payroll: {error}',
      noDataToExport: 'No data to export',
      exportSuccess: 'Successfully exported detailed payroll CSV file!',
      exportError: 'Error exporting data: {error}',
      payrollDetail: 'Payroll cycle details for {month}',
      close: 'Close',
      viewProfile: 'View Employee Profile',
      salaryBreakdown: 'Salary Breakdown',
      workShiftSalary: 'Work Shift Salary',
      overtimeSalary: 'Overtime Salary ({hours}h × 1.5)',
      totalBeforeDeduction: 'Total Before Deduction',
      socialInsurance: 'Social Insurance (10.5%)',
      totalAfterDeduction: 'Total After Deduction',
      shiftDetails: 'Shift Details',
      date: 'Date',
      type: 'Type',
      hours: 'Hours',
      salary: 'Salary',
      note: 'Note',
      noNote: 'No note yet',
      addNote: 'Add Note',
      editNote: 'Edit Note',
      saveNote: 'Save',
      cancelNote: 'Cancel',
      offNoSalary: 'OFF No Salary',
      totalActualHours: 'Total Actual Hours',
      standardWorkDays: 'Standard Work Days',
      actualWorkDays: 'Actual Work Days',
      recalculateDetail: 'Recalculate',
      recalculatingDetail: 'Calculating...',
      markAsPaid: 'Mark as Paid',
      markAsPending: 'Mark as Pending',
      markPaidSuccess: 'Successfully marked as paid!',
      markPendingSuccess: 'Successfully marked as pending!',
      updateStatusError: 'Error updating status!',
      status: 'Status',
      paid: 'Paid',
      pending: 'Pending',
      shiftNotFound: 'Shift not found!',
      noteSaved: 'Note saved successfully!',
      noteSaveError: 'Error saving note!',
    }
  };

  const text = t[language];

  const detailNoLunchDates = useMemo(
    () =>
      selectedPayrollDetail
        ? new Set(noLunchBreakByKey[payrollNoLunchKey(selectedMonth, selectedPayrollDetail.employee.id)] ?? [])
        : new Set<number>(),
    [noLunchBreakByKey, selectedMonth, selectedPayrollDetail]
  );

  useEffect(() => {
    const initData = async () => {
      try {
        setError(null);
        setLoading(true);
        const now = new Date();
        const currentMonth = `${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
        setSelectedMonth(currentMonth);
        await loadData(currentMonth);
        const [users, branchesData] = await Promise.all([
          getAllUsers(),
          getBranches(),
        ]);
        setEmployees(users);
        setBranches(branchesData.filter(b => b.isActive));
        // Load work hours per day config
        const hours = await getConfigNumber('work_hours_per_day', 8);
        setWorkHoursPerDay(hours);
      } catch (err: any) {
        setError(text.loadError.replace('{error}', err?.message || 'Vui lòng thử lại'));
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
          const [users, branchesData] = await Promise.all([
            getAllUsers(),
            getBranches(),
          ]);
          setEmployees(users);
          setBranches(branchesData.filter(b => b.isActive));
        } catch (err: any) {
          setError(text.loadError.replace('{error}', err?.message || 'Vui lòng thử lại'));
          console.error('Error reloading data:', err);
        }
      });
    }
  }, [onRegisterReload, selectedMonth]);

  const loadData = async (month: string) => {
    try {
      setError(null);
      const [records, allShifts] = await Promise.all([
        getAllPayrolls(month),
        getShiftRegistrations(undefined, UserRole.ADMIN)
      ]);
      setPayrollRecords(records);

      const lunchMap: Record<string, number[]> = {};
      records.forEach(r => {
        lunchMap[payrollNoLunchKey(month, r.userId)] = r.noLunchBreakDates ?? [];
      });
      setNoLunchBreakByKey(lunchMap);
      
      // Lọc shifts theo kỳ lương [01/MM, 02/MM+1)
      const shiftsInMonth = filterShiftsByPayrollCycle(allShifts, month);
      setAllShiftsInMonth(shiftsInMonth);
    } catch (err: any) {
      setError(text.loadPayrollError.replace('{error}', err?.message || 'Vui lòng thử lại'));
      console.error('Error loading payroll data:', err);
      setPayrollRecords([]);
      setNoLunchBreakByKey({});
      setAllShiftsInMonth([]);
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
      alert(text.noDataToExport);
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
      const targetMonth = parseInt(monthStr, 10);
      const targetYear = parseInt(yearStr, 10);
      const { start: cycleStart, endExclusive: cycleEndExclusive } = getPayrollCycleRange(selectedMonth);

      // Lọc dữ liệu theo kỳ lương [01/MM, 02/MM+1)
      const attendanceInMonth = allAttendance.filter(record => {
        return record.timestamp >= cycleStart && record.timestamp < cycleEndExclusive;
      });

      const shiftsInMonth = filterShiftsByPayrollCycle(allShifts, selectedMonth);

      const dateColumns: string[] = [];
      for (let ts = cycleStart; ts < cycleEndExclusive; ts += 24 * 60 * 60 * 1000) {
        const date = new Date(ts);
        const dateStr = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
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
      const headers = language === 'vi' ? [
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
        'Tổng lương (trước BHXH)',
        'Thực lãnh (sau BHXH)',
        'Ghi Chú',
      ] : [
        'Full Name',
        'Department',
        'Total Salary',
        'Work Hours',
        'Work Days - Count',
        'Work Days - Salary',
        'Mandatory OT x1.5 - Hours',
        'Mandatory OT x1.5 - Salary',
        'Allowance',
        'Bonus',
        'Total Salary (Before Deductions)',
        'Net Salary (After Deductions)',
        'Notes',
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

        // Tính toán các giá trị - tính từ tổng giờ thực tế
        const baseSalary = payroll.baseSalary;
        
        // Tính tổng giờ thực tế từ shifts
        const exportNoLunch = new Set(noLunchBreakByKey[payrollNoLunchKey(selectedMonth, payroll.userId)] ?? []);
        const { regularHours: regH, otHours: shiftOtH } = calculateRegularAndOTHoursWithNoLunchBreak(
          empShifts,
          workHoursPerDay,
          exportNoLunch
        );
        const totalWorkedHours = regH + shiftOtH;

        const dailyRate = baseSalary / standardWorkDays;
        const hourlyRate = dailyRate / workHoursPerDay;
        const workDaySalary = hourlyRate * regH;
        const shiftOtPayCalc = hourlyRate * 1.5 * shiftOtH;

        const mandatoryOTHours = shiftOtH;
        const mandatoryOTSalary = shiftOtPayCalc;

        const totalIncome = workDaySalary + shiftOtPayCalc + payroll.allowance + payroll.bonus;
        const totalBeforeDeduction = Math.round(totalIncome);
        const netSalaryCalculated = Math.round(totalIncome - payroll.deductions);

        // Helper function để format số tiền với dấu phẩy ngăn cách
        const formatNumber = (num: number): string => {
          return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        };

        // Tạo row cho nhân viên - chỉ các cột có dữ liệu trong hệ thống
        const row: any[] = [
          employee.name,
          employee.department || '',
          formatNumber(baseSalary), // Format với dấu phẩy: 5,000,000
          totalWorkedHours.toFixed(1) + 'h',
          (totalWorkedHours / workHoursPerDay).toFixed(2),
          formatNumber(Math.round(workDaySalary)), // Format với dấu phẩy
          mandatoryOTHours.toFixed(1),
          formatNumber(Math.round(mandatoryOTSalary)), // Format với dấu phẩy
          formatNumber(payroll.allowance), // Format với dấu phẩy
          formatNumber(payroll.bonus), // Format với dấu phẩy
          formatNumber(totalBeforeDeduction), // Tổng lương trước BHXH
          formatNumber(netSalaryCalculated), // Thực lãnh sau BHXH - tính từ giờ thực tế
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

      alert(text.exportSuccess);
    } catch (error: any) {
      alert(text.exportError.replace('{error}', error?.message || 'Vui lòng thử lại'));
      console.error('Error exporting data:', error);
    }
  };

  const handleRecalculateAllInternal = async () => {
    if (!selectedMonth) {
      alert(text.selectMonth);
      return;
    }

    if (!confirm(text.confirmRecalculate.replace('{month}', formatPayrollCycleLabel(selectedMonth)))) {
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
            payroll.noLunchBreakDates = [
              ...(existingPayroll.noLunchBreakDates ?? payroll.noLunchBreakDates ?? []),
            ];
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
        alert(text.recalculateComplete.replace('{success}', String(successCount)).replace('{error}', String(errorCount)));
      } else {
        alert(text.recalculateSuccess.replace('{count}', String(successCount)));
      }
    } catch (err: any) {
      setError(text.recalculateError.replace('{error}', err?.message || 'Vui lòng thử lại'));
      console.error('Error recalculating payroll:', err);
    } finally {
      setIsRecalculating(false);
    }
  };

  const handleRecalculateAll = () => {
    setSelectedUpgradePlan('PRO');
    setShowUpgradeModal(true);
  };

  const handleUpgradePayment = async () => {
    if (!selectedUpgradePlan) {
      alert(language === 'vi' ? 'Vui lòng chọn gói nâng cấp trước khi thanh toán' : 'Please choose a plan before payment');
      return;
    }

    setIsProcessingPayment(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1200));
      alert(
        language === 'vi'
          ? `Thanh toán gói ${selectedUpgradePlan} thành công! Bắt đầu tính lại lương...`
          : `Payment for ${selectedUpgradePlan} successful! Starting payroll recalculation...`
      );
      setShowUpgradeModal(false);
      await handleRecalculateAllInternal();
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleViewPayrollDetail = async (payroll: PayrollRecord, employee: User) => {
    setSelectedPayrollDetail({ payroll, employee });
    setDetailLoading(true);
    try {
      // Load shift details for the month
      const shifts = await getShiftRegistrations(employee.id);
      const monthShifts = filterShiftsByPayrollCycle(shifts, selectedMonth);
      setShiftDetails(monthShifts);
    } catch (err) {
      console.error('Error loading shift details:', err);
      setShiftDetails([]);
    } finally {
      setDetailLoading(false);
    }
  };

  const toggleNoLunchBreak = async (shiftDate: number) => {
    if (!selectedPayrollDetail) return;
    const userId = selectedPayrollDetail.employee.id;
    const key = payrollNoLunchKey(selectedMonth, userId);
    const prevArr =
      noLunchBreakByKey[key] ?? selectedPayrollDetail.payroll.noLunchBreakDates ?? [];
    const has = prevArr.includes(shiftDate);
    const nextArr = has ? prevArr.filter(d => d !== shiftDate) : [...prevArr, shiftDate];
    try {
      await setPayrollNoLunchBreakDates(userId, selectedMonth, nextArr);
      setNoLunchBreakByKey(prev => ({ ...prev, [key]: nextArr }));
      setSelectedPayrollDetail(prev =>
        prev ? { ...prev, payroll: { ...prev.payroll, noLunchBreakDates: nextArr } } : null
      );
      setPayrollRecords(prev =>
        prev.map(p =>
          p.userId === userId && p.month === selectedMonth ? { ...p, noLunchBreakDates: nextArr } : p
        )
      );
    } catch (e: any) {
      const msg = e?.message || '';
      alert(
        language === 'vi'
          ? `Không lưu được cài đặt nghỉ trưa: ${msg}`
          : `Could not save lunch-break setting: ${msg}`
      );
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
      
      alert(status === 'PAID' ? text.markPaidSuccess : text.markPendingSuccess);
    } catch (err) {
      console.error('Error updating payroll status:', err);
      alert(text.updateStatusError);
    }
  };

  const handleEditNote = (shift: ShiftRegistration) => {
    setEditingNoteShiftId(shift.id);
    setNoteInputValue(shift.note || '');
  };

  const handleSaveNote = async (shiftId: string) => {
    try {
      // Find the shift to get its current data
      const shift = shiftDetails.find(s => s.id === shiftId);
      if (!shift) {
        alert(text.shiftNotFound);
        return;
      }
      
      await updateShiftRegistration(shiftId, { 
        shift: shift.shift,
        startTime: shift.startTime,
        endTime: shift.endTime,
        offType: shift.offType,
        reason: shift.reason,
        note: noteInputValue 
      }, { keepStatus: true });
      
      // Update local state
      setShiftDetails(prev => prev.map(s => 
        s.id === shiftId ? { ...s, note: noteInputValue } : s
      ));
      
      setEditingNoteShiftId(null);
      setNoteInputValue('');
      
      alert(text.noteSaved);
    } catch (err) {
      console.error('Error saving note:', err);
      alert(text.noteSaveError);
    }
  };

  const handleCancelEditNote = () => {
    setEditingNoteShiftId(null);
    setNoteInputValue('');
  };

  return (
    <div className="space-y-6">
      {/* Upgrade troll modal before recalculation */}
      {showUpgradeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-[0_24px_80px_rgba(15,23,42,0.35)] ring-1 ring-slate-900/10">
            {/* Header */}
            <div className="border-b border-slate-100 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-6 py-4 sm:px-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Y99 HR · Payroll Suite
                  </p>
                  <h3 className="mt-1 text-base font-semibold text-white sm:text-lg">
                    {language === 'vi'
                      ? 'Nâng cấp gói để kích hoạt Tính lại lương'
                      : 'Upgrade plan to enable Recalculate Payroll'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowUpgradeModal(false)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-600/60 bg-slate-900/40 text-slate-300 transition hover:border-slate-400 hover:text-white"
                >
                  <span className="sr-only">Close</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
                    className="h-4 w-4"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="px-6 py-5 sm:px-8 sm:py-6">
              <div className="grid gap-4 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => setSelectedUpgradePlan('STARTER')}
                  className={`group flex flex-col justify-between rounded-xl border px-4 py-4 text-left shadow-sm transition 
                    ${
                      selectedUpgradePlan === 'STARTER'
                        ? 'border-sky-500 bg-sky-50/70 shadow-sky-100'
                        : 'border-slate-200 bg-slate-50/40 hover:border-sky-400 hover:bg-sky-50/80'
                    }`}
                >
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Starter</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">49.000đ / tháng</p>
                    <p className="mt-2 text-[11px] text-slate-600">
                      {language === 'vi'
                        ? 'Tính lại lương thủ công, nhưng có cảm giác như đang dùng bản trả phí.'
                        : 'Manual recalculation with the emotional benefits of a paid plan.'}
                    </p>
                  </div>
                  <p className="mt-3 text-[11px] font-medium text-slate-500">
                    {language === 'vi' ? 'Phù hợp cho team nhỏ.' : 'Suitable for small teams.'}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedUpgradePlan('PRO')}
                  className={`group flex flex-col justify-between rounded-xl border px-4 py-4 text-left shadow-sm ring-1 transition 
                    ${
                      selectedUpgradePlan === 'PRO'
                        ? 'border-indigo-500 bg-indigo-50 ring-indigo-200 shadow-indigo-100'
                        : 'border-slate-200 bg-white hover:border-indigo-400 hover:ring-indigo-100'
                    }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-600">Pro · Recommended</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">199.000đ / tháng</p>
                    </div>
                    <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                      Most picked
                    </span>
                  </div>
                  <p className="mt-2 text-[11px] text-slate-600">
                    {language === 'vi'
                      ? 'Hiệu ứng AI, thanh tiến trình, và thông báo “tối ưu bảng lương bằng machine learning”.'
                      : 'AI loading effects, progress bars and “optimizing payroll with machine learning” banners.'}
                  </p>
                  <p className="mt-3 text-[11px] font-medium text-slate-500">
                    {language === 'vi' ? 'Phù hợp cho chi nhánh đang mở rộng.' : 'Ideal for growing branches.'}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedUpgradePlan('ULTRA')}
                  className={`group flex flex-col justify-between rounded-xl border px-4 py-4 text-left shadow-sm transition 
                    ${
                      selectedUpgradePlan === 'ULTRA'
                        ? 'border-amber-500 bg-amber-50 shadow-amber-100'
                        : 'border-slate-200 bg-slate-50/60 hover:border-amber-400 hover:bg-amber-50/80'
                    }`}
                >
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-600">Ultra</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">999.000đ / tháng</p>
                    <p className="mt-2 text-[11px] text-slate-600">
                      {language === 'vi'
                        ? 'Dashboard riêng cho sếp xem, có biểu đồ lung linh để hỏi: “Nâng gói này bao giờ?”.'
                        : 'Dedicated C-level dashboard with shiny charts asking: “When do we upgrade this plan?”.'}
                    </p>
                  </div>
                  <p className="mt-3 text-[11px] font-medium text-slate-500">
                    {language === 'vi' ? 'Phù hợp cho công ty thích sang.' : 'Perfect for “premium-feel” companies.'}
                  </p>
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/80 px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
              <div className="flex-1" />
              <div className="flex items-center gap-2 justify-end">
                <button
                  onClick={() => setShowUpgradeModal(false)}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
                >
                  {language === 'vi' ? 'Để sau' : 'Maybe later'}
                </button>
                <button
                  onClick={handleUpgradePayment}
                  disabled={isProcessingPayment}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isProcessingPayment && (
                    <span className="inline-flex h-3 w-3 animate-spin rounded-full border-2 border-emerald-200 border-t-transparent" />
                  )}
                  <span>
                    {isProcessingPayment
                      ? (language === 'vi' ? 'Đang xác thực thanh toán...' : 'Verifying payment...')
                      : (language === 'vi' ? 'Thanh toán & tính lại lương' : 'Pay & Recalculate')}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payroll Detail Modal */}
      {selectedPayrollDetail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] min-h-0 overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-white">{selectedPayrollDetail.employee.name}</h3>
                <p className="text-sm text-blue-100">{text.payrollDetail.replace('{month}', formatPayrollCycleLabel(selectedMonth))}</p>
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

            {/* Modal Content: mobile cuộn cả khối; lg+ giới hạn chiều cao, chỉ vùng chi tiết ca cuộn (cột trái cố định trong viewport) */}
            <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden p-6 flex flex-col">
              {detailLoading ? (
                <div className="text-center py-12">
                  <p className="text-slate-400">{text.loading}</p>
                </div>
              ) : (
                <div className="flex flex-col gap-6 lg:flex-1 lg:min-h-0 lg:flex-row lg:overflow-hidden lg:gap-6">
                  {/* LEFT COLUMN - Summary & Breakdown */}
                  <div className="space-y-6 lg:w-1/2 lg:shrink-0 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
                    {(() => {
                      const { regularHours: regH, otHours: shiftOtH } = calculateRegularAndOTHoursWithNoLunchBreak(
                        shiftDetails,
                        workHoursPerDay,
                        detailNoLunchDates
                      );
                      const totalWorkedHours = calculateTotalWorkedHoursWithNoLunchBreak(
                        shiftDetails,
                        workHoursPerDay,
                        detailNoLunchDates
                      );
                      const totalActualHours = regH;

                      const dailyRate = selectedPayrollDetail.payroll.baseSalary / selectedPayrollDetail.payroll.standardWorkDays;
                      const hourlyRate = dailyRate / workHoursPerDay;
                      const basicSalary = hourlyRate * regH;
                      const shiftOtPay = hourlyRate * 1.5 * shiftOtH;

                      const totalIncome =
                        basicSalary +
                        shiftOtPay +
                        selectedPayrollDetail.payroll.allowance +
                        selectedPayrollDetail.payroll.bonus;
                      const calculatedNetSalary = Math.round(totalIncome - selectedPayrollDetail.payroll.deductions);
                      
                      return (
                        <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-blue-50 rounded-xl p-4">
                        <p className="text-xs font-bold text-blue-600 mb-1">{text.baseSalary}</p>
                        <p className="text-lg font-bold text-blue-700">{formatCurrency(selectedPayrollDetail.payroll.baseSalary)}</p>
                      </div>
                      <div className="bg-green-50 rounded-xl p-4">
                        <p className="text-xs font-bold text-green-600 mb-1">{text.workDays}</p>
                        <p className="text-lg font-bold text-green-700">{totalWorkedHours.toFixed(1)}h</p>
                        <p className="text-xs text-green-600">
                          {(totalWorkedHours / workHoursPerDay).toFixed(2)} {language === 'vi' ? 'công (gồm OT)' : 'days (incl. OT)'}
                        </p>
                      </div>
                      <div className="bg-purple-50 rounded-xl p-4">
                        <p className="text-xs font-bold text-purple-600 mb-1">{language === 'vi' ? 'Giờ OT (theo ca)' : 'OT hrs (shifts)'}</p>
                        <p className="text-lg font-bold text-purple-700">{shiftOtH.toFixed(1)}h</p>
                        <p className="text-xs text-purple-600">+{formatCurrency(Math.round(shiftOtPay))}</p>
                      </div>
                      <div className="bg-orange-50 rounded-xl p-4">
                        <p className="text-xs font-bold text-orange-600 mb-1">{text.netSalary}</p>
                        <p className="text-lg font-bold text-orange-700">{formatCurrency(calculatedNetSalary)}</p>
                      </div>
                    </div>

                    {/* Salary Breakdown */}
                    <div className="bg-slate-50 rounded-xl p-6 space-y-3">
                      <h4 className="text-sm font-bold text-slate-700 mb-4">{text.salaryBreakdown}</h4>
                      
                            <div className="flex justify-between items-center py-2 border-b border-slate-200">
                              <span className="text-sm text-slate-600">{text.workShiftSalary}</span>
                              <span className="text-sm font-bold text-slate-800">
                                {formatCurrency(Math.round(basicSalary))}
                              </span>
                            </div>
                            
                            <div className="flex justify-between items-center py-2 border-b border-slate-200">
                              <span className="text-sm text-slate-600">
                                {language === 'vi'
                                  ? `Tính từ ${shiftDetails.length} ca: ${regH.toFixed(1)}h thường + ${shiftOtH.toFixed(1)}h OT = ${totalWorkedHours.toFixed(1)}h`
                                  : `From ${shiftDetails.length} shifts: ${regH.toFixed(1)}h reg + ${shiftOtH.toFixed(1)}h OT = ${totalWorkedHours.toFixed(1)}h`}
                              </span>
                              <span className="text-xs text-slate-500">
                                = {formatCurrency(Math.round(hourlyRate))}/{language === 'vi' ? 'giờ' : 'hour'}
                              </span>
                            </div>

                    {shiftOtH > 0 && (
                      <>
                        <div className="flex justify-between items-center py-2 border-b border-slate-200">
                          <span className="text-sm text-slate-600">{text.overtimeSalary.replace('{hours}', shiftOtH.toFixed(1))}</span>
                          <span className="text-sm font-bold text-green-600">+{formatCurrency(Math.round(shiftOtPay))}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-slate-200">
                          <span className="text-sm text-slate-600">
                            {language === 'vi'
                              ? `Công thức: (LCB / ${selectedPayrollDetail.payroll.standardWorkDays} / ${workHoursPerDay}) × 1.5 × ${shiftOtH.toFixed(1)}`
                              : `Formula: (Base / ${selectedPayrollDetail.payroll.standardWorkDays} / ${workHoursPerDay}) × 1.5 × ${shiftOtH.toFixed(1)}`}
                          </span>
                          <span className="text-xs text-slate-500">
                            = {formatCurrency(selectedPayrollDetail.payroll.baseSalary / selectedPayrollDetail.payroll.standardWorkDays / workHoursPerDay)} × 1.5 × {shiftOtH.toFixed(1)}
                          </span>
                        </div>
                      </>
                    )}

                    {selectedPayrollDetail.payroll.allowance > 0 && (
                      <div className="flex justify-between items-center py-2 border-b border-slate-200">
                        <span className="text-sm text-slate-600">{text.allowance}</span>
                        <span className="text-sm font-bold text-green-600">+{formatCurrency(selectedPayrollDetail.payroll.allowance)}</span>
                      </div>
                    )}

                    {selectedPayrollDetail.payroll.bonus > 0 && (
                      <div className="flex justify-between items-center py-2 border-b border-slate-200">
                        <span className="text-sm text-slate-600">{text.bonus}</span>
                        <span className="text-sm font-bold text-green-600">+{formatCurrency(selectedPayrollDetail.payroll.bonus)}</span>
                      </div>
                    )}

                    {selectedPayrollDetail.payroll.deductions > 0 && (
                      <div className="flex justify-between items-center py-2 border-b border-slate-200">
                        <span className="text-sm text-slate-600">{language === 'vi' ? 'Khấu trừ (BHXH, v.v.)' : 'Deductions (Social Insurance, etc.)'}</span>
                        <span className="text-sm font-bold text-red-600">-{formatCurrency(selectedPayrollDetail.payroll.deductions)}</span>
                      </div>
                    )}

                    <div className="flex justify-between items-center py-3 bg-blue-50 rounded-lg px-4 mt-4">
                      <span className="text-base font-bold text-blue-700">{language === 'vi' ? 'Tổng thực nhận' : 'Total Net Salary'}</span>
                      <span className="text-xl font-bold text-blue-700">{formatCurrency(calculatedNetSalary)}</span>
                    </div>
                  </div>
                        </>
                      );
                    })()}
                </div>

                {/* RIGHT COLUMN - Shift Details */}
                <div className="min-h-0 flex flex-col lg:w-1/2 lg:flex-1 lg:overflow-hidden">
                  {shiftDetails.length > 0 && (
                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col flex-1 min-h-0 lg:min-h-0 lg:max-h-full">
                      <div className="shrink-0 bg-slate-50 px-6 py-3 border-b border-slate-200">
                        <h4 className="text-sm font-bold text-slate-700">
                          {text.shiftDetails} ({calculateTotalWorkedHoursWithNoLunchBreak(shiftDetails, workHoursPerDay, detailNoLunchDates).toFixed(1)}h)
                        </h4>
                        {(() => {
                          // Đếm số ngày có OT
                          let otDaysCount = 0;
                          shiftDetails.forEach(shift => {
                            if (shift.shift === 'CUSTOM' && shift.startTime && shift.endTime) {
                              const [startHour, startMin] = shift.startTime.split(':').map(Number);
                              const [endHour, endMin] = shift.endTime.split(':').map(Number);
                              let hours = ((endHour * 60 + endMin) - (startHour * 60 + startMin)) / 60;
                              if (hours >= 6 && !detailNoLunchDates.has(shift.date)) {
                                hours = hours - 1;
                              }
                              if (hours > workHoursPerDay) {
                                otDaysCount++;
                              }
                            }
                          });
                          
                          if (otDaysCount > 0) {
                            return (
                              <p className="text-xs text-purple-600 mt-1">
                                {otDaysCount} ngày có OT
                              </p>
                            );
                          }
                          return null;
                        })()}
                      </div>
                      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-bold text-slate-600 w-1/2 border-r border-slate-200">{language === 'vi' ? 'Ngày / Ca / Loại' : 'Date / Shift / Type'}</th>
                              <th className="px-4 py-2 text-right text-xs font-bold text-slate-600 w-1/2">{language === 'vi' ? 'Giờ / Tiền' : 'Hours / Amount'}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {(() => {
                              // Tính tổng tiền từ actualWorkDays (đã được tính chính xác từ backend)
                              const dailyRate = selectedPayrollDetail.payroll.baseSalary / selectedPayrollDetail.payroll.standardWorkDays;
                              const hourlyRate = dailyRate / workHoursPerDay;
                              
                              // Tính tổng giờ thực tế từ các ca làm việc
                              let totalActualHours = 0;
                              let totalOTHours = 0;
                              let totalOTMoney = 0;
                              
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
                                  let isCustomShift = false;
                                  let otHours = 0;
                                  let otMoney = 0;

                                  if (shift.shift === 'CUSTOM' && shift.startTime && shift.endTime) {
                                    isCustomShift = true;
                                    shiftLabel = `${shift.startTime} - ${shift.endTime}`;
                                    const [startHour, startMin] = shift.startTime.split(':').map(Number);
                                    const [endHour, endMin] = shift.endTime.split(':').map(Number);
                                    hours = ((endHour * 60 + endMin) - (startHour * 60 + startMin)) / 60;
                                    // Tự động trừ 1 giờ nghỉ trưa nếu ca >= 6 giờ VÀ không được đánh dấu "không nghỉ trưa"
                                    if (hours >= 6 && !detailNoLunchDates.has(shift.date)) {
                                      hours = hours - 1;
                                    }
                                    
                                    // Tính giờ thường và giờ OT
                                    const regularHours = Math.min(hours, workHoursPerDay);
                                    money = hourlyRate * regularHours;
                                    
                                    // Nếu làm việc vượt quá workHoursPerDay thì tính OT
                                    if (hours > workHoursPerDay) {
                                      otHours = hours - workHoursPerDay;
                                      const otHourlyRate = hourlyRate * 1.5; // OT rate x1.5
                                      otMoney = otHourlyRate * otHours;
                                    }
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
                                      typeLabel = text.offNoSalary;
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

                              // Cộng dồn giờ làm việc thực tế (chỉ tính giờ có lương)
                                  if (hours > 0) {
                                    totalActualHours += Math.min(hours, workHoursPerDay);
                                  }
                                  
                                  // Cộng dồn OT
                                  if (otHours > 0) {
                                    totalOTHours += otHours;
                                    totalOTMoney += otMoney;
                                  }

                                  return (
                                    <tr key={idx} className="hover:bg-slate-50">
                                      <td className="px-4 py-3 border-r border-slate-100">
                                        <div className="space-y-1">
                                          <div className="flex items-center gap-2">
                                            <p className="text-sm font-bold text-slate-700">{dateStr}</p>
                                            {otHours > 0 && (
                                              <span className="inline-block text-xs font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-700">
                                                OT
                                              </span>
                                            )}
                                          </div>
                                          <p className="text-xs text-slate-600">{shiftLabel}</p>
                                          <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded ${typeColor}`}>
                                            {typeLabel}
                                          </span>
                                          {isCustomShift && hours >= 5 && (
                                            <div className="mt-2">
                                              <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                  type="checkbox"
                                                  checked={detailNoLunchDates.has(shift.date)}
                                                  onChange={() => void toggleNoLunchBreak(shift.date)}
                                                  className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                                                />
                                                <span className="text-xs text-slate-600">{language === 'vi' ? 'Không nghỉ trưa' : 'No lunch break'}</span>
                                              </label>
                                            </div>
                                          )}
                                          
                                          {/* Note Section */}
                                          <div className="mt-2 pt-2 border-t border-slate-200">
                                            {editingNoteShiftId === shift.id ? (
                                              <div className="space-y-2">
                                                <textarea
                                                  value={noteInputValue}
                                                  onChange={(e) => setNoteInputValue(e.target.value)}
                                                  placeholder="Nhập ghi chú..."
                                                  className="w-full text-xs border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                  rows={2}
                                                />
                                                <div className="flex gap-2">
                                                  <button
                                                    onClick={() => handleSaveNote(shift.id)}
                                                    className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                                                  >
                                                    Lưu
                                                  </button>
                                                  <button
                                                    onClick={handleCancelEditNote}
                                                    className="text-xs px-2 py-1 bg-slate-200 text-slate-700 rounded hover:bg-slate-300 transition-colors"
                                                  >
                                                    Hủy
                                                  </button>
                                                </div>
                                              </div>
                                            ) : (
                                              <div className="space-y-1">
                                                {shift.note ? (
                                                  <div className="bg-amber-50 border border-amber-200 rounded px-2 py-1">
                                                    <p className="text-xs text-amber-800">{shift.note}</p>
                                                  </div>
                                                ) : (
                                                  <p className="text-xs text-slate-400 italic">{text.noNote}</p>
                                                )}
                                                <button
                                                  onClick={() => handleEditNote(shift)}
                                                  className="text-xs text-blue-600 hover:text-blue-700 hover:underline"
                                                >
                                                  {shift.note ? 'Sửa ghi chú' : 'Thêm ghi chú'}
                                                </button>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </td>
                                      <td className="px-4 py-3 text-right">
                                        <div className="space-y-1">
                                          <p className="text-sm font-bold text-slate-800">
                                            {hours > 0 ? `${hours.toFixed(1)}h` : '-'}
                                          </p>
                                          <p className="text-base font-bold text-blue-600">
                                            {money + otMoney > 0
                                              ? formatCurrency(Math.round(money + otMoney))
                                              : '-'}
                                          </p>
                                          {otHours > 0 && (
                                            <>
                                              <p className="text-xs text-slate-500">
                                                {language === 'vi'
                                                  ? `${Math.min(hours, workHoursPerDay).toFixed(1)}h thường + ${otHours.toFixed(1)}h OT`
                                                  : `${Math.min(hours, workHoursPerDay).toFixed(1)}h reg + ${otHours.toFixed(1)}h OT`}
                                              </p>
                                              <p className="text-xs font-bold text-purple-600">
                                                OT ×1.5: +{formatCurrency(Math.round(otMoney))}
                                              </p>
                                            </>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                });

                              const totalWorkedInTable = totalActualHours + totalOTHours;
                              const totalMoneyFromHours = Math.round(hourlyRate * totalActualHours + totalOTMoney);
                              
                              rows.push(
                                <tr key="total" className="bg-gradient-to-r from-blue-50 to-blue-100 font-bold border-t-2 border-blue-200">
                                  <td className="px-4 py-3 border-r border-blue-200">
                                    <div className="space-y-1">
                                      <p className="text-sm text-blue-700">{language === 'vi' ? 'Tổng cộng' : 'Total'}</p>
                                      <p className="text-xs text-blue-600">
                                        {(totalWorkedInTable / workHoursPerDay).toFixed(2)}{' '}
                                        {language === 'vi' ? 'công' : 'days'}
                                      </p>
                                      {totalOTHours > 0 && (
                                        <p className="text-xs text-purple-600">
                                          {totalActualHours.toFixed(1)}h {language === 'vi' ? 'thường' : 'reg'} + {totalOTHours.toFixed(1)}h OT
                                        </p>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    <div className="space-y-1">
                                      <p className="text-sm text-blue-700">{totalWorkedInTable.toFixed(1)}h</p>
                                      <p className="text-lg text-blue-700">
                                        {formatCurrency(totalMoneyFromHours)}
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
                    {text.markAsPaid}
                  </button>
                ) : (
                  <button
                    onClick={() => handleUpdatePayrollStatus('PENDING')}
                    className="px-4 py-2 bg-orange-600 text-white rounded-xl text-sm font-bold hover:bg-orange-700 transition-colors flex items-center gap-2"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {text.markAsPending}
                  </button>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setSelectedPayrollDetail(null)}
                  className="px-4 py-2 bg-slate-200 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-300 transition-colors"
                >
                  {text.close}
                </button>
                {setView && (
                  <button
                    onClick={() => {
                      setSelectedPayrollDetail(null);
                      setView('employee-profile', { employeeId: selectedPayrollDetail.employee.id });
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors"
                  >
                    {text.viewProfile}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm"
          >
            {getMonthOptions().map(month => (
              <option key={month} value={month}>
                {text.month} {formatPayrollCycleLabel(month)}
              </option>
            ))}
          </select>
          <select
            value={filterBranch}
            onChange={(e) => setFilterBranch(e.target.value)}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm"
          >
            <option value="ALL">{text.allBranches}</option>
            {branches.map(branch => (
              <option key={branch.id} value={branch.id}>{branch.name} ({branch.code})</option>
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
          <p className="text-slate-400 font-medium">{text.loading}</p>
        </div>
      ) : payrollRecords.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-sky-50">
          <p className="text-slate-400 font-medium">{text.noData}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-sky-50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">{text.employee}</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">{text.baseSalary}</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">{language === 'vi' ? 'Giờ làm việc' : 'Work Hours'}</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">{text.workDays}</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">{text.overtime}</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">{language === 'vi' ? 'Tổng lương (trước BHXH)' : 'Total (Before Deductions)'}</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">{text.deduction}</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">{text.netSalary}</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">{language === 'vi' ? 'Trạng thái' : 'Status'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payrollRecords.map((item: PayrollRecord) => {
                  const employee = employees.find(e => e.id === item.userId);
                  
                  // Ẩn nhân viên đã nghỉ việc
                  if (!employee || employee.status !== 'ACTIVE') {
                    return null;
                  }
                  
                  // Lọc theo chi nhánh
                  if (filterBranch !== 'ALL' && employee.branchId !== filterBranch) {
                    return null;
                  }
                  
                  // Tính tổng giờ thực tế từ shifts của nhân viên này
                  const userShifts = allShiftsInMonth.filter(s => s.userId === item.userId);
                  const rowNoLunchDates = new Set(noLunchBreakByKey[payrollNoLunchKey(selectedMonth, item.userId)] ?? []);
                  const { regularHours: regH, otHours: shiftOtH } = calculateRegularAndOTHoursWithNoLunchBreak(
                    userShifts,
                    workHoursPerDay,
                    rowNoLunchDates
                  );
                  const totalWorkedHours = regH + shiftOtH;

                  const dailyRate = item.baseSalary / item.standardWorkDays;
                  const hourlyRate = dailyRate / workHoursPerDay;
                  const basicSalary = hourlyRate * regH;
                  const shiftOtPay = hourlyRate * 1.5 * shiftOtH;
                  const totalIncome = basicSalary + shiftOtPay + item.allowance + item.bonus;
                  
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
                        <p className="text-sm text-slate-700">{totalWorkedHours.toFixed(1)}h</p>
                        <p className="text-xs text-slate-500">
                          ({(totalWorkedHours / workHoursPerDay).toFixed(2)} {language === 'vi' ? 'công' : 'days'})
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-slate-700">{item.actualWorkDays.toFixed(2)}/{item.standardWorkDays}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-slate-700">{shiftOtH.toFixed(1)}h</p>
                        {shiftOtPay > 0 && (
                          <p className="text-xs text-green-600">+{formatCurrency(Math.round(shiftOtPay))}</p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold text-slate-700">
                          {formatCurrency(Math.round(totalIncome))}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-red-600">-{formatCurrency(item.deductions)}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold text-blue-600">
                          {formatCurrency(Math.round(totalIncome - item.deductions))}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-xs font-bold px-2 py-1 rounded-lg ${
                          item.status === 'PAID' ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'
                        }`}>
                          {item.status === 'PAID' ? text.paid : text.pending}
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
