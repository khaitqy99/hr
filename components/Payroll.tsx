import React, { useState, useEffect } from 'react';
import { User, PayrollRecord } from '../types';
import { getPayroll, calculateAttendanceStats, calculateLeaveDays, getShiftRegistrations } from '../services/db';

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
    attendanceDays: number;
    leaveDays: number;
    shiftDays: number;
    otHours: number;
  } | null>(null);

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

        // Load data for selected month
        const records = await getPayroll(user.id, selectedMonth);
        if (records.length > 0) {
          setData(records[0]);
          
          // Load chi tiết tính lương
          try {
            const [attendanceStats, leaveDays, shifts] = await Promise.all([
              calculateAttendanceStats(user.id, selectedMonth),
              calculateLeaveDays(user.id, selectedMonth),
              getShiftRegistrations(user.id)
            ]);
            
            // Tính số ngày làm việc từ shift registrations trong tháng
            const [monthStr, yearStr] = selectedMonth.split('-');
            const targetMonth = parseInt(monthStr);
            const targetYear = parseInt(yearStr);
            const monthStart = new Date(targetYear, targetMonth - 1, 1).getTime();
            const monthEnd = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999).getTime();
            
            const shiftDays = new Set<string>();
            shifts
              .filter(shift => {
                const shiftDate = new Date(shift.date);
                return shift.status === 'APPROVED' &&
                       shift.date >= monthStart &&
                       shift.date <= monthEnd &&
                       shift.shift !== 'OFF';
              })
              .forEach(shift => {
                const date = new Date(shift.date);
                const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                shiftDays.add(dateKey);
              });
            
            setPayrollDetails({
              attendanceDays: attendanceStats.actualWorkDays,
              leaveDays,
              shiftDays: shiftDays.size,
              otHours: attendanceStats.otHours,
            });
          } catch (err) {
            console.error('Error loading payroll details:', err);
            setPayrollDetails(null);
          }
        } else {
          setData(null);
          setPayrollDetails(null);
        }
      } catch (error) {
        console.error('Error loading payroll:', error);
        setData(null);
        setPayrollDetails(null);
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

  // Tính toán lại để đảm bảo chính xác: basicSalary + overtimePay + allowance + bonus - deductions
  const basicSalary = (data.baseSalary / 27) * data.actualWorkDays;
  const totalIncome = basicSalary + data.otPay + data.allowance + data.bonus;
  const calculatedNetSalary = totalIncome - data.deductions;
  
  // Sử dụng giá trị đã tính lại nếu có sự khác biệt (fix lỗi tính toán)
  const displayNetSalary = Math.abs(calculatedNetSalary - data.netSalary) > 100 ? calculatedNetSalary : data.netSalary;

  const chartData = [
    { name: 'Lương cơ bản', value: basicSalary, color: '#3b82f6' },
    { name: 'OT & Thưởng', value: data.otPay + data.bonus + data.allowance, color: '#06b6d4' },
    { name: 'Khấu trừ', value: data.deductions, color: '#ef4444' },
  ];

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

      {/* Summary */}
      <div className="grid grid-cols-5 gap-4">
         <div className="col-span-5 bg-white rounded-3xl p-4 shadow-sm border border-sky-50 flex flex-col justify-center space-y-2">
            {chartData.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 rounded-full" style={{backgroundColor: item.color}}></div>
                        <span className="text-xs text-slate-500 font-medium">{item.name}</span>
                    </div>
                    <span className="text-xs font-bold text-slate-800">{(item.value / totalIncome * 100).toFixed(0)}%</span>
                </div>
            ))}
         </div>
      </div>

      {/* Payroll Calculation Details */}
      {payrollDetails && (
        <div className="bg-white rounded-3xl shadow-sm border border-sky-50 overflow-hidden">
          <div className="p-4 border-b border-slate-50 bg-slate-50/50">
            <h3 className="text-sm font-bold text-slate-700">Chi tiết tính lương</h3>
            <p className="text-xs text-slate-500 mt-1">Nguồn dữ liệu tính lương</p>
          </div>
          <div className="divide-y divide-slate-50">
            <div className="p-4 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium">Ngày công từ chấm công</p>
                  {setView && (
                    <button
                      onClick={() => setView('dashboard')}
                      className="text-[10px] text-blue-600 hover:underline"
                    >
                      Xem chi tiết →
                    </button>
                  )}
                </div>
              </div>
              <p className="text-sm font-bold text-slate-800">{payrollDetails.attendanceDays} ngày</p>
            </div>
            <div className="p-4 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium">Ngày nghỉ từ đơn nghỉ phép</p>
                </div>
              </div>
              <p className="text-sm font-bold text-red-600">-{payrollDetails.leaveDays} ngày</p>
            </div>
            <div className="p-4 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium">Ca làm việc đã đăng ký</p>
                  {setView && (
                    <button
                      onClick={() => setView('shifts')}
                      className="text-[10px] text-blue-600 hover:underline"
                    >
                      Xem chi tiết →
                    </button>
                  )}
                </div>
              </div>
              <p className="text-sm font-bold text-slate-800">{payrollDetails.shiftDays} ngày</p>
            </div>
            <div className="p-4 flex justify-between items-center bg-green-50/30">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-green-50 text-green-600 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-xs text-slate-500 font-medium">Giờ làm thêm (OT)</p>
              </div>
              <p className="text-sm font-bold text-green-600">+{payrollDetails.otHours}h</p>
            </div>
          </div>
        </div>
      )}

      {/* Detailed List */}
      <div className="bg-white rounded-3xl shadow-sm border border-sky-50 overflow-hidden">
          <div className="p-4 border-b border-slate-50 bg-slate-50/50">
              <h3 className="text-sm font-bold text-slate-700">Chi tiết lương</h3>
          </div>
          <div className="divide-y divide-slate-50">
              <div className="p-4 flex justify-between items-center">
                  <div>
                      <p className="text-xs text-slate-500 font-medium">Lương cơ bản</p>
                      <p className="text-[10px] text-slate-400">Ngày công chuẩn: {data.standardWorkDays}</p>
                  </div>
                  <div className="text-right">
                      <p className="text-sm font-bold text-slate-800">{formatCurrency(basicSalary)}</p>
                      <p className="text-[10px] text-blue-500 font-medium">Công thực tế: {data.actualWorkDays}/{data.standardWorkDays}</p>
                  </div>
              </div>
              <div className="p-4 flex justify-between items-center">
                  <div>
                      <p className="text-xs text-slate-500 font-medium">Làm thêm giờ (OT)</p>
                      <p className="text-[10px] text-slate-400">{data.otHours} giờ</p>
                  </div>
                  <p className="text-sm font-bold text-green-600">+{formatCurrency(data.otPay)}</p>
              </div>
              <div className="p-4 flex justify-between items-center">
                  <p className="text-xs text-slate-500 font-medium">Phụ cấp & Ăn trưa</p>
                  <p className="text-sm font-bold text-green-600">+{formatCurrency(data.allowance)}</p>
              </div>
              <div className="p-4 flex justify-between items-center">
                  <p className="text-xs text-slate-500 font-medium">Thưởng hiệu suất</p>
                  <p className="text-sm font-bold text-green-600">+{formatCurrency(data.bonus)}</p>
              </div>
              <div className="p-4 flex justify-between items-center bg-red-50/30">
                  <div>
                      <p className="text-xs text-slate-500 font-medium">Khấu trừ (BHXH/Thuế)</p>
                      <p className="text-[10px] text-slate-400">10.5% lương</p>
                  </div>
                  <p className="text-sm font-bold text-red-500">-{formatCurrency(data.deductions)}</p>
              </div>
              <div className="p-4 flex justify-between items-center bg-blue-50/30">
                  <p className="text-sm font-bold text-slate-800 uppercase">Tổng nhận</p>
                  <p className="text-lg font-extrabold text-blue-600">{formatCurrency(displayNetSalary)}</p>
              </div>
          </div>
      </div>
    </div>
  );
};

export default Payroll;