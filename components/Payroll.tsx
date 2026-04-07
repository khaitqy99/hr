import React, { useState, useEffect } from 'react';
import { User, PayrollRecord, ShiftRegistration, OffType } from '../types';
import { getPayroll, calculateLeaveDays, getShiftRegistrations, getConfigNumber } from '../services/db';

interface PayrollProps {
  user: User;
  setView?: (view: string) => void;
}

const Payroll: React.FC<PayrollProps> = ({ user, setView }) => {
  // Set default month to current month
  const getCurrentMonth = () => {
    const now = new Date();
    return `${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
  };

  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [data, setData] = useState<PayrollRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [payrollDetails, setPayrollDetails] = useState<{
    leaveDays: number;
    shiftDays: number;
  } | null>(null);
  const [showDetailDropdown, setShowDetailDropdown] = useState(false);
  const [shiftDetails, setShiftDetails] = useState<ShiftRegistration[]>([]);
  const [workHoursPerDay, setWorkHoursPerDay] = useState(8);

  // Generate month options (current month and 5 previous months)
  const generateMonthOptions = () => {
    const months: string[] = [];
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStr = `${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}`;
      months.push(monthStr);
    }
    return months;
  };

  useEffect(() => {
    const loadPayroll = async () => {
      setIsLoading(true);
      
      try {
        // Load all records to get available months
        const allRecords = await getPayroll(user.id);
        const months = [...new Set(allRecords.map(r => r.month))].sort((a, b) => {
          const [aMonth, aYear] = a.split('-').map(Number);
          const [bMonth, bYear] = b.split('-').map(Number);
          if (aYear !== bYear) return bYear - aYear;
          return bMonth - aMonth;
        });
        setAvailableMonths(months.length > 0 ? months : generateMonthOptions());

        // Load work hours config
        const hours = await getConfigNumber('work_hours_per_day', 8);
        setWorkHoursPerDay(hours);

        // Load data for selected month
        const records = await getPayroll(user.id, selectedMonth);
        if (records.length > 0) {
          setData(records[0]);
          
          // Load shift details immediately for calculation
          const shifts = await getShiftRegistrations(user.id);
          const [monthStr, yearStr] = selectedMonth.split('-');
          const targetMonth = parseInt(monthStr);
          const targetYear = parseInt(yearStr);
          
          const cycleStart = new Date(targetYear, targetMonth - 1, 2).getTime();
          const cycleEndExclusive = new Date(targetYear, targetMonth, 2).getTime();
          const monthShifts = shifts.filter(shift => shift.date >= cycleStart && shift.date < cycleEndExclusive);
          
          setShiftDetails(monthShifts);
          
          // Chi tiết tính lương: nghỉ phép + số ca đăng ký (ngày công lấy từ đăng ký ca)
          try {
            const leaveDays = await calculateLeaveDays(user.id, selectedMonth);
            const shiftDays = new Set<string>();
            shifts
              .filter(shift => shift.status === 'APPROVED' && shift.date >= cycleStart && shift.date < cycleEndExclusive && shift.shift !== 'OFF')
              .forEach(shift => {
                const date = new Date(shift.date);
                const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                shiftDays.add(dateKey);
              });
            setPayrollDetails({ leaveDays, shiftDays: shiftDays.size });
          } catch (err) {
            console.error('Error loading payroll details:', err);
            setPayrollDetails(null);
          }
        } else {
          setData(null);
          setPayrollDetails(null);
          setShiftDetails([]);
        }
      } catch (error) {
        console.error('Error loading payroll:', error);
        setData(null);
        setPayrollDetails(null);
        setShiftDetails([]);
      } finally {
        setIsLoading(false);
      }
    };
    loadPayroll();
  }, [user.id, selectedMonth]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  const formatMonthDisplay = (month: string) => {
    const [m, y] = month.split('-');
    return `Tháng ${m}/${y}`;
  };

  const handleToggleDetail = async () => {
    if (!data) return;
    setShowDetailDropdown(!showDetailDropdown);
  };

  // Loading: giữ layout, không thay toàn bộ nội dung bằng "Đang tải..."
  if (isLoading) {
    return (
      <div className="space-y-6 fade-up">
        <div className="flex justify-between items-center bg-white p-4 rounded-3xl shadow-sm border border-sky-50">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Bảng lương</h2>
            <p className="text-xs text-slate-400 font-medium">Chi tiết thu nhập</p>
          </div>
          <div className="h-10 w-24 rounded-xl bg-slate-100 animate-pulse" />
        </div>
        <div className="rounded-3xl bg-slate-100/80 p-8 flex flex-col items-center justify-center gap-3 min-h-[160px]">
          <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Đang tải dữ liệu lương...</p>
        </div>
      </div>
    );
  }

  // Show no data message
  if (!data) {
    return (
      <div className="space-y-6 fade-up">
        {/* Header Selector */}
        <div className="flex justify-between items-center bg-white p-4 rounded-3xl shadow-sm border border-sky-50">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Bảng lương</h2>
            <p className="text-xs text-slate-400 font-medium">Chi tiết thu nhập</p>
          </div>
          <select 
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-sky-50 text-blue-700 font-bold text-sm px-4 py-2 rounded-xl border-none outline-none focus:ring-2 focus:ring-blue-200"
          >
            {availableMonths.map(month => (
              <option key={month} value={month}>{formatMonthDisplay(month)}</option>
            ))}
          </select>
        </div>

        {/* No Data Message */}
        <div className="bg-white rounded-3xl shadow-sm border border-sky-50 p-12 text-center">
          <div className="text-6xl mb-4">💰</div>
          <h3 className="text-lg font-bold text-slate-700 mb-2">Chưa có dữ liệu lương</h3>
          <p className="text-sm text-slate-500">
            Chưa có bảng lương cho tháng {formatMonthDisplay(selectedMonth)}.
            <br />
            Vui lòng liên hệ bộ phận HR để được hỗ trợ.
          </p>
        </div>
      </div>
    );
  }

  // Tính tổng giờ thực tế từ shiftDetails
  let totalActualHours = 0;
  if (shiftDetails.length > 0) {
    shiftDetails.forEach(shift => {
      let hours = workHoursPerDay;
      if (shift.shift === 'CUSTOM' && shift.startTime && shift.endTime) {
        const [startHour, startMin] = shift.startTime.split(':').map(Number);
        const [endHour, endMin] = shift.endTime.split(':').map(Number);
        hours = ((endHour * 60 + endMin) - (startHour * 60 + startMin)) / 60;
        if (hours >= 6) hours = hours - 1;
      } else if (shift.shift === 'OFF' && shift.offType !== OffType.OFF_PN && shift.offType !== OffType.LE) {
        hours = 0;
      }
      if (hours > 0) totalActualHours += Math.min(hours, workHoursPerDay);
    });
  }
  
  // Tính toán lại để đảm bảo chính xác: basicSalary + overtimePay + allowance + bonus - deductions
  const dailyRate = data.baseSalary / data.standardWorkDays;
  const hourlyRate = dailyRate / workHoursPerDay;
  const basicSalary = totalActualHours > 0 ? hourlyRate * totalActualHours : dailyRate * data.actualWorkDays;
  const totalIncome = basicSalary + data.otPay + data.allowance + data.bonus;
  const calculatedNetSalary = totalIncome - data.deductions;
  
  // Sử dụng giá trị đã tính lại từ giờ thực tế
  const displayNetSalary = Math.round(calculatedNetSalary);

  return (
    <div className="space-y-6 fade-up">
      {/* Header Selector */}
      <div className="flex justify-between items-center bg-white p-4 rounded-3xl shadow-sm border border-sky-50">
        <div>
           <h2 className="text-lg font-bold text-slate-800">Bảng lương</h2>
           <p className="text-xs text-slate-400 font-medium">Chi tiết thu nhập</p>
        </div>
        <select 
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-sky-50 text-blue-700 font-bold text-sm px-4 py-2 rounded-xl border-none outline-none focus:ring-2 focus:ring-blue-200"
        >
            {availableMonths.map(month => (
              <option key={month} value={month}>{formatMonthDisplay(month)}</option>
            ))}
        </select>
      </div>

      {/* Net Salary Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-800 to-slate-900 p-6 text-white shadow-xl shadow-slate-200">
         <div className="relative z-10 text-center">
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-widest mb-2">Thực nhận {formatMonthDisplay(selectedMonth)}</p>
            <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-200 to-cyan-200">
                {formatCurrency(displayNetSalary)}
            </h1>
            <div className={`inline-block mt-3 px-3 py-1 rounded-full text-[10px] font-bold uppercase ${data.status === 'PAID' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-orange-500/20 text-orange-400 border border-orange-500/30'}`}>
                {data.status === 'PAID' ? 'Đã thanh toán' : 'Chờ thanh toán'}
            </div>
         </div>
         {/* Decoration */}
         <div className="absolute top-0 left-0 w-32 h-32 bg-blue-500 opacity-10 rounded-full blur-3xl -ml-10 -mt-10"></div>
         <div className="absolute bottom-0 right-0 w-32 h-32 bg-cyan-500 opacity-10 rounded-full blur-3xl -mr-10 -mb-10"></div>
      </div>



      {/* Payroll Calculation Details - Simplified */}
      {payrollDetails && (
        <div className="bg-white rounded-3xl shadow-sm border border-sky-50 overflow-hidden">
          <div className="p-4 border-b border-slate-50 bg-slate-50/50">
            <h3 className="text-sm font-bold text-slate-700">Thông tin công</h3>
          </div>
          <div className="divide-y divide-slate-50">
            <div className="p-4 flex justify-between items-center">
              <p className="text-xs text-slate-500 font-medium">Ngày công thực tế</p>
              <p className="text-sm font-bold text-slate-800">{Math.round(data.actualWorkDays * 2) / 2} ngày</p>
            </div>
            <div className="p-4 flex justify-between items-center">
              <p className="text-xs text-slate-500 font-medium">Giờ làm thêm (OT)</p>
              <p className="text-sm font-bold text-green-600">+{data.otHours}h</p>
            </div>
          </div>
        </div>
      )}

      {/* Detailed List */}
      <div className="bg-white rounded-3xl shadow-sm border border-sky-50 overflow-hidden">
          <div className="p-4 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-700">Chi tiết lương</h3>
              <button
                onClick={handleToggleDetail}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-all"
              >
                {showDetailDropdown ? 'Thu gọn' : 'Xem chi tiết ngày'}
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  strokeWidth={2} 
                  stroke="currentColor" 
                  className={`w-4 h-4 transition-transform ${showDetailDropdown ? 'rotate-180' : ''}`}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </button>
          </div>
          <div className="divide-y divide-slate-50">
              <div className="p-4 flex justify-between items-center">
                  <div>
                      <p className="text-xs text-slate-500 font-medium">Lương cơ bản</p>
                      <p className="text-[10px] text-slate-400">
                        {totalActualHours > 0 
                          ? `${totalActualHours.toFixed(1)}h (${(totalActualHours / workHoursPerDay).toFixed(2)} công)`
                          : `Công thực tế: ${data.actualWorkDays.toFixed(2)}/${data.standardWorkDays}`
                        }
                      </p>
                  </div>
                  <p className="text-sm font-bold text-slate-800">{formatCurrency(Math.round(basicSalary))}</p>
              </div>
              {data.otPay > 0 && (
                <div className="p-4 flex justify-between items-center">
                    <div>
                        <p className="text-xs text-slate-500 font-medium">Làm thêm giờ (OT)</p>
                        <p className="text-[10px] text-slate-400">{data.otHours} giờ</p>
                    </div>
                    <p className="text-sm font-bold text-green-600">+{formatCurrency(data.otPay)}</p>
                </div>
              )}
              {data.allowance > 0 && (
                <div className="p-4 flex justify-between items-center">
                    <p className="text-xs text-slate-500 font-medium">Phụ cấp & Ăn trưa</p>
                    <p className="text-sm font-bold text-green-600">+{formatCurrency(data.allowance)}</p>
                </div>
              )}
              {data.bonus > 0 && (
                <div className="p-4 flex justify-between items-center">
                    <p className="text-xs text-slate-500 font-medium">Thưởng hiệu suất</p>
                    <p className="text-sm font-bold text-green-600">+{formatCurrency(data.bonus)}</p>
                </div>
              )}
              {data.deductions > 0 && (
                <div className="p-4 flex justify-between items-center bg-red-50/30">
                    <p className="text-xs text-slate-500 font-medium">Khấu trừ (BHXH/Thuế)</p>
                    <p className="text-sm font-bold text-red-500">-{formatCurrency(data.deductions)}</p>
                </div>
              )}
              <div className="p-4 flex justify-between items-center bg-blue-50/30">
                  <p className="text-sm font-bold text-slate-800 uppercase">Tổng nhận</p>
                  <p className="text-lg font-extrabold text-blue-600">{formatCurrency(displayNetSalary)}</p>
              </div>
          </div>
      </div>

      {/* Chi tiết các ngày làm việc */}
      {showDetailDropdown && shiftDetails.length > 0 && (
        <div className="space-y-4 animate-fadeIn">
          <div className="bg-white rounded-3xl border border-sky-100 overflow-hidden shadow-sm">
              <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                {(() => {
                  // Tính tổng tiền từ actualWorkDays (đã được tính chính xác từ backend)
                  const dailyRate = data.baseSalary / data.standardWorkDays;
                  const totalMoney = dailyRate * data.actualWorkDays;
                  const hourlyRate = dailyRate / workHoursPerDay;
                  
                  // Tính tổng giờ thực tế từ các ca làm việc
                  let totalActualHours = 0;
                  
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
                        // Tự động trừ 1 giờ nghỉ trưa nếu ca >= 6 giờ
                        if (hours >= 6) {
                          hours = hours - 1;
                        }
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

                      // Cộng dồn giờ làm việc thực tế (chỉ tính giờ có lương)
                      if (hours > 0) {
                        totalActualHours += Math.min(hours, workHoursPerDay);
                      }

                      return (
                        <div key={idx} className="p-4 hover:bg-slate-50 transition-colors">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="text-sm font-bold text-slate-700">{dateStr}</p>
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${typeColor}`}>
                                  {typeLabel}
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 truncate">{shiftLabel}</p>
                              
                              {/* Display note if exists */}
                              {shift.note && (
                                <div className="mt-2 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                                  <p className="text-xs text-amber-800">
                                    <span className="font-bold">Ghi chú: </span>
                                    {shift.note}
                                  </p>
                                </div>
                              )}
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-sm font-bold text-slate-800">
                                {hours > 0 ? `${Math.min(hours, workHoursPerDay).toFixed(1)}h` : '-'}
                              </p>
                              <p className="text-base font-bold text-blue-600">
                                {money > 0 ? formatCurrency(Math.round(money)) : '-'}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    });

                  // Tính lại tổng tiền dựa trên tổng giờ thực tế
                  const totalMoneyFromHours = hourlyRate * totalActualHours;
                  
                  // Add total - sử dụng totalMoneyFromHours tính từ giờ thực tế
                  rows.push(
                    <div key="total" className="p-4 bg-gradient-to-r from-blue-50 to-cyan-50 border-t-2 border-blue-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold text-blue-700">Tổng cộng</p>
                          <p className="text-xs text-blue-600">{(totalActualHours / workHoursPerDay).toFixed(2)} công</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-blue-700">
                            {totalActualHours.toFixed(1)}h
                          </p>
                          <p className="text-lg font-bold text-blue-700">
                            {formatCurrency(Math.round(totalMoneyFromHours))}
                          </p>
                        </div>
                      </div>
                    </div>
                  );

                  return (
                    <>
                      <div className="bg-gradient-to-r from-slate-50 to-sky-50 px-4 py-3 border-b border-sky-100">
                        <h4 className="text-sm font-bold text-slate-700">
                          Chi tiết ca làm việc ({totalActualHours.toFixed(1)}h)
                        </h4>
                      </div>
                      {rows}
                    </>
                  );
                })()}
              </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default Payroll;