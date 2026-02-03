import React, { useState, useEffect, useRef } from 'react';
import { User, AttendanceType, AttendanceStatus, OFFICE_LOCATION, AttendanceRecord } from '../types';
import { saveAttendance, getAttendance } from '../services/db';
import { uploadAttendancePhoto } from '../services/storage';

interface CheckInProps {
  user: User;
}

const CheckIn: React.FC<CheckInProps> = ({ user }) => {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastRecord, setLastRecord] = useState<AttendanceRecord | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Camera State - lưu Blob để upload trực tiếp (không qua base64/JSON)
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const photoUrlRef = useRef<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const startCamera = async () => {
    // Tránh gọi getUserMedia hai lần (Strict Mode hoặc re-mount) — camera đã active thì bỏ qua
    if (streamRef.current?.active) {
      if (videoRef.current) videoRef.current.srcObject = streamRef.current;
      setIsCameraActive(true);
      setCameraError(null);
      return;
    }
    try {
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 1280 }, aspectRatio: { ideal: 9/16 } } 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraActive(true);
      }
    } catch (err) {
      const e = err as DOMException;
      console.error("Camera error:", err);
      if (e?.name === 'NotReadableError' || e?.message?.includes('in use')) {
        setCameraError('Camera đang được sử dụng bởi ứng dụng khác. Hãy đóng tab/ứng dụng dùng camera rồi thử lại.');
      } else if (e?.name === 'NotAllowedError') {
        setCameraError('Bạn chưa cho phép truy cập camera.');
      } else {
        setCameraError('Không thể bật camera. Vui lòng thử lại.');
      }
    }
  };

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    
    // Load attendance records async
    const loadAttendance = async () => {
      const records = await getAttendance(user.id);
      if (records.length > 0) setLastRecord(records[0]);
    };
    loadAttendance();
    
    getLocation();
    startCamera(); // Auto start camera

    // Khóa màn hình chiều dọc đứng (portrait)
    if (screen.orientation?.lock) {
      screen.orientation.lock('portrait').catch(() => {});
    }

    return () => {
      clearInterval(timer);
      stopCamera();
      screen.orientation?.unlock?.();
      if (photoUrlRef.current) {
        URL.revokeObjectURL(photoUrlRef.current);
        photoUrlRef.current = null;
      }
    };
  }, [user.id]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (context) {
        context.translate(canvas.width, 0);
        context.scale(-1, 1);
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        // Tạo Blob trực tiếp từ canvas, không qua base64
        canvas.toBlob((blob) => {
          if (blob) {
            if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current);
            photoUrlRef.current = URL.createObjectURL(blob);
            setPhoto(blob);
          }
        }, 'image/jpeg', 0.8);
      }
    }
  };

  const retakePhoto = () => {
    if (photoUrlRef.current) {
      URL.revokeObjectURL(photoUrlRef.current);
      photoUrlRef.current = null;
    }
    setPhoto(null);
    if (!isCameraActive) startCamera();
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; 
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const a = Math.sin((lat2 - lat1) * Math.PI / 180 / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin((lon2 - lon1) * Math.PI / 180 / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const getLocation = () => {
    setLoading(true);
    if (!navigator.geolocation) { setError("Không hỗ trợ GPS"); setLoading(false); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setLocation({ lat: latitude, lng: longitude });
        setDistance(calculateDistance(latitude, longitude, OFFICE_LOCATION.lat, OFFICE_LOCATION.lng));
        setError(null); setLoading(false);
      },
      () => { setError("Bật GPS để chấm công"); setLoading(false); }
    );
  };

  const handleAttendance = async (type: AttendanceType) => {
    if (!location) { setError("Cần vị trí GPS"); return; }
    if (!photo) { setError("Vui lòng chụp ảnh"); return; }

    setLoading(true);
    setError(null);

    try {
      // Upload ảnh lên Supabase Storage trước
      const timestamp = Date.now();
      const photoUrl = await uploadAttendancePhoto(photo, user.id, timestamp, type);

      let status = AttendanceStatus.ON_TIME;
      const hour = currentTime.getHours();
      if (type === AttendanceType.CHECK_IN && hour > 9) status = AttendanceStatus.LATE;
      if (type === AttendanceType.CHECK_OUT) {
          if (hour < 17) status = AttendanceStatus.EARLY_LEAVE;
          if (hour > 18) status = AttendanceStatus.OVERTIME;
      }
      
      const record: AttendanceRecord = { 
        id: timestamp.toString(), 
        userId: user.id, 
        timestamp, 
        type, 
        location, 
        status, 
        synced: navigator.onLine,
        photoUrl // URL từ Storage hoặc base64 fallback
      };
      
      await saveAttendance(record);
      setLastRecord(record);
      if (photoUrlRef.current) {
        URL.revokeObjectURL(photoUrlRef.current);
        photoUrlRef.current = null;
      }
      setPhoto(null);
      startCamera();
    } catch (error) {
      console.error('Error saving attendance:', error);
      setError('Lỗi khi lưu dữ liệu chấm công. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const isCheckInNext = !lastRecord || lastRecord.type === AttendanceType.CHECK_OUT;
  const isWithinRange = distance !== null && distance <= OFFICE_LOCATION.radiusMeters;
  const canAction = isWithinRange || !navigator.onLine;

  return (
    <div className="flex flex-col h-full pt-4 pb-2 fade-up space-y-4">
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

      {/* Camera Preview Card */}
      <div className="flex-1 relative bg-slate-900 rounded-[2rem] overflow-hidden shadow-xl shadow-blue-200/50 border-4 border-white mx-0 sm:mx-2 min-h-[60vh] sm:min-h-0">
         {/* Camera Video / Photo Display */}
         {photo && photoUrlRef.current ? (
             <img src={photoUrlRef.current} alt="Captured" className="absolute inset-0 w-full h-full object-contain" />
         ) : (
             <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted 
                className="absolute inset-0 w-full h-full object-contain transform scale-x-[-1]" 
             />
         )}
         <canvas ref={canvasRef} className="hidden" />

         {/* Overlay UI inside Camera */}
         <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4">
            {/* Top Bar */}
            <div className="flex justify-between items-start flex-wrap gap-2">
                <div className="bg-black/30 backdrop-blur-md text-white text-[10px] font-bold px-3 py-1 rounded-full border border-white/10">
                   Camera: {isCameraActive ? 'ON' : 'OFF'}
                </div>
                {cameraError && (
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="bg-amber-500/90 text-white text-[10px] font-bold px-3 py-1.5 rounded-full max-w-[70%]">
                            📷 {cameraError}
                        </span>
                        <button
                            type="button"
                            onClick={() => { setCameraError(null); startCamera(); }}
                            className="pointer-events-auto bg-white/90 text-amber-700 text-[10px] font-bold px-2 py-1 rounded-full hover:bg-white"
                        >
                            Thử lại
                        </button>
                    </div>
                )}
                {error && (
                    <div className="bg-red-500/90 text-white text-[10px] font-bold px-3 py-1 rounded-full animate-bounce">
                        ! {error}
                    </div>
                )}
            </div>

            {/* Bottom Controls (Pointer events enabled for buttons) */}
            <div className="flex items-center justify-center pointer-events-auto pb-4">
               {photo ? (
                 <div className="flex items-center space-x-4">
                    <button 
                        onClick={retakePhoto}
                        className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/30 transition-all"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" /></svg>
                    </button>
                    <button 
                        onClick={() => handleAttendance(isCheckInNext ? AttendanceType.CHECK_IN : AttendanceType.CHECK_OUT)}
                        disabled={!canAction && navigator.onLine}
                        className={`h-12 px-8 rounded-full font-bold shadow-lg flex items-center space-x-2 transition-all active:scale-95 ${
                            (!canAction && navigator.onLine) ? 'bg-slate-500 text-slate-200 cursor-not-allowed' :
                            'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                    >
                        <span>{isCheckInNext ? 'Xác nhận vào' : 'Xác nhận ra'}</span>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                    </button>
                 </div>
               ) : (
                 <button 
                    onClick={capturePhoto}
                    disabled={!isCameraActive}
                    className="w-20 h-20 rounded-full border-4 border-white bg-transparent flex items-center justify-center active:scale-90 transition-all group"
                 >
                    <div className="w-16 h-16 rounded-full bg-white group-hover:scale-90 transition-all"></div>
                 </button>
               )}
            </div>
         </div>
      </div>

      {/* Location Details Card */}
      <div className="bg-white rounded-3xl p-4 shadow-sm border border-sky-50 mx-2 flex justify-between items-center">
         <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Vị trí hiện tại</p>
            <p className="text-sm font-bold text-slate-800">
                {loading ? 'Đang định vị...' : (distance ? `${Math.round(distance)}m đến văn phòng` : 'Chưa có vị trí')}
            </p>
         </div>
         <button onClick={getLocation} className="p-2 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 4.992l9.19-9.19M16.702 16.002a4.5 4.5 0 010-9.003 7.5 7.5 0 010 15.003z" />
            </svg>
         </button>
      </div>
    </div>
  );
};

export default CheckIn;