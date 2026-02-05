import React, { useEffect, useState, lazy, Suspense } from 'react';
import { User, AttendanceRecord, AttendanceType, ShiftRegistration, ShiftTime, OFF_TYPE_LABELS } from '../types';
import { getAttendance, getShiftRegistrations, getNotifications } from '../services/db';

// Lazy load Recharts - giảm ~100KB+ từ initial bundle, cải thiện FCP trên mobile
const DashboardChart = lazy(() => import('./DashboardChart'));

interface DashboardProps {
  user: User;
  setView?: (view: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ user, setView }) => {
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [todayShift, setTodayShift] = useState<ShiftRegistration | null>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [attendanceData, shifts, notifications] = await Promise.all([
          getAttendance(user.id),
          getShiftRegistrations(user.id),
          getNotifications(user.id)
        ]);
        setAttendance(attendanceData);
        
        // Tìm ca đăng ký hôm nay
        const today = new Date();
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0).getTime();
        const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999).getTime();
        const shift = shifts.find(s => s.date >= todayStart && s.date <= todayEnd && s.status === 'APPROVED');
        setTodayShift(shift || null);
        
        // Đếm thông báo chưa đọc
        const unread = notifications.filter(n => !n.read).length;
        setUnreadNotifications(unread);
      } catch (error) {
        console.error('Error loading data:', error);
      }
    };
    
    loadData();
    // Reload every 30 seconds to get latest data
    let interval: NodeJS.Timeout | null = null;
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (interval) {
          clearInterval(interval);
          interval = null;
        }
      } else {
        loadData();
        interval = setInterval(loadData, 30000);
      }
    };
    
    if (!document.hidden) {
      interval = setInterval(loadData, 30000);
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      if (interval) clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user.id]);

  const chartData = Array.from({ length: 5 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (4 - i));
    const dayStr = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).getTime();
    const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime();
    
    const dayRecords = attendance.filter(r => r.timestamp >= dayStart && r.timestamp <= dayEnd);
    const checkIn = dayRecords.find(r => r.type === AttendanceType.CHECK_IN);
    const checkOut = dayRecords.find(r => r.type === AttendanceType.CHECK_OUT);
    
    let hours = 0;
    if (checkIn && checkOut) {
      hours = (checkOut.timestamp - checkIn.timestamp) / (1000 * 60 * 60);
    }

    return { name: dayStr, hours: parseFloat(hours.toFixed(1)) };
  });

  // Tính tổng giờ làm tuần này
  const getWeekHours = () => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + 1); // Thứ 2
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const weekRecords = attendance.filter(r => 
      r.timestamp >= startOfWeek.getTime() && r.timestamp <= endOfWeek.getTime()
    );

    let totalHours = 0;
    const processedDays = new Set<string>();
    
    weekRecords.forEach(record => {
      const recordDate = new Date(record.timestamp);
      const dateStr = recordDate.toDateString();
      
      if (processedDays.has(dateStr)) return;
      
      const dayStart = new Date(recordDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(recordDate);
      dayEnd.setHours(23, 59, 59, 999);
      
      const dayRecords = attendance.filter(r => 
        r.timestamp >= dayStart.getTime() && r.timestamp <= dayEnd.getTime()
      );
      
      const checkIn = dayRecords.find(r => r.type === AttendanceType.CHECK_IN);
      const checkOut = dayRecords.find(r => r.type === AttendanceType.CHECK_OUT);
      
      if (checkIn && checkOut) {
        const hours = (checkOut.timestamp - checkIn.timestamp) / (1000 * 60 * 60);
        totalHours += hours;
        processedDays.add(dateStr);
      }
    });

    return parseFloat(totalHours.toFixed(1));
  };

  // Tính tỷ lệ đúng giờ
  const getOnTimeRate = () => {
    if (attendance.length === 0) return 0;
    const onTimeCount = attendance.filter(r => r.status === 'ON_TIME').length;
    return Math.round((onTimeCount / attendance.length) * 100);
  };

  return (
    <div className="space-y-6">
      {/* Welcome Card - Ocean Gradient */}
      <div className="fade-up" style={{animationDelay: '0ms'}}>
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-600 to-cyan-500 p-6 text-white shadow-lg shadow-blue-200">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full blur-3xl -mr-10 -mt-10"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-blue-900 opacity-20 rounded-full blur-2xl -ml-6 -mb-6"></div>
          
          {/* Địa chỉ và badge thông báo ở góc phải trên */}
          <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
            <div className="bg-white/20 backdrop-blur-md px-2 py-0.5 rounded-full border border-white/20">
              <span className="text-[10px] font-bold">99B Nguyễn Trãi</span>
            </div>
            {unreadNotifications > 0 && setView && (
              <button
                onClick={() => setView('notifications')}
                className="relative bg-white/20 backdrop-blur-md px-2 py-0.5 rounded-full border border-white/20 hover:bg-white/30 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-white">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                </svg>
                {unreadNotifications > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {unreadNotifications > 9 ? '9+' : unreadNotifications}
                  </span>
                )}
              </button>
            )}
          </div>
          
          <div className="relative z-10">
            <div className="mb-4">
                <div>
                    <p className="text-blue-100 text-xs font-semibold uppercase tracking-wider">Hôm nay</p>
                    <h2 className="text-xl font-bold">{new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
                </div>
            </div>
            
            {/* Ca đăng ký hôm nay */}
            {todayShift && (
              <div className="mb-3 bg-white/10 backdrop-blur-sm rounded-xl p-2 border border-white/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-blue-100">Ca hôm nay:</span>
                    {todayShift.shift === ShiftTime.OFF ? (
                      <span className="text-xs font-bold text-white bg-white/20 px-2 py-0.5 rounded-lg">
                        {todayShift.offType && OFF_TYPE_LABELS[todayShift.offType] ? OFF_TYPE_LABELS[todayShift.offType] : 'Nghỉ'}
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-white bg-white/20 px-2 py-0.5 rounded-lg">
                        {todayShift.startTime && todayShift.endTime 
                          ? `${todayShift.startTime} - ${todayShift.endTime}`
                          : 'Ca làm việc'}
                      </span>
                    )}
                  </div>
                  {setView && (
                    <button
                      onClick={() => setView('shifts')}
                      className="text-xs text-blue-100 hover:text-white underline"
                    >
                      Xem chi tiết
                    </button>
                  )}
                </div>
              </div>
            )}
            
            <div className="flex space-x-2 mt-2">
                <div className="flex-1 bg-black/10 rounded-2xl p-3 backdrop-blur-sm min-w-0">
                    <p className="text-xs text-blue-100 mb-1">Giờ vào</p>
                    <p className="text-base sm:text-lg font-bold truncate">
                      {(() => {
                        const now = new Date();
                        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
                        const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
                        const todayCheckIn = attendance.find(r =>
                          r.timestamp >= todayStart &&
                          r.timestamp <= todayEnd &&
                          r.type === AttendanceType.CHECK_IN
                        );
                        return todayCheckIn
                          ? new Date(todayCheckIn.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                          : '--:--';
                      })()}
                    </p>
                </div>
                <div className="flex-1 bg-black/10 rounded-2xl p-3 backdrop-blur-sm min-w-0">
                    <p className="text-xs text-blue-100 mb-1">Giờ ra</p>
                    <p className="text-base sm:text-lg font-bold truncate">
                      {(() => {
                        const now = new Date();
                        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
                        const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
                        const todayCheckOut = attendance.find(r =>
                          r.timestamp >= todayStart &&
                          r.timestamp <= todayEnd &&
                          r.type === AttendanceType.CHECK_OUT
                        );
                        return todayCheckOut
                          ? new Date(todayCheckOut.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                          : '--:--';
                      })()}
                    </p>
                </div>
                <div className="flex-1 bg-black/10 rounded-2xl p-3 backdrop-blur-sm min-w-0">
                    <p className="text-xs text-blue-100 mb-1">Giờ làm</p>
                    <p className="text-base sm:text-lg font-bold">{chartData[4]?.hours ?? 0}h</p>
                </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Links */}
      {setView && (
        <div className="grid grid-cols-2 gap-3 fade-up" style={{animationDelay: '50ms'}}>
          <button
            onClick={() => setView('checkin')}
            className="bg-white p-4 rounded-2xl shadow-sm border border-sky-50 hover:bg-sky-50 transition-colors text-left"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                </svg>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-slate-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </div>
            <p className="text-sm font-bold text-slate-800">Chấm công</p>
            <p className="text-xs text-slate-400 mt-0.5">Vào/ra ca làm việc</p>
          </button>
          <button
            onClick={() => setView('shifts')}
            className="bg-white p-4 rounded-2xl shadow-sm border border-sky-50 hover:bg-sky-50 transition-colors text-left"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                </svg>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-slate-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </div>
            <p className="text-sm font-bold text-slate-800">Đăng ký ca</p>
            <p className="text-xs text-slate-400 mt-0.5">Quản lý ca làm việc</p>
          </button>
          <button
            onClick={() => setView('payroll')}
            className="bg-white p-4 rounded-2xl shadow-sm border border-sky-50 hover:bg-sky-50 transition-colors text-left"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 rounded-full bg-green-50 text-green-600 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
                </svg>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-slate-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </div>
            <p className="text-sm font-bold text-slate-800">Bảng lương</p>
            <p className="text-xs text-slate-400 mt-0.5">Xem chi tiết lương</p>
          </button>
          <button
            onClick={() => setView('notifications')}
            className="bg-white p-4 rounded-2xl shadow-sm border border-sky-50 hover:bg-sky-50 transition-colors text-left relative"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                </svg>
              </div>
              {unreadNotifications > 0 && (
                <span className="absolute top-2 right-2 bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {unreadNotifications > 9 ? '9+' : unreadNotifications}
                </span>
              )}
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-slate-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </div>
            <p className="text-sm font-bold text-slate-800">Thông báo</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {unreadNotifications > 0 ? `${unreadNotifications} chưa đọc` : 'Xem thông báo'}
            </p>
          </button>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 fade-up" style={{animationDelay: '100ms'}}>
         <div className="bg-white p-4 rounded-3xl shadow-sm border border-sky-50">
             <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
             </div>
             <p className="text-2xl font-bold text-slate-800">{getWeekHours()}</p>
             <p className="text-xs text-slate-400 font-medium">Giờ tuần này</p>
         </div>
         <div className="bg-white p-4 rounded-3xl shadow-sm border border-sky-50">
             <div className="w-10 h-10 rounded-full bg-cyan-50 text-cyan-600 flex items-center justify-center mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" /></svg>
             </div>
             <p className="text-2xl font-bold text-slate-800">{getOnTimeRate()}%</p>
             <p className="text-xs text-slate-400 font-medium">Đúng giờ</p>
         </div>
      </div>

      {/* Chart - lazy load Recharts để tải nhanh hơn trên mobile */}
      <div className="bg-white rounded-3xl shadow-sm border border-sky-50 p-5 fade-up" style={{animationDelay: '200ms'}}>
        <h3 className="text-sm font-bold text-slate-700 mb-4">Biểu đồ giờ làm</h3>
        <Suspense fallback={<div className="h-40 flex items-center justify-center"><div className="w-6 h-6 border-2 border-blue-300 border-t-transparent rounded-full animate-spin" /></div>}>
          <DashboardChart data={chartData} />
        </Suspense>
      </div>

      {/* Timeline */}
      <div className="fade-up" style={{animationDelay: '300ms'}}>
        <h3 className="text-sm font-bold text-slate-700 mb-3 ml-1">Nhật ký chấm công</h3>
        <div className="bg-white rounded-3xl shadow-sm border border-sky-50 p-1">
          {attendance.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">Chưa có dữ liệu hôm nay.</div>
          ) : (
            <div className="flex flex-col">
              {attendance.slice(0, 5).map((record, idx) => (
                <div key={record.id} className="flex items-center p-3 hover:bg-sky-50/50 rounded-2xl transition-colors">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center mr-3 ${
                      record.type === AttendanceType.CHECK_IN ? 'bg-blue-100 text-blue-600' : 'bg-cyan-100 text-cyan-600'
                  }`}>
                      {record.type === AttendanceType.CHECK_IN ? (
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" /></svg>
                      )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-slate-700">
                        {record.type === AttendanceType.CHECK_IN ? 'Vào ca' : 'Tan ca'}
                    </p>
                    <p className="text-xs text-slate-400 font-medium">
                        {new Date(record.timestamp).toLocaleDateString('vi-VN')}
                    </p>
                  </div>
                  <div className="text-right">
                     <span className="text-sm font-bold text-slate-800 block">
                        {new Date(record.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                     </span>
                     <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                        record.status === 'ON_TIME' ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'
                     }`}>
                        {record.status === 'ON_TIME' ? 'Đúng giờ' : 'Trễ/Sớm'}
                     </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;