import React, { useState, useEffect, useRef } from 'react';
import { User, ShiftRegistration, ShiftTime, RequestStatus, OffType, OFF_TYPE_LABELS } from '../types';
import { registerShift, getShiftRegistrations } from '../services/db';
import CustomSelect from './CustomSelect';

interface ShiftRegisterProps {
  user: User;
}

// Ca CUSTOM bắt buộc 9 tiếng
const CUSTOM_SHIFT_HOURS = 9;

// Các mốc giờ cho dropdown (30 phút một mốc, từ 05:00 đến 23:30)
const TIME_OPTIONS: string[] = (() => {
  const opts: string[] = [];
  for (let h = 5; h <= 23; h++) {
    opts.push(`${String(h).padStart(2, '0')}:00`);
    if (h < 23) opts.push(`${String(h).padStart(2, '0')}:30`);
  }
  return opts;
})();

/** Giờ ra = giờ vào + 9 tiếng (cùng ngày, tối đa 23:59) */
function startTimePlus9Hours(startTime: string): string {
  const [h, m] = startTime.split(':').map(Number);
  let totalMinutes = h * 60 + m + CUSTOM_SHIFT_HOURS * 60;
  if (totalMinutes >= 24 * 60) totalMinutes = 23 * 60 + 59;
  const eh = Math.floor(totalMinutes / 60);
  const em = totalMinutes % 60;
  return `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
}

const ShiftRegister: React.FC<ShiftRegisterProps> = ({ user }) => {
  const [shifts, setShifts] = useState<ShiftRegistration[]>([]);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [dateShifts, setDateShifts] = useState<Record<string, ShiftTime | null>>({});
  const [dateCustomTimes, setDateCustomTimes] = useState<Record<string, { startTime: string; endTime: string }>>({});
  const [dateOffTypes, setDateOffTypes] = useState<Record<string, OffType>>({});
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAllShifts, setShowAllShifts] = useState(false);
  const weekDaysRef = useRef<HTMLDivElement>(null);
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  

  useEffect(() => {
    loadShifts();
  }, [user.id]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (expandedDate && weekDaysRef.current && !weekDaysRef.current.contains(event.target as Node)) {
        setExpandedDate(null);
      }
    };

    if (expandedDate) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [expandedDate]);

  const loadShifts = async () => {
    const allShifts = await getShiftRegistrations(user.id);
    // Sắp xếp theo ngày giảm dần (mới nhất trước)
    allShifts.sort((a, b) => b.date - a.date);
    setShifts([...allShifts]); // Tạo array mới để force re-render
  };

  // Chuyển Date sang YYYY-MM-DD theo giờ địa phương (tránh lùi 1 ngày khi dùng toISOString)
  const toLocalDateStr = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const getMonthDays = (): Date[] => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    
    // Lấy ngày đầu tuần (Thứ 2)
    const startDay = firstDay.getDay();
    const mondayOffset = startDay === 0 ? 6 : startDay - 1; // Chuyển Chủ nhật (0) thành 6
    
    const days: Date[] = [];
    
    // Thêm các ngày của tháng trước để làm đầy tuần đầu
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = mondayOffset - 1; i >= 0; i--) {
      const date = new Date(year, month - 1, prevMonthLastDay - i);
      days.push(date);
    }
    
    // Thêm tất cả các ngày trong tháng
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    
    // Thêm các ngày của tháng sau để làm đầy tuần cuối (tối đa 42 ngày = 6 tuần)
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      days.push(new Date(year, month + 1, i));
    }
    
    return days;
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(currentMonth.getMonth() + (direction === 'next' ? 1 : -1));
    setCurrentMonth(newMonth);
  };

  const toggleDate = (date: Date) => {
    // Không cho chọn ngày của tháng khác
    if (date.getMonth() !== currentMonth.getMonth()) {
      return;
    }

    const dateStr = toLocalDateStr(date);
    const registered = getRegisteredShift(date);

    // Click vào ngày đã đăng ký → mở/đóng popup chi tiết
    if (registered) {
      setExpandedDate(expandedDate === dateStr ? null : dateStr);
      return;
    }

    // Đang có popup mở mà bấm sang ngày khác (chưa xác nhận) → bỏ chọn ngày đó, chọn ngày mới và mở popup
    if (expandedDate !== null && dateStr !== expandedDate) {
      const wasAlreadySelected = selectedDates.includes(dateStr);
      setSelectedDates(prev => {
        const withoutExpanded = prev.filter(d => d !== expandedDate);
        const next = withoutExpanded.includes(dateStr) ? withoutExpanded : [...withoutExpanded, dateStr];
        return next.sort();
      });
      setDateShifts(prev => {
        const next = { ...prev };
        delete next[expandedDate];
        if (!wasAlreadySelected) next[dateStr] = ShiftTime.CUSTOM;
        return next;
      });
      setDateCustomTimes(prev => {
        const next = { ...prev };
        delete next[expandedDate];
        // Không tự động set giá trị mặc định để hiển thị placeholder
        return next;
      });
      setDateOffTypes(prev => {
        const next = { ...prev };
        delete next[expandedDate];
        return next;
      });
      setExpandedDate(dateStr);
      return;
    }

    if (selectedDates.includes(dateStr)) {
      if (expandedDate === dateStr) {
        // Bấm lại vào ngày đang mở popup → đóng popup và bỏ chọn ngày đó
        removeDate(dateStr);
      } else {
        setExpandedDate(dateStr);
      }
    } else {
      // Thêm vào danh sách: mặc định Ca làm (CUSTOM)
      setSelectedDates([...selectedDates, dateStr].sort());
      setDateShifts({ ...dateShifts, [dateStr]: ShiftTime.CUSTOM });
      // Không tự động set giá trị mặc định để hiển thị placeholder
      setExpandedDate(dateStr);
    }
  };

  const setDateAsOff = (dateStr: string, isOff: boolean) => {
    setDateShifts(prev => ({
      ...prev,
      [dateStr]: isOff ? ShiftTime.OFF : ShiftTime.CUSTOM
    }));
    if (isOff) {
      setDateCustomTimes(prev => {
        const next = { ...prev };
        delete next[dateStr];
        return next;
      });
      // Không set default off type để hiển thị placeholder
    } else {
      // Không tự động set giá trị mặc định cho giờ vào/ra để hiển thị placeholder
    }
  };

  const updateOffType = (dateStr: string, offType: OffType) => {
    setDateOffTypes({
      ...dateOffTypes,
      [dateStr]: offType
    });
  };

  const removeDate = (dateStr: string) => {
    setSelectedDates(selectedDates.filter(d => d !== dateStr));
    const newDateShifts = { ...dateShifts };
    delete newDateShifts[dateStr];
    setDateShifts(newDateShifts);
    const newCustomTimes = { ...dateCustomTimes };
    delete newCustomTimes[dateStr];
    setDateCustomTimes(newCustomTimes);
    const newOffTypes = { ...dateOffTypes };
    delete newOffTypes[dateStr];
    setDateOffTypes(newOffTypes);
    if (expandedDate === dateStr) {
      setExpandedDate(null);
    }
  };

  const getShiftForDate = (dateStr: string): ShiftTime | null => {
    return dateShifts[dateStr] || null;
  };

  const updateCustomTime = (dateStr: string, field: 'startTime' | 'endTime', value: string) => {
    const prev = dateCustomTimes[dateStr] || { startTime: '', endTime: '' };
    if (field === 'startTime') {
      setDateCustomTimes({
        ...dateCustomTimes,
        [dateStr]: { startTime: value, endTime: startTimePlus9Hours(value) }
      });
    } else {
      setDateCustomTimes({ ...dateCustomTimes, [dateStr]: { ...prev, [field]: value } });
    }
  };

  const getShiftTime = (dateStr: string): string => {
    if (dateShifts[dateStr] === ShiftTime.OFF) {
      const offType = dateOffTypes[dateStr];
      return offType && OFF_TYPE_LABELS[offType] ? OFF_TYPE_LABELS[offType] : '';
    }
    const st = dateCustomTimes[dateStr]?.startTime;
    if (st) return `${st}-${startTimePlus9Hours(st)} (9h)`;
    return '';
  };

  const isOffDate = (dateStr: string): boolean => dateShifts[dateStr] === ShiftTime.OFF;

  const allDatesHaveShifts = (): boolean => {
    return selectedDates.length > 0 && selectedDates.every(date => {
      const shift = dateShifts[date];
      if (shift === ShiftTime.OFF) return !!dateOffTypes[date];
      return !!(dateCustomTimes[date]?.startTime);
    });
  };

  const isDateSelected = (date: Date): boolean => {
    return selectedDates.includes(toLocalDateStr(date));
  };

  const getRegisteredShift = (date: Date): ShiftRegistration | null => {
    if (shifts.length === 0) return null;
    
    // Format date string từ local date (không dùng UTC)
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    return shifts.find(shift => {
      const shiftDate = new Date(shift.date);
      const shiftYear = shiftDate.getFullYear();
      const shiftMonth = String(shiftDate.getMonth() + 1).padStart(2, '0');
      const shiftDay = String(shiftDate.getDate()).padStart(2, '0');
      const shiftDateStr = `${shiftYear}-${shiftMonth}-${shiftDay}`;
      return shiftDateStr === dateStr;
    }) || null;
  };

  const isToday = (date: Date): boolean => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const getDayName = (date: Date): string => {
    const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    return days[date.getDay()];
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allDatesHaveShifts()) return;
    setLoading(true);

    const newShifts: ShiftRegistration[] = selectedDates.map((dateStr, index) => {
      const [year, month, day] = dateStr.split('-').map(Number);
      const dateObj = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
      const shiftType = dateShifts[dateStr];
      const customTime = dateCustomTimes[dateStr];
      const offType = dateOffTypes[dateStr];
      
      if (shiftType === ShiftTime.OFF) {
        return {
          id: `${Date.now()}-${index}`,
          userId: user.id,
          date: dateObj.getTime(),
          shift: ShiftTime.OFF,
          offType: offType || OffType.OFF_PN,
          status: RequestStatus.PENDING,
          createdAt: Date.now()
        };
      }
      if (!customTime?.startTime) return null;
      const endTime = startTimePlus9Hours(customTime.startTime);
      return {
        id: `${Date.now()}-${index}`,
        userId: user.id,
        date: dateObj.getTime(),
        shift: ShiftTime.CUSTOM,
        startTime: customTime.startTime,
        endTime,
        status: RequestStatus.PENDING,
        createdAt: Date.now()
      };
    }).filter((shift): shift is ShiftRegistration => shift !== null);

    try {
      const results: { success: boolean; shift: ShiftRegistration; error?: string }[] = [];
      
      // Đăng ký từng shift và track kết quả
      for (const shift of newShifts) {
        try {
          await registerShift(shift);
          results.push({ success: true, shift });
        } catch (error: any) {
          results.push({ 
            success: false, 
            shift, 
            error: error?.message || 'Không thể đăng ký ca' 
          });
        }
      }

      // Load lại shifts để cập nhật UI
      const updatedShifts = await getShiftRegistrations(user.id);
      updatedShifts.sort((a, b) => b.date - a.date);
      setShifts([...updatedShifts]);

      // Kiểm tra kết quả và hiển thị thông báo
      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;

      if (failCount > 0) {
        alert(`Đã đăng ký ${successCount}/${newShifts.length} ca thành công. ${failCount} ca thất bại.`);
      } else {
        // Reset form chỉ khi tất cả đều thành công
        setSelectedDates([]);
        setDateShifts({});
        setDateCustomTimes({});
        setDateOffTypes({});
        setExpandedDate(null);
      }
    } catch (error: any) {
      console.error('Error registering shifts:', error);
      alert('Lỗi khi đăng ký ca: ' + (error?.message || 'Vui lòng thử lại'));
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="space-y-6 fade-up">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-cyan-500 rounded-3xl p-6 text-white shadow-lg shadow-blue-200">
        <h2 className="text-xl font-bold">Đăng ký ca làm</h2>
      </div>

      {/* Registration Form */}
      <form onSubmit={handleRegister} className="bg-white p-5 rounded-3xl shadow-sm border border-sky-50 space-y-5">
        <div className="space-y-3">
            <div className="flex items-center justify-center">
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => navigateMonth('prev')}
                        className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-slate-500">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                        </svg>
                    </button>
                    <span className="text-xs font-bold text-slate-600 min-w-[140px] text-center">
                        {currentMonth.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })}
                    </span>
                    <button
                        type="button"
                        onClick={() => navigateMonth('next')}
                        className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-slate-500">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                        </svg>
                    </button>
                </div>
            </div>
            
            {/* Calendar Grid Header */}
            <div className="grid grid-cols-7 gap-1 mb-2">
                {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((day, idx) => (
                    <div key={idx} className="text-center text-[10px] font-bold text-slate-400 py-1">
                        {day}
                    </div>
                ))}
            </div>
            
            <div ref={weekDaysRef} className="grid grid-cols-7 gap-1 relative min-h-[300px]">
                {getMonthDays().map((date, index) => {
                    const selected = isDateSelected(date);
                    const today = isToday(date);
                    const dateStr = toLocalDateStr(date);
                    const shift = getShiftForDate(dateStr);
                    const registeredShift = getRegisteredShift(date);
                    const isExpanded = expandedDate === dateStr;
                    const isRegistered = registeredShift !== null;
                    
                    // Kiểm tra xem ngày có thuộc tháng hiện tại không
                    const isCurrentMonth = date.getMonth() === currentMonth.getMonth();
                    
                    // Điều chỉnh vị trí menu dựa trên vị trí trong grid
                    const getMenuPosition = () => {
                        const col = index % 7;
                        if (col <= 1) return 'left-0';
                        if (col >= 5) return 'right-0';
                        return 'left-1/2 -translate-x-1/2';
                    };
                    
                    return (
                        <div key={index} className="relative">
                            <button
                                type="button"
                                onClick={() => toggleDate(date)}
                                disabled={!isCurrentMonth}
                                className={`relative w-full flex flex-col items-center justify-center p-2 rounded-xl border-2 transition-all ${
                                    !isCurrentMonth
                                        ? 'opacity-30 cursor-not-allowed bg-slate-50 border-slate-100 text-slate-400'
                                        : isRegistered
                                        ? (registeredShift?.shift === ShiftTime.OFF ? 'bg-slate-100 border-slate-400 text-slate-600 shadow-sm cursor-pointer hover:bg-slate-200' : 'bg-green-50 border-green-500 text-green-700 shadow-sm cursor-pointer hover:bg-green-100')
                                        : selected
                                        ? isOffDate(dateStr)
                                            ? 'bg-slate-100 border-slate-400 text-slate-700 shadow-sm'
                                            : shift
                                            ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-sm'
                                            : 'bg-orange-50 border-orange-400 text-orange-700 shadow-sm'
                                        : today
                                        ? 'bg-cyan-50 border-cyan-300 text-cyan-700'
                                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                                }`}
                            >
                                <span className={`text-sm font-bold ${
                                    isRegistered 
                                        ? (registeredShift?.shift === ShiftTime.OFF ? 'text-slate-600' : 'text-green-700')
                                        : selected 
                                        ? isOffDate(dateStr)
                                            ? 'text-slate-700'
                                            : shift 
                                            ? 'text-blue-700' 
                                            : 'text-orange-700' 
                                        : ''
                                }`}>
                                    {date.getDate()}
                                </span>
                                {isRegistered && registeredShift && (
                                    <span className={`absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center shadow-sm ${
                                        registeredShift.shift === ShiftTime.OFF ? 'bg-slate-500' : 'bg-green-500'
                                    }`}>
                                        {registeredShift.shift === ShiftTime.OFF ? (
                                            <span className="text-[8px] font-bold text-white">O</span>
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12" fill="none" className="w-2.5 h-2.5">
                                                <path d="M10 3L4.5 8.5L2 6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                            </svg>
                                        )}
                                    </span>
                                )}
                            </button>
                            
                            {isExpanded && (
                                <div className={`absolute top-full ${getMenuPosition()} mt-2 z-50 bg-white rounded-2xl shadow-xl border-2 ${isRegistered ? 'border-slate-200' : 'border-blue-200'} p-3 w-[260px]`}>
                                    <div className="space-y-3">
                                        {isRegistered && registeredShift ? (
                                            /* Chi tiết ngày đã đăng ký */
                                            <>
                                                <p className="text-xs font-bold text-slate-500 uppercase">Chi tiết đã đăng ký</p>
                                                <div className="space-y-2 text-sm">
                                                    <p className="font-bold text-slate-800">
                                                        {registeredShift.shift === ShiftTime.OFF
                                                            ? (registeredShift.offType && OFF_TYPE_LABELS[registeredShift.offType] ? OFF_TYPE_LABELS[registeredShift.offType] : 'Ngày off')
                                                            : 'Ca làm việc'}
                                                    </p>
                                                    {registeredShift.shift === ShiftTime.CUSTOM && registeredShift.startTime && (
                                                        <p className="text-slate-600 text-xs">
                                                            {registeredShift.startTime} – {registeredShift.endTime || startTimePlus9Hours(registeredShift.startTime)} (9h)
                                                        </p>
                                                    )}
                                                    <p className="text-slate-500 text-xs">
                                                        {new Date(registeredShift.date).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                                                    </p>
                                                    <span className={`inline-block text-[10px] font-bold px-2 py-1 rounded-lg ${
                                                        registeredShift.status === RequestStatus.APPROVED ? 'bg-green-50 text-green-600' :
                                                        registeredShift.status === RequestStatus.REJECTED ? 'bg-red-50 text-red-600' :
                                                        'bg-orange-50 text-orange-600'
                                                    }`}>
                                                        {registeredShift.status === RequestStatus.APPROVED ? 'Đã duyệt' : registeredShift.status === RequestStatus.REJECTED ? 'Từ chối' : 'Chờ duyệt'}
                                                    </span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setExpandedDate(null)}
                                                    className="w-full py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition-all"
                                                >
                                                    Đóng
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                        {/* Chọn loại: Ca làm / Ngày off */}
                                        <div className="flex gap-1 p-1 rounded-xl bg-slate-100">
                                            <button
                                                type="button"
                                                onClick={() => setDateAsOff(dateStr, false)}
                                                className={`flex-1 px-2 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                                                    !isOffDate(dateStr)
                                                        ? 'bg-blue-600 text-white shadow-sm'
                                                        : 'text-slate-600 hover:bg-slate-200'
                                                }`}
                                            >
                                                Ca làm
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setDateAsOff(dateStr, true)}
                                                className={`flex-1 px-2 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                                                    isOffDate(dateStr)
                                                        ? 'bg-slate-600 text-white shadow-sm'
                                                        : 'text-slate-600 hover:bg-slate-200'
                                                }`}
                                            >
                                                Ngày off
                                            </button>
                                        </div>
                                        {isOffDate(dateStr) ? (
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold text-slate-600">Loại off:</label>
                                                <CustomSelect
                                                    options={Object.entries(OFF_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
                                                    value={dateOffTypes[dateStr] || ''}
                                                    onChange={(v) => updateOffType(dateStr, v as OffType)}
                                                    placeholder="Chọn loại off"
                                                />
                                            </div>
                                        ) : (
                                            <>
                                                <div className="flex items-center gap-2">
                                                    <label className="text-[10px] font-bold text-slate-600 w-16">Giờ vào:</label>
                                                    <div className="flex-1">
                                                        <CustomSelect
                                                            options={TIME_OPTIONS.map((t) => ({ value: t, label: t }))}
                                                            value={dateCustomTimes[dateStr]?.startTime || ''}
                                                            onChange={(v) => updateCustomTime(dateStr, 'startTime', v)}
                                                            placeholder="Chọn giờ vào"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <label className="text-[10px] font-bold text-slate-600 w-16">Giờ ra:</label>
                                                    <p className="text-sm font-medium text-slate-700 flex-1">
                                                        {dateCustomTimes[dateStr]?.startTime
                                                            ? `${startTimePlus9Hours(dateCustomTimes[dateStr].startTime)} (tự động, 9 tiếng)`
                                                            : '—'}
                                                    </p>
                                                </div>
                                            </>
                                        )}
                                        <div className="flex gap-2 pt-2 border-t border-slate-200">
                                            <button
                                                type="button"
                                                onClick={() => setExpandedDate(null)}
                                                className="flex-1 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-all"
                                            >
                                                Xác nhận
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => removeDate(dateStr)}
                                                className="px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-bold hover:bg-red-100 transition-all"
                                            >
                                                Bỏ chọn
                                            </button>
                                        </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
            
            {selectedDates.length > 0 && (
                <div className="mt-2 pt-3 border-t border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-2 ml-2">
                        Đã chọn {selectedDates.length} ngày {allDatesHaveShifts() ? '(sẵn sàng đăng ký)' : '(vui lòng chọn giờ cho ca làm)'}:
                    </p>
                    <div className="space-y-2">
                        {selectedDates.map((date) => {
                            const shift = getShiftForDate(date);
                            return (
                                <div
                                    key={date}
                                    className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold ${
                                        isOffDate(date) ? 'bg-slate-100 text-slate-700' : shift ? 'bg-blue-50 text-blue-700' : 'bg-orange-50 text-orange-700'
                                    }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <span>{new Date(date + 'T12:00:00').toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' })}</span>
                                        {getShiftTime(date) && (
                                            <span className="text-[10px] opacity-80">- {getShiftTime(date)}</span>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => removeDate(date)}
                                        className="text-current hover:opacity-70 font-bold text-base"
                                    >
                                        ×
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>

        <button 
            type="submit" 
            disabled={loading || !allDatesHaveShifts()}
            className="w-full bg-blue-600 text-white py-3.5 rounded-2xl font-bold hover:bg-blue-700 transition-all active:scale-[0.98] shadow-lg shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
            {loading 
                ? `Đang đăng ký ${selectedDates.length} ngày...` 
                : allDatesHaveShifts()
                    ? `Xác nhận đăng ký ${selectedDates.length} ngày (ca làm + off)`
                    : `Vui lòng chọn giờ cho các ngày ca làm`
            }
        </button>
      </form>

      {/* History List */}
      <div>
        <h3 className="text-sm font-bold text-slate-700 mb-3 ml-2">Lịch đã đăng ký</h3>
        <div className="space-y-3 pb-4">
            {shifts.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs font-medium">Chưa có ca làm hoặc ngày off nào được đăng ký.</div>
            ) : (
                <>
                    {(showAllShifts ? shifts : shifts.slice(0, 7)).map(shift => (
                        <div key={shift.id} className={`p-4 rounded-3xl shadow-sm border flex items-center justify-between ${
                            shift.shift === ShiftTime.OFF ? 'bg-slate-50 border-slate-200' : 'bg-white border-sky-50'
                        }`}>
                            <div className="flex items-center space-x-4">
                                <div className={`w-12 h-12 rounded-2xl flex flex-col items-center justify-center font-bold text-xs ${
                                    shift.shift === ShiftTime.OFF ? 'bg-slate-200 text-slate-600' : 'bg-cyan-50 text-cyan-600'
                                }`}>
                                    <span>{new Date(shift.date).getDate()}</span>
                                    <span className="text-[8px] uppercase">Th{new Date(shift.date).getMonth() + 1}</span>
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-slate-800">
                                        {shift.shift === ShiftTime.OFF 
                                            ? (shift.offType && OFF_TYPE_LABELS[shift.offType] ? OFF_TYPE_LABELS[shift.offType] : 'Ngày off')
                                            : 'Ca làm việc'
                                        }
                                    </p>
                                    <p className="text-[10px] text-slate-400 font-medium">
                                        {shift.shift === ShiftTime.OFF 
                                            ? 'Nghỉ'
                                            : shift.startTime && shift.endTime 
                                            ? `${shift.startTime} - ${shift.endTime}`
                                            : 'Chưa có giờ'}
                                    </p>
                                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                                        {new Date(shift.date).toLocaleDateString('vi-VN', {weekday: 'long', year: 'numeric'})}
                                    </p>
                                </div>
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-1 rounded-lg uppercase ${
                                shift.status === RequestStatus.APPROVED ? 'bg-green-50 text-green-600' :
                                shift.status === RequestStatus.REJECTED ? 'bg-red-50 text-red-600' :
                                'bg-orange-50 text-orange-600'
                            }`}>
                                {shift.status}
                            </span>
                        </div>
                    ))}
                    {shifts.length > 7 && (
                        <button
                            onClick={() => setShowAllShifts(!showAllShifts)}
                            className="w-full py-3 rounded-2xl bg-slate-50 hover:bg-slate-100 text-slate-600 text-sm font-bold transition-all border border-slate-200"
                        >
                            {showAllShifts ? 'Thu gọn' : `Xem thêm ${shifts.length - 7} ca làm`}
                        </button>
                    )}
                </>
            )}
        </div>
      </div>
    </div>
  );
};

export default ShiftRegister;