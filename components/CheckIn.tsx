import React, { useState, useEffect, useCallback } from 'react';
import { User, AttendanceType, AttendanceStatus, AttendanceRecord, ShiftRegistration, ShiftTime, RequestStatus, AllowedLocation } from '../types';
import { saveAttendance, getAttendance, getShiftRegistrations, getAllowedLocations } from '../services/db';
import { vibrate, HapticPatterns } from '../utils/pwa';
import { sortAttendanceAsc, pickDayAnchors } from '../utils/attendanceDay';

const CUSTOM_SHIFT_HOURS = 9; // Ca CUSTOM: nhân viên làm đủ 9 tiếng

/** Nghỉ trưa quy định 1 tiếng; cho phép lệch nhỏ khi chấm (phút). */
const LUNCH_BREAK_STANDARD_MIN = 60;
const LUNCH_BREAK_TOLERANCE_MIN = 5;

function isLunchBreakDurationOk(breakMinutes: number): boolean {
  const lo = LUNCH_BREAK_STANDARD_MIN - LUNCH_BREAK_TOLERANCE_MIN;
  const hi = LUNCH_BREAK_STANDARD_MIN + LUNCH_BREAK_TOLERANCE_MIN;
  return breakMinutes >= lo && breakMinutes <= hi;
}

/** Trả về giờ vào/ra theo phút từ nửa đêm (0–1439). Chỉ ca CUSTOM (9 tiếng) và OFF. */
function getExpectedShiftMinutes(shift: ShiftRegistration | null): { startMinutes: number; endMinutes: number } | null {
  if (!shift || shift.shift === ShiftTime.OFF) return null;
  // Ca CUSTOM: giờ vào từ đăng ký, giờ ra = giờ vào + 9 tiếng (cùng ngày, tối đa 23:59)
  if (shift.shift === ShiftTime.CUSTOM && shift.startTime) {
    const [sh, sm] = shift.startTime.split(':').map(Number);
    const startMinutes = sh * 60 + sm;
    const endMinutes = Math.min(startMinutes + CUSTOM_SHIFT_HOURS * 60, 23 * 60 + 59);
    return { startMinutes, endMinutes };
  }
  return null;
}

/** Lấy ca đăng ký ĐÃ DUYỆT của nhân viên cho một ngày (so sánh theo ngày local) */
function getShiftForDate(shifts: ShiftRegistration[], date: Date): ShiftRegistration | null {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const dateStr = `${y}-${m}-${d}`;
  return shifts.find(s => {
    if (s.status !== RequestStatus.APPROVED) return false;
    const sd = new Date(s.date);
    const sy = sd.getFullYear();
    const sm = String(sd.getMonth() + 1).padStart(2, '0');
    const sday = String(sd.getDate()).padStart(2, '0');
    return `${sy}-${sm}-${sday}` === dateStr;
  }) || null;
}

interface CheckInProps {
  user: User;
}

type CheckStep = 'CHECK_IN' | 'LUNCH_OUT' | 'LUNCH_IN' | 'CHECK_OUT';

function attendanceTypeForStep(step: CheckStep): AttendanceType {
  switch (step) {
    case 'CHECK_IN': return AttendanceType.CHECK_IN;
    case 'LUNCH_OUT': return AttendanceType.LUNCH_OUT;
    case 'LUNCH_IN': return AttendanceType.LUNCH_IN;
    case 'CHECK_OUT': return AttendanceType.CHECK_OUT;
  }
}

function canPerformStep(
  step: CheckStep,
  checkIn: AttendanceRecord | null,
  lunchOut: AttendanceRecord | null,
  lunchIn: AttendanceRecord | null,
  checkOut: AttendanceRecord | null,
): boolean {
  if (step === 'CHECK_IN') return !checkIn;
  if (step === 'LUNCH_OUT') return !!checkIn && !lunchOut;
  if (step === 'LUNCH_IN') return !!lunchOut && !lunchIn;
  return !!lunchIn && !checkOut;
}

