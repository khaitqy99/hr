import React, { useState, useEffect, useRef } from 'react';
import { User, ShiftRegistration, ShiftTime, RequestStatus, OffType, OFF_TYPE_LABELS, Holiday } from '../types';
import { registerShift, getShiftRegistrations, getHolidays, updateShiftRegistration } from '../services/db';
import { sendShiftChangeNotification } from '../services/email';
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

type BulkShiftDraft = {
  shift: ShiftTime;
  startTime: string;
  endTime: string;
  offType: OffType | '';
  reason: string;
};

const defaultBulkDraft = (): BulkShiftDraft => ({
  shift: ShiftTime.CUSTOM,
  startTime: '',
  endTime: '',
  offType: '',
  reason: '',
});

const ShiftRegister: React.FC<ShiftRegisterProps> = ({ user }) => {
  const [shifts, setShifts] = useState<ShiftRegistration[]>([]);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [bulkDraft, setBulkDraft] = useState<BulkShiftDraft>(() => defaultBulkDraft());
  const [dateShifts, setDateShifts] = useState<Record<string, ShiftTime | null>>({});
  const [dateCustomTimes, setDateCustomTimes] = useState<Record<string, { startTime: string; endTime: string }>>({});
  const [dateOffTypes, setDateOffTypes] = useState<Record<string, OffType>>({});
  const [dateReasons, setDateReasons] = useState<Record<string, string>>({});
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const weekDaysRef = useRef<HTMLDivElement>(null);
  const selectedDatesRef = useRef<string[]>([]);
  const bulkDraftRef = useRef<BulkShiftDraft>(defaultBulkDraft());
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  

  useEffect(() => {
    loadShifts();
    loadHolidays();
  }, [user.id]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      
      // Bỏ qua nếu click vào dropdown của CustomSelect (được render vào document.body)
      if (target instanceof Element) {
        const isCustomSelectDropdown = target.closest('[role="listbox"]') || target.closest('[role="option"]');
        if (isCustomSelectDropdown) {
          return;
        }
      }
      
      if (expandedDate && weekDaysRef.current && !weekDaysRef.current.contains(target)) {
        setExpandedDate(null);
        setEditingShiftId(null);
      }
    };

    if (expandedDate) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [expandedDate]);

  selectedDatesRef.current = selectedDates;
  bulkDraftRef.current = bulkDraft;

  const mergeBulkDraft = (prev: BulkShiftDraft, patch: Partial<BulkShiftDraft>): BulkShiftDraft => {
    const next = { ...prev, ...patch };
    if (patch.shift === ShiftTime.OFF) {
      next.startTime = '';
      next.endTime = '';
    } else if (patch.startTime !== undefined && next.shift === ShiftTime.CUSTOM) {
      next.endTime =
        patch.endTime !== undefined ? patch.endTime : startTimePlus9Hours(patch.startTime);
    }
    return next;
  };

  /** Ghi bulk draft xuống từng ngày (dùng cho đăng ký hàng loạt cùng khung giờ). */
  const flushBulkToDates = (draft: BulkShiftDraft, dates: string[]) => {
    if (dates.length === 0) return;
    setDateShifts(prev => {
      const next = { ...prev };
      for (const d of dates) next[d] = draft.shift;
      return next;
    });
    setDateCustomTimes(prev => {
      const next = { ...prev };
      for (const d of dates) {
        if (draft.shift === ShiftTime.OFF) delete next[d];
        else
          next[d] = {
            startTime: draft.startTime,
            endTime:
              draft.endTime ||
              (draft.startTime ? startTimePlus9Hours(draft.startTime) : ''),
          };
      }
      return next;
    });
    setDateOffTypes(prev => {
      const next = { ...prev };
      for (const d of dates) {
        if (draft.shift === ShiftTime.OFF) {
          if (draft.offType) next[d] = draft.offType;
        } else delete next[d];
      }
      return next;
    });
    setDateReasons(prev => {
      const next = { ...prev };
      for (const d of dates) next[d] = draft.reason;
      return next;
    });
  };

  const patchBulkDraft = (patch: Partial<BulkShiftDraft>) => {
    const next = mergeBulkDraft(bulkDraftRef.current, patch);
    bulkDraftRef.current = next;
    setBulkDraft(next);
    if (multiSelectMode && selectedDatesRef.current.length > 0) {
      flushBulkToDates(next, selectedDatesRef.current);
    }
  };

  const handleMultiModeChange = (enabled: boolean) => {
    setMultiSelectMode(enabled);
    setExpandedDate(null);
    if (!enabled) return;
    if (selectedDatesRef.current.length > 0) {
      const first = selectedDatesRef.current[0];
      const nextBulk: BulkShiftDraft = {
        shift: dateShifts[first] ?? ShiftTime.CUSTOM,
        startTime: dateCustomTimes[first]?.startTime ?? '',
        endTime: dateCustomTimes[first]?.endTime ?? '',
        offType: (dateOffTypes[first] as OffType | undefined) ?? '',
        reason: dateReasons[first] ?? '',
      };
      bulkDraftRef.current = nextBulk;
      setBulkDraft(nextBulk);
      flushBulkToDates(nextBulk, selectedDatesRef.current);
    } else {
      const empty = defaultBulkDraft();
      bulkDraftRef.current = empty;
      setBulkDraft(empty);
    }
  };

  const loadShifts = async () => {
    const allShifts = await getShiftRegistrations(user.id);
    // Sắp xếp theo ngày giảm dần (mới nhất trước)
    allShifts.sort((a, b) => b.date - a.date);
    setShifts([...allShifts]); // Tạo array mới để force re-render
  };

  const loadHolidays = async () => {
    const allHolidays = await getHolidays();
    setHolidays(allHolidays);
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
    const holiday = getHolidayForDate(date);

    /** Chế độ chọn nhiều ngày: bấm để gạch/bỏ gạch, cùng khung giờ qua form bên dưới */
    if (multiSelectMode && !registered) {
      if (selectedDates.includes(dateStr)) {
        removeDate(dateStr);
        return;
      }
      const nextSel = [...selectedDates, dateStr].sort();
      setSelectedDates(nextSel);
      if (holiday) {
        setDateShifts(prev => ({ ...prev, [dateStr]: ShiftTime.OFF }));
        setDateOffTypes(prev => ({ ...prev, [dateStr]: OffType.LE }));
        setDateCustomTimes(prev => {
          const n = { ...prev };
          delete n[dateStr];
          return n;
        });
        setDateReasons(prev => ({ ...prev, [dateStr]: bulkDraftRef.current.reason }));
      } else {
        flushBulkToDates(bulkDraftRef.current, nextSel);
      }
      return;
    }

    // Click vào ngày đã đăng ký → mở/đóng popup chi tiết
    if (registered) {
      setExpandedDate(expandedDate === dateStr ? null : dateStr);
      return;
    }

    // Nếu là ngày lễ và chưa chọn, tự động gợi ý chọn "Ngày off" với loại "LE"
    if (holiday && !selectedDates.includes(dateStr)) {
      // Tự động set là ngày off với loại nghỉ lễ
      setDateShifts(prev => ({ ...prev, [dateStr]: ShiftTime.OFF }));
      setDateOffTypes(prev => ({ ...prev, [dateStr]: OffType.LE }));
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
    const newReasons = { ...dateReasons };
    delete newReasons[dateStr];
    setDateReasons(newReasons);
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
    const ct = dateCustomTimes[dateStr];
    if (!ct?.startTime) return '';
    const et = ct.endTime || startTimePlus9Hours(ct.startTime);
    return `${ct.startTime}-${et}`;
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

  /** Kiểm tra xem một ngày có phải là ngày lễ không */
  const getHolidayForDate = (date: Date): Holiday | null => {
    const dateStr = toLocalDateStr(date);
    const dateTimestamp = new Date(dateStr + 'T00:00:00').getTime();
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();

    for (const holiday of holidays) {
      const holidayDate = new Date(holiday.date);
      const holidayYear = holidayDate.getFullYear();
      const holidayMonth = holidayDate.getMonth();
      const holidayDay = holidayDate.getDate();

      // Kiểm tra ngày lễ cố định hoặc ngày lễ lặp lại hàng năm
      if (holiday.isRecurring) {
        // Ngày lễ lặp lại: chỉ cần khớp tháng và ngày
        if (holidayMonth === month && holidayDay === day) {
          return holiday;
        }
      } else {
        // Ngày lễ cố định: phải khớp cả năm, tháng, ngày
        if (holidayYear === year && holidayMonth === month && holidayDay === day) {
          return holiday;
        }
      }
    }
    return null;
  };

  const enterEditMode = (registeredShift: ShiftRegistration, dateStr: string) => {
    setEditingShiftId(registeredShift.id);
    setDateShifts(prev => ({ ...prev, [dateStr]: registeredShift.shift }));
    setDateReasons(prev => ({ ...prev, [dateStr]: registeredShift.reason || '' }));
    if (registeredShift.shift === ShiftTime.CUSTOM && registeredShift.startTime) {
      setDateCustomTimes(prev => ({
        ...prev,
        [dateStr]: {
          startTime: registeredShift.startTime || '',
          endTime: registeredShift.endTime || startTimePlus9Hours(registeredShift.startTime)
        }
      }));
    } else if (registeredShift.shift === ShiftTime.OFF) {
      setDateOffTypes(prev => ({ ...prev, [dateStr]: registeredShift.offType || OffType.OFF_PN }));
    }
  };

  const exitEditMode = (dateStr: string) => {
    setEditingShiftId(null);
    const newDateShifts = { ...dateShifts };
    delete newDateShifts[dateStr];
    setDateShifts(newDateShifts);
    const newCustomTimes = { ...dateCustomTimes };
    delete newCustomTimes[dateStr];
    setDateCustomTimes(newCustomTimes);
    const newOffTypes = { ...dateOffTypes };
    delete newOffTypes[dateStr];
    setDateOffTypes(newOffTypes);
    const newReasons = { ...dateReasons };
    delete newReasons[dateStr];
    setDateReasons(newReasons);
  };

  const allDatesHaveShiftsForEdit = (dateStr: string): boolean => {
    const shift = dateShifts[dateStr];
    if (shift === ShiftTime.OFF) return !!dateOffTypes[dateStr];
    return !!(dateCustomTimes[dateStr]?.startTime);
  };

  const isReasonRequiredForEdit = (registeredShift: ShiftRegistration | undefined): boolean => {
    // Yêu cầu lý do nếu ca đã được duyệt
    return registeredShift?.status === RequestStatus.APPROVED;
  };

  const handleSaveChange = async (dateStr: string) => {
    const registeredShift = shifts.find(s => toLocalDateStr(new Date(s.date)) === dateStr);
    
    if (!editingShiftId || !allDatesHaveShiftsForEdit(dateStr)) return;
    
    // Kiểm tra lý do bắt buộc cho ca đã duyệt
    if (isReasonRequiredForEdit(registeredShift) && !dateReasons[dateStr]?.trim()) {
      alert('Vui lòng nhập lý do đổi ca đã được duyệt.');
      return;
    }
    
    setLoading(true);
    try {
      const shiftType = dateShifts[dateStr];
      const customTime = dateCustomTimes[dateStr];
      const offType = dateOffTypes[dateStr];
      const reason = dateReasons[dateStr]?.trim() || undefined;
      
      // Lưu thông tin ca cũ để gửi email
      const wasApproved = registeredShift?.status === RequestStatus.APPROVED;
      let oldShiftInfo = '';
      let newShiftInfo = '';
      
      if (wasApproved && registeredShift) {
        // Format thông tin ca cũ
        if (registeredShift.shift === ShiftTime.OFF) {
          oldShiftInfo = registeredShift.offType && OFF_TYPE_LABELS[registeredShift.offType] 
            ? OFF_TYPE_LABELS[registeredShift.offType] 
            : 'Ngày off';
        } else {
          oldShiftInfo = `Ca làm ${registeredShift.startTime || '09:00'} - ${registeredShift.endTime || '18:00'}`;
        }
      }
      
      if (shiftType === ShiftTime.OFF) {
        await updateShiftRegistration(editingShiftId, {
          shift: ShiftTime.OFF,
          startTime: null,
          endTime: null,
          offType: offType || OffType.OFF_PN,
          reason
        });
        
        if (wasApproved) {
          newShiftInfo = offType && OFF_TYPE_LABELS[offType] 
            ? OFF_TYPE_LABELS[offType] 
            : 'Ngày off';
        }
      } else if (customTime?.startTime) {
        const endTime = customTime.endTime || startTimePlus9Hours(customTime.startTime);
        await updateShiftRegistration(editingShiftId, {
          shift: ShiftTime.CUSTOM,
          startTime: customTime.startTime,
          endTime,
          offType: null,
          reason
        });
        
        if (wasApproved) {
          newShiftInfo = `Ca làm ${customTime.startTime} - ${endTime}`;
        }
      } else {
        setLoading(false);
        return;
      }
      
      // Gửi email thông báo đến admin nếu ca đã duyệt
      if (wasApproved && reason) {
        const dateFormatted = new Date(dateStr + 'T12:00:00').toLocaleDateString('vi-VN', { 
          weekday: 'long', 
          day: 'numeric', 
          month: 'long', 
          year: 'numeric' 
        });
        
        // Gửi email không đồng bộ, không chặn UI
        sendShiftChangeNotification(
          user.name,
          user.email,
          dateFormatted,
          oldShiftInfo,
          newShiftInfo,
          reason
        ).catch(error => {
          console.error('Failed to send notification email:', error);
          // Không hiển thị lỗi cho user vì đã lưu thành công
        });
      }
      
      const updatedShifts = await getShiftRegistrations(user.id);
      updatedShifts.sort((a, b) => b.date - a.date);
      setShifts([...updatedShifts]);
      exitEditMode(dateStr);
      setExpandedDate(null);
      
      // Thông báo cho nhân viên biết ca sẽ cần duyệt lại
      if (wasApproved) {
        alert('Đã gửi yêu cầu đổi lịch. Ca sẽ chuyển về trạng thái chờ duyệt và admin sẽ nhận được email thông báo.');
      }
    } catch (error: any) {
      console.error('Error updating shift:', error);
      alert('Lỗi khi đổi lịch: ' + (error?.message || 'Vui lòng thử lại'));
    } finally {
      setLoading(false);
    }
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
      const reason = dateReasons[dateStr]?.trim() || undefined;
      
      if (shiftType === ShiftTime.OFF) {
        return {
          id: `${Date.now()}-${index}`,
          userId: user.id,
          date: dateObj.getTime(),
          shift: ShiftTime.OFF,
          offType: offType || OffType.OFF_PN,
          reason,
          status: RequestStatus.PENDING,
          createdAt: Date.now()
        };
      }
      if (!customTime?.startTime) return null;
      const endTime = customTime.endTime || startTimePlus9Hours(customTime.startTime);
      return {
        id: `${Date.now()}-${index}`,
        userId: user.id,
        date: dateObj.getTime(),
        shift: ShiftTime.CUSTOM,
        startTime: customTime.startTime,
        endTime,
        reason,
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
        setDateReasons({});
        setExpandedDate(null);
        const cleared = defaultBulkDraft();
        bulkDraftRef.current = cleared;
        setBulkDraft(cleared);
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
      <div className="bg-gradient-to-r from-blue-600 to-cyan-500 rounded-3xl p-5 sm:p-6 text-white shadow-lg shadow-blue-200">
        <div className="flex flex-row items-center gap-2 sm:gap-3 min-w-0">
          <h2 className="text-xl font-bold min-w-0 flex-1 truncate">Đăng ký ca làm</h2>
          <div
            className="flex items-center gap-2 px-2 py-1 rounded-xl bg-white/15 border border-white/25 shrink-0"
            title="Một: chọn từng ngày như cũ. Nhiều: gạch nhiều ô, một khung giờ chung ở form bên dưới."
          >
            <div
              className="flex rounded-lg p-0.5 bg-black/20 ring-1 ring-inset ring-white/10"
              role="group"
              aria-label="Kiểu chọn ngày đăng ký ca"
            >
              <button
                type="button"
                aria-pressed={!multiSelectMode}
                onClick={() => handleMultiModeChange(false)}
                className={`px-2.5 py-1 rounded-md text-[10px] font-bold leading-none transition-colors min-h-0 min-w-0 ${
                  !multiSelectMode
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-white/90 hover:bg-white/10 active:bg-white/15'
                }`}
              >
                Một
              </button>
              <button
                type="button"
                aria-pressed={multiSelectMode}
                onClick={() => handleMultiModeChange(true)}
                className={`px-2.5 py-1 rounded-md text-[10px] font-bold leading-none transition-colors min-h-0 min-w-0 ${
                  multiSelectMode
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-white/90 hover:bg-white/10 active:bg-white/15'
                }`}
              >
                Nhiều
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Registration Form */}
      <form onSubmit={handleRegister} className="bg-white p-5 rounded-3xl shadow-sm border border-sky-50 space-y-5">
        <div className="space-y-3">
            <div className="flex items-center justify-center">
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => navigateMonth('prev')}
                        className="p-1 rounded-md hover:bg-slate-100 transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3 text-slate-500">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                        </svg>
                    </button>
                    <span className="text-xs font-bold text-slate-600 min-w-[140px] text-center">
                        {currentMonth.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })}
                    </span>
                    <button
                        type="button"
                        onClick={() => navigateMonth('next')}
                        className="p-1 rounded-md hover:bg-slate-100 transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3 text-slate-500">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                        </svg>
                    </button>
                </div>
            </div>
            
            {/* Calendar Grid Header */}
            <div className="grid grid-cols-7 gap-2 mb-2">
                {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((day, idx) => (
                    <div key={idx} className="text-center text-[10px] font-bold text-slate-400 py-1">
                        {day}
                    </div>
                ))}
            </div>

            
            <div ref={weekDaysRef} className="grid grid-cols-7 gap-2 relative min-h-[300px]">
                {getMonthDays().map((date, index) => {
                    const selected = isDateSelected(date);
                    const today = isToday(date);
                    const dateStr = toLocalDateStr(date);
                    const shift = getShiftForDate(dateStr);
                    const registeredShift = getRegisteredShift(date);
                    const isExpanded = expandedDate === dateStr;
                    const isRegistered = registeredShift !== null;
                    const showDayPopup = isExpanded && !(multiSelectMode && !isRegistered);
                    const holiday = getHolidayForDate(date);
                    
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
                                className={`relative w-full aspect-square flex flex-col items-center justify-center p-0 rounded-lg border-2 transition-all ${
                                    !isCurrentMonth
                                        ? 'opacity-30 cursor-not-allowed bg-slate-50 border-slate-100 text-slate-400'
                                        : isRegistered
                                        ? registeredShift?.shift === ShiftTime.OFF
                                            ? 'bg-slate-100 border-slate-400 text-slate-600 shadow-sm cursor-pointer hover:bg-slate-200'
                                            : registeredShift?.status === RequestStatus.REJECTED
                                            ? 'bg-rose-50 border-rose-500 text-rose-700 shadow-sm cursor-pointer hover:bg-rose-100'
                                            : 'bg-green-50 border-green-500 text-green-700 shadow-sm cursor-pointer hover:bg-green-100'
                                        : selected
                                        ? isOffDate(dateStr)
                                            ? 'bg-slate-100 border-slate-400 text-slate-700 shadow-sm'
                                            : shift
                                            ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-sm'
                                            : 'bg-orange-50 border-orange-400 text-orange-700 shadow-sm'
                                        : today
                                        ? 'bg-cyan-50 border-cyan-300 text-cyan-700'
                                        : holiday
                                        ? 'bg-amber-50/70 border-amber-200 text-slate-600 hover:bg-amber-50 hover:border-amber-300'
                                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                                }`}
                            >
                                <span className={`text-xs font-bold ${
                                    isRegistered 
                                        ? registeredShift?.shift === ShiftTime.OFF 
                                            ? 'text-slate-600' 
                                            : registeredShift?.status === RequestStatus.REJECTED 
                                            ? 'text-rose-700' 
                                            : 'text-green-700'
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
                                {isRegistered && registeredShift && registeredShift.shift !== ShiftTime.OFF && registeredShift.startTime && (
                                    <span className="text-[8px] font-medium opacity-90 mt-0.5 leading-tight">
                                        {registeredShift.startTime.slice(0, 2)}–{(registeredShift.endTime || startTimePlus9Hours(registeredShift.startTime)).slice(0, 2)}
                                    </span>
                                )}
                                {/* Badge ngày lễ — luôn hiển thị để nhân viên biết */}
                                {holiday && isCurrentMonth && (
                                    <span className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-amber-400 border border-amber-500 shadow-sm flex items-center justify-center" title={holiday.name}>
                                        <span className="text-[9px] leading-none">🎉</span>
                                    </span>
                                )}
                                {/* Badge trạng thái — circular như corner badge */}
                                {isRegistered && registeredShift && (
                                    <span className={`absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center shadow-sm ${
                                        registeredShift.status === RequestStatus.APPROVED
                                            ? (registeredShift.shift === ShiftTime.OFF ? 'bg-emerald-500' : 'bg-green-500')
                                            : registeredShift.status === RequestStatus.REJECTED
                                            ? 'bg-rose-500'
                                            : 'bg-amber-500'
                                    }`} title={
                                        registeredShift.status === RequestStatus.APPROVED ? 'Đã duyệt' :
                                        registeredShift.status === RequestStatus.REJECTED ? 'Từ chối' : 'Chờ duyệt'
                                    }>
                                        {registeredShift.shift === ShiftTime.OFF ? (
                                            <span className="text-[10px] font-bold text-white">O</span>
                                        ) : registeredShift.status === RequestStatus.REJECTED ? (
                                            <span className="text-[10px] font-bold text-white">!</span>
                                        ) : registeredShift.status === RequestStatus.PENDING ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12" fill="none" className="w-3 h-3">
                                                <path d="M6 3v3l2 1" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                                                <circle cx="6" cy="6" r="4.5" stroke="white" strokeWidth="1.5" fill="none"/>
                                            </svg>
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12" fill="none" className="w-3 h-3">
                                                <path d="M10 3L4.5 8.5L2 6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                            </svg>
                                        )}
                                    </span>
                                )}
                            </button>
                            
                            {showDayPopup && (
                                <div className={`absolute top-full ${getMenuPosition()} mt-2 z-50 bg-white rounded-2xl shadow-lg shadow-blue-200/30 border border-sky-100 p-4 w-[260px]`}>
                                    <div className="space-y-3">
                                        {isRegistered && registeredShift ? (
                                            editingShiftId === registeredShift.id ? (
                                            /* Form đổi lịch */
                                            <>
                                                <p className="text-xs font-bold text-slate-500 uppercase">Đổi lịch</p>
                                                {holiday && (
                                                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 mb-2">
                                                        <p className="text-[10px] font-bold text-yellow-800 flex items-center gap-1">
                                                            <span>🎉</span>
                                                            <span>{holiday.name}</span>
                                                        </p>
                                                    </div>
                                                )}
                                                <div className="flex gap-1 p-0.5 rounded-lg bg-slate-100">
                                                    <button
                                                        type="button"
                                                        onClick={() => setDateAsOff(dateStr, false)}
                                                        className={`flex-1 px-1.5 py-1 rounded-md text-[9px] font-bold transition-all ${
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
                                                        className={`flex-1 px-1.5 py-1 rounded-md text-[9px] font-bold transition-all ${
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
                                                    <div className="space-y-2">
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
                                                            <div className="flex-1">
                                                                <CustomSelect
                                                                    options={TIME_OPTIONS.map((t) => ({ value: t, label: t }))}
                                                                    value={dateCustomTimes[dateStr]?.endTime || (dateCustomTimes[dateStr]?.startTime ? startTimePlus9Hours(dateCustomTimes[dateStr].startTime) : '')}
                                                                    onChange={(v) => updateCustomTime(dateStr, 'endTime', v)}
                                                                    placeholder="Chọn giờ ra"
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                                <div className="mb-3">
                                                    <p className="text-[11px] text-slate-600 font-medium mb-1.5">
                                                        Lý do đổi lịch {isReasonRequiredForEdit(registeredShift) && <span className="text-red-600">*</span>}
                                                    </p>
                                                    {isReasonRequiredForEdit(registeredShift) && (
                                                        <p className="text-[9px] text-amber-600 mb-1.5">
                                                            ⚠️ Ca đã duyệt - Bắt buộc nhập lý do để admin xem xét lại
                                                        </p>
                                                    )}
                                                    <textarea
                                                        value={dateReasons[dateStr] || ''}
                                                        onChange={(e) => setDateReasons(prev => ({ ...prev, [dateStr]: e.target.value }))}
                                                        placeholder={isReasonRequiredForEdit(registeredShift) 
                                                            ? "Ví dụ: Có việc đột xuất, cần thay đổi giờ làm..." 
                                                            : "Ví dụ: Có việc đột xuất (tùy chọn)"}
                                                        className={`w-full rounded-lg border px-2.5 py-2 text-[11px] text-slate-700 placeholder:text-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                                                            isReasonRequiredForEdit(registeredShift) 
                                                                ? 'border-amber-300 bg-amber-50/30' 
                                                                : 'border-slate-200'
                                                        }`}
                                                        rows={2}
                                                    />
                                                </div>
                                                <div className="flex gap-1.5 pt-2 border-t border-slate-200">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleSaveChange(dateStr)}
                                                        disabled={loading || !allDatesHaveShiftsForEdit(dateStr)}
                                                        className="flex-1 px-2 py-1 rounded-md bg-blue-600 text-white text-[10px] font-bold hover:bg-blue-700 transition-all disabled:opacity-50"
                                                    >
                                                        {loading ? 'Đang lưu...' : 'Lưu thay đổi'}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => exitEditMode(dateStr)}
                                                        className="px-2 py-1 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold hover:bg-slate-200 transition-all"
                                                    >
                                                        Hủy
                                                    </button>
                                                </div>
                                            </>
                                            ) : (
                                            /* Chi tiết ngày đã đăng ký - gọn nhẹ, thanh thoát */
                                            <>
                                                {holiday && (
                                                    <div className="mb-3 flex items-center gap-1.5 text-amber-600 text-[11px]">
                                                        <span>🎉</span>
                                                        <span>{holiday.name}</span>
                                                    </div>
                                                )}
                                                <div className="space-y-2">
                                                    <p className="text-slate-400 text-[11px]">
                                                        {new Date(registeredShift.date).toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' })}
                                                    </p>
                                                    <div className="flex items-center justify-between gap-2">
                                                        <p className="text-sm font-semibold text-slate-800">
                                                            {registeredShift.shift === ShiftTime.OFF
                                                                ? (registeredShift.offType && OFF_TYPE_LABELS[registeredShift.offType] ? OFF_TYPE_LABELS[registeredShift.offType] : 'Ngày off')
                                                                : registeredShift.startTime
                                                                ? `${registeredShift.startTime} – ${registeredShift.endTime || startTimePlus9Hours(registeredShift.startTime)}`
                                                                : 'Ca làm việc'}
                                                        </p>
                                                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${
                                                            registeredShift.status === RequestStatus.APPROVED ? 'bg-emerald-50 text-emerald-600' :
                                                            registeredShift.status === RequestStatus.REJECTED ? 'bg-rose-50 text-rose-600' :
                                                            'bg-amber-50 text-amber-600'
                                                        }`}>
                                                            {registeredShift.status === RequestStatus.APPROVED ? 'Đã duyệt' : registeredShift.status === RequestStatus.REJECTED ? 'Từ chối' : 'Chờ duyệt'}
                                                        </span>
                                                    </div>
                                                    {registeredShift.status === RequestStatus.REJECTED && (
                                                        <div className="mt-2 p-2.5 rounded-xl bg-rose-50 border border-rose-100">
                                                            <p className="text-[11px] font-medium text-rose-700">
                                                                Ca này đã bị từ chối. Vui lòng đổi lịch để đăng ký lại.
                                                            </p>
                                                            {registeredShift.rejectionReason && (
                                                                <p className="text-[10px] text-rose-600 mt-1">
                                                                    Lý do: {registeredShift.rejectionReason}
                                                                </p>
                                                            )}
                                                        </div>
                                                    )}
                                                    {registeredShift.status === RequestStatus.APPROVED && (
                                                        <div className="mt-2 p-2.5 rounded-xl bg-blue-50 border border-blue-100">
                                                            <p className="text-[11px] font-medium text-blue-700">
                                                                ✓ Ca này đã được duyệt.
                                                            </p>
                                                            <p className="text-[10px] text-blue-600 mt-1">
                                                                Bạn vẫn có thể đổi lịch, nhưng cần nhập lý do và chờ admin duyệt lại.
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex gap-1.5 pt-3 mt-3 border-t border-slate-100">
                                                    <button
                                                        type="button"
                                                        onClick={() => enterEditMode(registeredShift, dateStr)}
                                                        className={`flex-1 py-1.5 rounded-lg text-[10px] font-medium transition-colors ${
                                                            registeredShift.status === RequestStatus.REJECTED
                                                                ? 'bg-rose-600 text-white hover:bg-rose-700'
                                                                : registeredShift.status === RequestStatus.APPROVED
                                                                ? 'bg-blue-600 text-white hover:bg-blue-700'
                                                                : 'bg-slate-900 text-white hover:bg-slate-800'
                                                        }`}
                                                    >
                                                        Đổi lịch
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setExpandedDate(null)}
                                                        className="px-3 py-1.5 rounded-lg text-slate-500 text-[10px] font-medium hover:bg-slate-50 hover:text-slate-700 transition-colors"
                                                    >
                                                        Đóng
                                                    </button>
                                                </div>
                                            </>
                                            )
                                        ) : (
                                            /* Form đăng ký mới — đồng bộ màu sắc với dự án (blue/sky/cyan) */
                                            <>
                                                {holiday && (
                                                    <div className="mb-2 flex items-center gap-1.5 text-amber-600 text-[11px]">
                                                        <span>🎉</span>
                                                        <span>{holiday.name}</span>
                                                    </div>
                                                )}
                                                <p className="text-slate-500 text-xs font-medium mb-3">
                                                    {new Date(dateStr + 'T12:00:00').toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' })}
                                                </p>
                                                <div className="flex gap-1 p-0.5 rounded-lg bg-sky-50 border border-sky-100 mb-3">
                                                    <button
                                                        type="button"
                                                        onClick={() => setDateAsOff(dateStr, false)}
                                                        className={`flex-1 py-1.5 rounded-md text-[9px] font-bold transition-all ${
                                                            !isOffDate(dateStr)
                                                                ? 'bg-blue-600 text-white shadow-sm'
                                                                : 'text-slate-600 hover:bg-white/80'
                                                        }`}
                                                    >
                                                        Ca làm
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setDateAsOff(dateStr, true)}
                                                        className={`flex-1 py-1.5 rounded-md text-[9px] font-bold transition-all ${
                                                            isOffDate(dateStr)
                                                                ? 'bg-slate-600 text-white shadow-sm'
                                                                : 'text-slate-600 hover:bg-white/80'
                                                        }`}
                                                    >
                                                        Ngày off
                                                    </button>
                                                </div>
                                                {isOffDate(dateStr) ? (
                                                    <div className="mb-3">
                                                        <p className="text-[11px] text-slate-600 font-medium mb-1.5">Loại off</p>
                                                        <CustomSelect
                                                            options={Object.entries(OFF_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
                                                            value={dateOffTypes[dateStr] || ''}
                                                            onChange={(v) => updateOffType(dateStr, v as OffType)}
                                                            placeholder="Chọn loại off"
                                                        />
                                                    </div>
                                                ) : (
                                                    <div className="flex items-end gap-3 mb-3">
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-[11px] text-slate-600 font-medium mb-1.5">Giờ vào</p>
                                                            <CustomSelect
                                                                options={TIME_OPTIONS.map((t) => ({ value: t, label: t }))}
                                                                value={dateCustomTimes[dateStr]?.startTime || ''}
                                                                onChange={(v) => updateCustomTime(dateStr, 'startTime', v)}
                                                                placeholder="Chọn giờ"
                                                            />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-[11px] text-slate-600 font-medium mb-1.5">Giờ ra</p>
                                                            <CustomSelect
                                                                options={TIME_OPTIONS.map((t) => ({ value: t, label: t }))}
                                                                value={dateCustomTimes[dateStr]?.endTime || (dateCustomTimes[dateStr]?.startTime ? startTimePlus9Hours(dateCustomTimes[dateStr].startTime) : '')}
                                                                onChange={(v) => updateCustomTime(dateStr, 'endTime', v)}
                                                                placeholder="Chọn giờ"
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                                <div className="mb-3">
                                                    <p className="text-[11px] text-slate-600 font-medium mb-1.5">Lý do đăng ký (tùy chọn)</p>
                                                    <textarea
                                                        value={dateReasons[dateStr] || ''}
                                                        onChange={(e) => setDateReasons(prev => ({ ...prev, [dateStr]: e.target.value }))}
                                                        placeholder="Ví dụ: Có việc gia đình, cần đổi ca..."
                                                        className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-[11px] text-slate-700 placeholder:text-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                                        rows={2}
                                                    />
                                                </div>
                                                <div className="flex gap-1.5 pt-3 border-t border-sky-100">
                                                    <button
                                                        type="button"
                                                        onClick={() => setExpandedDate(null)}
                                                        className="flex-1 py-1.5 rounded-lg bg-blue-600 text-white text-[10px] font-bold hover:bg-blue-700 transition-colors shadow-sm"
                                                    >
                                                        Xác nhận
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => removeDate(dateStr)}
                                                        className="px-3 py-1.5 rounded-lg text-slate-600 text-[10px] font-medium hover:bg-sky-50 border border-sky-200 transition-colors"
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

            {multiSelectMode && selectedDates.length > 0 && (
              <div className="mt-3 rounded-2xl border border-blue-200 bg-gradient-to-b from-blue-50/90 to-white p-4 space-y-3 shadow-sm">
                <p className="text-xs font-bold text-blue-900">
                  Ca chung cho {selectedDates.length} ngày đã chọn
                </p>
                <div className="flex gap-1 p-0.5 rounded-lg bg-sky-50 border border-sky-100">
                  <button
                    type="button"
                    onClick={() => patchBulkDraft({ shift: ShiftTime.CUSTOM })}
                    className={`flex-1 py-1.5 rounded-md text-[9px] font-bold transition-all ${
                      bulkDraft.shift === ShiftTime.CUSTOM
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-white/80'
                    }`}
                  >
                    Ca làm
                  </button>
                  <button
                    type="button"
                    onClick={() => patchBulkDraft({ shift: ShiftTime.OFF })}
                    className={`flex-1 py-1.5 rounded-md text-[9px] font-bold transition-all ${
                      bulkDraft.shift === ShiftTime.OFF
                        ? 'bg-slate-600 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-white/80'
                    }`}
                  >
                    Ngày off
                  </button>
                </div>
                {bulkDraft.shift === ShiftTime.OFF ? (
                  <div>
                    <p className="text-[11px] text-slate-600 font-medium mb-1.5">Loại off</p>
                    <CustomSelect
                      options={Object.entries(OFF_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
                      value={bulkDraft.offType || ''}
                      onChange={(v) => patchBulkDraft({ offType: v as OffType })}
                      placeholder="Chọn loại off"
                    />
                  </div>
                ) : (
                  <div className="flex items-end gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-slate-600 font-medium mb-1.5">Giờ vào</p>
                      <CustomSelect
                        options={TIME_OPTIONS.map((t) => ({ value: t, label: t }))}
                        value={bulkDraft.startTime}
                        onChange={(v) => patchBulkDraft({ startTime: v })}
                        placeholder="Chọn giờ"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-slate-600 font-medium mb-1.5">Giờ ra</p>
                      <CustomSelect
                        options={TIME_OPTIONS.map((t) => ({ value: t, label: t }))}
                        value={
                          bulkDraft.endTime ||
                          (bulkDraft.startTime ? startTimePlus9Hours(bulkDraft.startTime) : '')
                        }
                        onChange={(v) => patchBulkDraft({ endTime: v })}
                        placeholder="Chọn giờ"
                      />
                    </div>
                  </div>
                )}
                <div>
                  <p className="text-[11px] text-slate-600 font-medium mb-1.5">Lý do (tùy chọn, áp dụng mọi ngày đã chọn)</p>
                  <textarea
                    value={bulkDraft.reason}
                    onChange={(e) => patchBulkDraft({ reason: e.target.value })}
                    placeholder="Ví dụ: Làm cùng khung giờ cả tuần..."
                    className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-[11px] text-slate-700 placeholder:text-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    rows={2}
                  />
                </div>
              </div>
            )}
            
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
            className="w-full bg-blue-600 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-blue-700 transition-all active:scale-[0.98] shadow-lg shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
            {loading 
                ? `Đang đăng ký ${selectedDates.length} ngày...` 
                : allDatesHaveShifts()
                    ? `Xác nhận đăng ký ${selectedDates.length} ngày (ca làm + off)`
                    : `Vui lòng chọn giờ cho các ngày ca làm`
            }
        </button>
      </form>

      {/* History List - theo tháng hiện tại */}
      {(() => {
        const shiftsInMonth = shifts.filter(s => {
          const d = new Date(s.date);
          return d.getFullYear() === currentMonth.getFullYear() && d.getMonth() === currentMonth.getMonth();
        }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        return (
      <div>
        <h3 className="text-sm font-bold text-slate-700 mb-3 ml-2">
          Lịch đã đăng ký — {currentMonth.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })}
        </h3>
        <div className="space-y-3 pb-4">
            {shiftsInMonth.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs font-medium">Chưa có ca đăng ký trong tháng này.</div>
            ) : (
                <>
                    {shiftsInMonth.map(shift => (
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
                            <div className="flex flex-col items-end gap-1">
                                <span className={`text-[10px] font-bold px-2 py-1 rounded-lg uppercase ${
                                    shift.status === RequestStatus.APPROVED ? 'bg-green-50 text-green-600' :
                                    shift.status === RequestStatus.REJECTED ? 'bg-red-50 text-red-600' :
                                    'bg-orange-50 text-orange-600'
                                }`}>
                                    {shift.status}
                                </span>
                                {shift.status === RequestStatus.REJECTED && shift.rejectionReason && (
                                    <span className="text-[10px] text-red-600 text-right max-w-[140px]" title={shift.rejectionReason}>
                                        Lý do: {shift.rejectionReason}
                                    </span>
                                )}
                                <button
                                    type="button"
                                    onClick={() => {
                                        const d = new Date(shift.date);
                                        const dateStr = toLocalDateStr(d);
                                        setCurrentMonth(new Date(d.getFullYear(), d.getMonth(), 1));
                                        setExpandedDate(dateStr);
                                        enterEditMode(shift, dateStr);
                                    }}
                                    className="text-[10px] font-bold text-blue-600 hover:text-blue-700 hover:underline"
                                >
                                    Đổi lịch
                                </button>
                            </div>
                        </div>
                    ))}
                </>
            )}
        </div>
      </div>
        );
      })()}
    </div>
  );
};

export default ShiftRegister;