const CheckIn: React.FC<CheckInProps> = ({ user }) => {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [allowedLocations, setAllowedLocations] = useState<AllowedLocation[]>([]);
  const [nearestLocation, setNearestLocation] = useState<AllowedLocation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [geoPermission, setGeoPermission] = useState<'unknown' | 'granted' | 'prompt' | 'denied'>('unknown');
  const [lastRecord, setLastRecord] = useState<AttendanceRecord | null>(null);
  const [todayCheckIn, setTodayCheckIn] = useState<AttendanceRecord | null>(null);
  const [todayCheckOut, setTodayCheckOut] = useState<AttendanceRecord | null>(null);
  const [todayLunchOut, setTodayLunchOut] = useState<AttendanceRecord | null>(null);
  const [todayLunchIn, setTodayLunchIn] = useState<AttendanceRecord | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedStep, setSelectedStep] = useState<CheckStep>('CHECK_IN');

  const loadAttendance = useCallback(async () => {
    const records = await getAttendance(user.id);
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
    const todayRecords = records.filter(r => r.timestamp >= todayStart && r.timestamp <= todayEnd);
    const asc = sortAttendanceAsc(todayRecords);
    setLastRecord(asc.length ? asc[asc.length - 1]! : null);

    const anchors = pickDayAnchors(asc);
    setTodayCheckIn(anchors.checkIn);
    setTodayCheckOut(anchors.checkOut);
    setTodayLunchOut(anchors.lunchOut);
    setTodayLunchIn(anchors.lunchIn);
  }, [user.id]);

  useEffect(() => {
    // Cập nhật mỗi 30s thay vì 1s để giảm re-render, app mượt hơn khi dùng lâu
    let lastDate = new Date().getDate();
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);
      
      // Kiểm tra nếu sang ngày mới, reload dữ liệu chấm công
      if (now.getDate() !== lastDate) {
        lastDate = now.getDate();
        loadAttendance();
      }
    }, 30000);
    
    loadAttendance();

    // Load allowed locations
    getAllowedLocations().then(locations => {
      const activeLocations = locations.filter(loc => loc.isActive);
      setAllowedLocations(activeLocations);
      console.log('Loaded allowed locations:', activeLocations);
    }).catch(err => {
      console.error('Error loading allowed locations:', err);
      // Fallback to default location if error
      setAllowedLocations([{
        id: 'default',
        name: 'Văn phòng chính',
        latitude: 10.040675858019696,
        longitude: 105.78463187148355,
        radiusMeters: 200,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }]);
    });

    return () => {
      clearInterval(timer);
    };
  }, [user.id, loadAttendance]);

  // Theo dõi trạng thái quyền vị trí (nếu browser hỗ trợ Permissions API)
  useEffect(() => {
    let cancelled = false;
    let permObj: PermissionStatus | null = null;

    const sync = async () => {
      try {
        if (!('permissions' in navigator) || !navigator.permissions?.query) return;
        // TS: PermissionName includes 'geolocation' in DOM lib
        permObj = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
        if (cancelled) return;
        setGeoPermission(permObj.state);
        permObj.onchange = () => {
          if (!cancelled) setGeoPermission(permObj!.state);
        };
      } catch {
        // ignore - some browsers throw even if permissions exists
      }
    };

    sync();
    return () => {
      cancelled = true;
      if (permObj) permObj.onchange = null;
    };
  }, []);

  // Tính lại distance khi location thay đổi - check tất cả allowed locations
  useEffect(() => {
    if (location && allowedLocations.length > 0) {
      // Tính khoảng cách đến tất cả locations
      let minDistance = Infinity;
      let nearest: AllowedLocation | null = null;

      allowedLocations.forEach(loc => {
        const dist = calculateDistance(location.lat, location.lng, loc.latitude, loc.longitude);
        if (dist < minDistance) {
          minDistance = dist;
          nearest = loc;
        }
      });

      setDistance(minDistance);
      setNearestLocation(nearest);
      console.log('Nearest location:', nearest?.name, 'Distance:', Math.round(minDistance), 'm');
    }
  }, [location, allowedLocations]);

  // Gọi getLocation sau khi allowedLocations đã được load (chỉ một lần)
  useEffect(() => {
    if (allowedLocations.length > 0 && !location) {
      getLocation();
    }
  }, [allowedLocations]); // eslint-disable-line react-hooks/exhaustive-deps

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const a = Math.sin((lat2 - lat1) * Math.PI / 180 / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin((lon2 - lon1) * Math.PI / 180 / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const getLocation = useCallback(() => {
    setLoading(true);
    if (!window.isSecureContext) {
      setError('Trình duyệt chỉ cho phép xin vị trí trên HTTPS (hoặc localhost). Vui lòng mở bằng HTTPS hoặc dùng localhost để hiện prompt Location.');
      setLoading(false);
      return;
    }
    if (!navigator.geolocation) { setError("Không hỗ trợ GPS"); setLoading(false); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setLocation({ lat: latitude, lng: longitude });
        setError(null); 
        setLoading(false);
      },
      (err) => {
        if (err?.code === 1) {
          setError('Bạn đã từ chối quyền Vị trí. Vui lòng bật lại quyền Location trong cài đặt trình duyệt để chấm công.');
        } else if (err?.code === 2) {
          setError('Không lấy được vị trí. Vui lòng bật Location/GPS trên thiết bị rồi thử lại.');
        } else if (err?.code === 3) {
          setError('Định vị quá lâu. Vui lòng thử lại ở nơi thoáng hơn.');
        } else {
          setError('Không thể lấy vị trí. Vui lòng thử lại.');
        }
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    );
  }, []);

  const requestLocationPermission = useCallback(() => {
    setError(null);
    getLocation(); // gọi từ hành động người dùng để hiện prompt xin quyền Location
  }, [getLocation]);

  const handleAttendance = async (type: AttendanceType) => {
    if (!location) { setError("Cần vị trí GPS"); return; }

    setLoading(true);
    setError(null);

    try {
      // Lấy ca đăng ký của nhân viên trong ngày để tính trạng thái (ON_TIME / LATE / EARLY_LEAVE / OVERTIME)
      const shifts = await getShiftRegistrations(user.id);
      const todayShift = getShiftForDate(shifts, currentTime);
      const expected = getExpectedShiftMinutes(todayShift);

      const timestamp = Date.now();

      let status = AttendanceStatus.ON_TIME;
      const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();

      if (expected) {
        if (type === AttendanceType.CHECK_IN) {
          if (currentMinutes > expected.startMinutes) status = AttendanceStatus.LATE;
        } else if (type === AttendanceType.CHECK_OUT) {
          if (currentMinutes < expected.endMinutes) status = AttendanceStatus.EARLY_LEAVE;
          else if (currentMinutes > expected.endMinutes) status = AttendanceStatus.OVERTIME;
        } else if (type === AttendanceType.LUNCH_IN && todayLunchOut) {
          const breakMin = (timestamp - todayLunchOut.timestamp) / (1000 * 60);
          if (!isLunchBreakDurationOk(breakMin)) status = AttendanceStatus.LATE;
        }
        // LUNCH_OUT: không chặn giờ (trước 11h / sau 13h30 vẫn ON_TIME)
      } else if (type === AttendanceType.LUNCH_IN && todayLunchOut) {
        const breakMin = (timestamp - todayLunchOut.timestamp) / (1000 * 60);
        if (!isLunchBreakDurationOk(breakMin)) status = AttendanceStatus.LATE;
      }
      // Không ca đăng ký / ca OFF: giữ ON_TIME; chỉ LUNCH_IN kiểm tra đủ 1 tiếng (± dung sai)

      const record: AttendanceRecord = {
        id: timestamp.toString(),
        userId: user.id,
        timestamp,
        type,
        location,
        status,
        synced: navigator.onLine
      };

      await saveAttendance(record);
      setLastRecord(record);
      if (record.type === AttendanceType.CHECK_IN) setTodayCheckIn(record);
      if (record.type === AttendanceType.CHECK_OUT) setTodayCheckOut(record);
      if (record.type === AttendanceType.LUNCH_OUT) setTodayLunchOut(record);
      if (record.type === AttendanceType.LUNCH_IN) setTodayLunchIn(record);
      
      // Hiển thị thông báo thành công
      const timeStr = currentTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
      const statusText = status === AttendanceStatus.LATE ? ' (Cần lưu ý giờ)' : 
                        status === AttendanceStatus.EARLY_LEAVE ? ' (Cần lưu ý)' :
                        status === AttendanceStatus.OVERTIME ? ' (Tăng ca)' : '';
      const lunchOutMsg = `✅ Bắt đầu nghỉ trưa thành công lúc ${timeStr}${statusText}`;
      const lunchInMsg = `✅ Kết thúc nghỉ trưa thành công lúc ${timeStr}${statusText}`;
      setSuccessMessage(
        type === AttendanceType.CHECK_IN 
          ? `✅ Chấm công vào thành công lúc ${timeStr}${status === AttendanceStatus.LATE ? ' (Muộn)' : ''}`
          : type === AttendanceType.CHECK_OUT
            ? `✅ Chấm công ra thành công lúc ${timeStr}${
                status === AttendanceStatus.EARLY_LEAVE ? ' (Về sớm)' :
                status === AttendanceStatus.OVERTIME ? ' (Tăng ca)' : ''
              }`
            : type === AttendanceType.LUNCH_OUT
              ? lunchOutMsg
              : lunchInMsg
      );
      
      // Tự động ẩn thông báo sau 4 giây
      setTimeout(() => {
        setSuccessMessage(null);
      }, 4000);
      
      // Haptic feedback on success
      vibrate(HapticPatterns.success);
    } catch (error) {
      console.error('Error saving attendance:', error);
      setError('Lỗi khi lưu dữ liệu chấm công. Vui lòng thử lại.');
      vibrate(HapticPatterns.error);
    } finally {
      setLoading(false);
    }
  };

  // Thứ tự trong ngày: vào ca → bắt đầu nghỉ trưa → kết thúc nghỉ trưa → ra ca
  const nextAction: CheckStep | 'DONE' =
    !todayCheckIn ? 'CHECK_IN'
    : !todayLunchOut ? 'LUNCH_OUT'
    : !todayLunchIn ? 'LUNCH_IN'
    : !todayCheckOut ? 'CHECK_OUT'
    : 'DONE';

  useEffect(() => {
    if (nextAction !== 'DONE') setSelectedStep(nextAction);
  }, [nextAction]);

  const canPerformSelected = canPerformStep(
    selectedStep,
    todayCheckIn,
    todayLunchOut,
    todayLunchIn,
    todayCheckOut,
  );

  const isWithinRange = nearestLocation !== null && distance !== null && distance <= nearestLocation.radiusMeters;
  const canAction = isWithinRange || !navigator.onLine;

  const actionBannerClass =
    nextAction === 'CHECK_IN' ? 'bg-blue-50 border border-blue-200'
    : nextAction === 'LUNCH_OUT' ? 'bg-orange-50 border border-orange-200'
    : nextAction === 'LUNCH_IN' ? 'bg-teal-50 border border-teal-200'
    : nextAction === 'CHECK_OUT' ? 'bg-amber-50 border border-amber-200'
    : 'bg-emerald-50 border border-emerald-200';
  const actionIconBoxClass =
    nextAction === 'CHECK_IN' ? 'bg-blue-100 text-blue-600'
    : nextAction === 'LUNCH_OUT' ? 'bg-orange-100 text-orange-600'
    : nextAction === 'LUNCH_IN' ? 'bg-teal-100 text-teal-700'
    : nextAction === 'CHECK_OUT' ? 'bg-amber-100 text-amber-600'
    : 'bg-emerald-100 text-emerald-700';
  const actionTitleClass =
    nextAction === 'CHECK_IN' ? 'text-blue-700'
    : nextAction === 'LUNCH_OUT' ? 'text-orange-700'
    : nextAction === 'LUNCH_IN' ? 'text-teal-700'
    : nextAction === 'CHECK_OUT' ? 'text-amber-700'
    : 'text-emerald-700';
  const actionHintText =
    nextAction === 'CHECK_IN' ? 'Bạn cần chấm công vào'
    : nextAction === 'LUNCH_OUT' ? 'Bạn cần chấm bắt đầu nghỉ trưa'
    : nextAction === 'LUNCH_IN' ? 'Bạn cần chấm kết thúc nghỉ trưa'
    : nextAction === 'CHECK_OUT' ? 'Bạn cần chấm công ra ca'
    : 'Bạn đã chấm công đủ hôm nay';
  const doneForDay = nextAction === 'DONE';
  const mainButtonTitle = doneForDay
    ? 'Đã hoàn tất hôm nay'
    : selectedStep === 'CHECK_IN' ? 'Chấm công vào'
    : selectedStep === 'LUNCH_OUT' ? 'Bắt đầu nghỉ trưa'
    : selectedStep === 'LUNCH_IN' ? 'Kết thúc nghỉ trưa'
    : 'Chấm công ra';
  const mainButtonLabel = doneForDay
    ? 'Đã hoàn tất'
    : selectedStep === 'CHECK_IN' ? 'Xác nhận vào'
    : selectedStep === 'LUNCH_OUT' ? 'Xác nhận bắt đầu nghỉ trưa'
    : selectedStep === 'LUNCH_IN' ? 'Xác nhận kết thúc nghỉ trưa'
    : 'Xác nhận ra ca';

  return (
    <div className="flex flex-col h-full pt-4 pb-2 fade-up space-y-4">
      {/* Success Popup Modal */}
      {successMessage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
          onClick={() => setSuccessMessage(null)}
        >
          <div 
            className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center text-center">
              {/* Success Icon */}
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center mb-4 shadow-lg">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-10 h-10 text-white">
                  <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
                </svg>
              </div>
              
              {/* Message */}
              <h3 className="text-xl font-bold text-gray-900 mb-2">Thành công!</h3>
              <p className="text-gray-600 mb-6">{successMessage}</p>
              
              {/* Close Button */}
              <button
                onClick={() => setSuccessMessage(null)}
                className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all active:scale-95 shadow-lg"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clock - Compact */}
      <div className="flex justify-between items-end px-2">
        <div>
          <h2 className="text-3xl font-extrabold text-blue-900 leading-none">
            {currentTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
          </h2>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mt-1">
            {currentTime.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <div className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-2 ${isWithinRange ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
          <span className={`w-2 h-2 rounded-full ${isWithinRange ? 'bg-green-500' : 'bg-orange-500'} animate-pulse`}></span>
          <span>{isWithinRange ? 'Trong văn phòng' : 'Ngoài văn phòng'}</span>
        </div>
      </div>

      {/* Hành động tiếp theo */}
      <div className={`px-4 py-3 rounded-2xl mx-2 flex items-center gap-3 ${actionBannerClass}`}>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${actionIconBoxClass}`}>
          {nextAction === 'CHECK_IN' ? (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" /></svg>
          ) : nextAction === 'CHECK_OUT' ? (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9v-3m-3 3V9m3 3v3" /></svg>
          ) : nextAction === 'LUNCH_OUT' ? (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" /></svg>
          ) : nextAction === 'LUNCH_IN' ? (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" /></svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
            </svg>
          )}
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Hành động tiếp theo</p>
          <p className={`font-bold ${actionTitleClass}`}>{actionHintText}</p>
          {nextAction !== 'DONE' && !canPerformSelected && (
            <p className="text-xs text-slate-500 mt-1">Chọn đúng ô đang đến lượt (theo thứ tự) để xác nhận bên dưới.</p>
          )}
        </div>
      </div>

      {/* Hôm nay: chọn ô → nút lớn chấm đúng loại đã chọn */}
      <div className="grid grid-cols-2 gap-3 px-2" role="group" aria-label="Chọn loại chấm công">
        <button
          type="button"
          onClick={() => setSelectedStep('CHECK_IN')}
          aria-pressed={selectedStep === 'CHECK_IN'}
          className={`text-left bg-white rounded-2xl p-3 shadow-sm border flex items-center gap-2 transition-all active:scale-[0.98] ${
            selectedStep === 'CHECK_IN' ? 'ring-2 ring-blue-500 border-blue-200 shadow-md' : 'border-sky-50 hover:border-sky-200'
          }`}
        >
          <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-slate-400 font-bold uppercase">Vào ca</p>
            <p className="text-sm font-bold text-slate-800 truncate">
              {todayCheckIn ? new Date(todayCheckIn.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
            </p>
          </div>
        </button>
        <button
          type="button"
          onClick={() => setSelectedStep('LUNCH_OUT')}
          aria-pressed={selectedStep === 'LUNCH_OUT'}
          className={`text-left bg-white rounded-2xl p-3 shadow-sm border flex items-center gap-2 transition-all active:scale-[0.98] ${
            selectedStep === 'LUNCH_OUT' ? 'ring-2 ring-orange-500 border-orange-200 shadow-md' : 'border-sky-50 hover:border-sky-200'
          }`}
        >
          <div className="w-9 h-9 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center flex-shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" /></svg>
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-slate-400 font-bold uppercase leading-tight">Bắt đầu nghỉ trưa</p>
            <p className="text-sm font-bold text-slate-800 truncate">
              {todayLunchOut ? new Date(todayLunchOut.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
            </p>
          </div>
        </button>
        <button
          type="button"
          onClick={() => setSelectedStep('LUNCH_IN')}
          aria-pressed={selectedStep === 'LUNCH_IN'}
          className={`text-left bg-white rounded-2xl p-3 shadow-sm border flex items-center gap-2 transition-all active:scale-[0.98] ${
            selectedStep === 'LUNCH_IN' ? 'ring-2 ring-teal-500 border-teal-200 shadow-md' : 'border-sky-50 hover:border-sky-200'
          }`}
        >
          <div className="w-9 h-9 rounded-xl bg-teal-100 text-teal-600 flex items-center justify-center flex-shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" /></svg>
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-slate-400 font-bold uppercase leading-tight">Kết thúc nghỉ trưa</p>
            <p className="text-sm font-bold text-slate-800 truncate">
              {todayLunchIn ? new Date(todayLunchIn.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
            </p>
          </div>
        </button>
        <button
          type="button"
          onClick={() => setSelectedStep('CHECK_OUT')}
          aria-pressed={selectedStep === 'CHECK_OUT'}
          className={`text-left bg-white rounded-2xl p-3 shadow-sm border flex items-center gap-2 transition-all active:scale-[0.98] ${
            selectedStep === 'CHECK_OUT' ? 'ring-2 ring-cyan-500 border-cyan-200 shadow-md' : 'border-sky-50 hover:border-sky-200'
          }`}
        >
          <div className="w-9 h-9 rounded-xl bg-cyan-100 text-cyan-600 flex items-center justify-center flex-shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" /></svg>
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-slate-400 font-bold uppercase">Ra ca</p>
            <p className="text-sm font-bold text-slate-800 truncate">
              {todayCheckOut ? new Date(todayCheckOut.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
            </p>
          </div>
        </button>
      </div>

      {/* Check-in/Check-out Button Card */}
      <div className="flex-1 relative bg-gradient-to-br from-blue-600 to-blue-700 rounded-[2rem] overflow-hidden shadow-xl shadow-blue-200/50 border-4 border-white mx-0 sm:mx-2 min-h-[60vh] sm:min-h-0 flex flex-col items-center justify-center p-6">
        {error && (
          <div className="mb-4 bg-red-500/90 text-white text-xs font-bold px-3 py-2 rounded-xl">
            ! {error}
          </div>
        )}
        <div className="flex flex-col items-center gap-6">
          <div className="w-32 h-32 rounded-full border-4 border-white bg-white/20 backdrop-blur-md flex items-center justify-center shadow-2xl">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-16 h-16 text-white">
              {doneForDay ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              ) : selectedStep === 'CHECK_IN' || selectedStep === 'LUNCH_IN' ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9v-3m-3 3V9m3 3v3" />
              )}
            </svg>
          </div>
          <div className="text-center">
            <p className="text-white text-lg font-bold mb-2">
              {mainButtonTitle}
            </p>
            <p className="text-white/80 text-sm">
              {isWithinRange ? 'Bạn đang trong văn phòng' : 'Bạn đang ngoài văn phòng'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (!canPerformSelected) return;
              return handleAttendance(attendanceTypeForStep(selectedStep));
            }}
            disabled={!canPerformSelected || loading || (!canAction && navigator.onLine)}
            className={`h-14 px-10 rounded-full font-bold shadow-lg flex items-center space-x-3 transition-all active:scale-95 ${
              !canPerformSelected || loading || (!canAction && navigator.onLine)
                ? 'bg-slate-400 text-slate-200 cursor-not-allowed'
                : 'bg-white text-blue-600 hover:bg-blue-50'
            }`}
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Đang xử lý...</span>
              </>
            ) : (
              <>
                <span>{mainButtonLabel}</span>
                {canPerformSelected && (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                )}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Location Details Card */}
      <div className="bg-white rounded-3xl p-4 shadow-sm border border-sky-50 mx-2 flex justify-between items-center">
        <div>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Vị trí hiện tại</p>
          <p className="text-sm font-bold text-slate-800">
            {loading ? 'Đang định vị...' : (distance && nearestLocation ? `${Math.round(distance)}m đến ${nearestLocation.name}` : 'Chưa có vị trí')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(!location || distance === null || !!error) && (
            <button
              type="button"
              onClick={requestLocationPermission}
              disabled={loading}
              className="px-3 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors disabled:opacity-60"
            >
              Cho phép vị trí
            </button>
          )}
          <button
            type="button"
            onClick={getLocation}
            disabled={loading}
            className="flex items-center justify-center w-10 h-10 shrink-0 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors disabled:opacity-60"
            aria-label="Lấy lại vị trí"
            title="Lấy lại vị trí"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={`w-5 h-5 shrink-0 ${loading ? 'animate-spin' : ''}`}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default CheckIn;