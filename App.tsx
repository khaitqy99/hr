import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import CheckIn from './components/CheckIn';
import ShiftRegister from './components/ShiftRegister';
import AdminPanel from './components/AdminPanel';
import Payroll from './components/Payroll';
import EmployeeProfile from './components/EmployeeProfile';
import SalaryManagement from './components/SalaryManagement';
import EnvError from './components/EnvError';
import { User, UserRole } from './types';
import { getCurrentUser } from './services/db';
import { sendOTP, verifyOTP } from './services/auth';

// Helper function to check if current view is admin route
// Chỉ ADMIN mới có thể truy cập các admin routes
const isAdminRoute = (view: string, userRole: UserRole): boolean => {
  if (userRole !== UserRole.ADMIN) return false;
  return ['admin', 'salary-management', 'employee-profile'].includes(view);
};

const LoginScreen = ({ onLogin }: { onLogin: (user: User) => void }) => {
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [otpExpiresAt, setOtpExpiresAt] = useState<number | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  // Rate limiting states
  const [lastOTPRequestTime, setLastOTPRequestTime] = useState<number | null>(null);
  const [rateLimitUntil, setRateLimitUntil] = useState<number | null>(null);
  const [rateLimitCountdown, setRateLimitCountdown] = useState<number>(0);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Kiểm tra rate limit phía client (tối thiểu 10 giây giữa các request để tránh spam)
    const now = Date.now();
    if (lastOTPRequestTime && (now - lastOTPRequestTime) < 10000) {
      const remaining = Math.ceil((10000 - (now - lastOTPRequestTime)) / 1000);
      setError(`Vui lòng đợi ${remaining} giây trước khi gửi lại OTP.`);
      return;
    }

    // Không block cứng nhắc - chỉ cảnh báo nếu đang trong thời gian rate limit
    // Cho phép thử lại để kiểm tra xem Supabase còn rate limit không
    if (rateLimitUntil && now < rateLimitUntil) {
      const remaining = Math.ceil((rateLimitUntil - now) / 1000);
      // Chỉ cảnh báo, không block - để Supabase quyết định
      console.warn(`Rate limit warning: ${remaining} seconds remaining`);
    }

    setLoading(true);
    setLastOTPRequestTime(now);

    try {
      const result = await sendOTP(email);
      if (result.success) {
        setOtpSent(true);
        setStep('otp');
        // OTP có hiệu lực trong 5 phút (300 giây)
        const expiresAt = Date.now() + 5 * 60 * 1000;
        setOtpExpiresAt(expiresAt);
        setTimeRemaining(300);
        // Reset rate limit khi thành công
        setRateLimitUntil(null);
        setLastOTPRequestTime(null);
      } else {
        // Nếu bị rate limit từ server, set countdown 5 phút (300 giây)
        // Supabase có thể rate limit lâu hơn 60 giây
        if (result.rateLimited) {
          const rateLimitEnd = Date.now() + 5 * 60 * 1000; // 5 phút
          setRateLimitUntil(rateLimitEnd);
          setRateLimitCountdown(300);
        }
        setError(result.error || 'Không thể gửi OTP. Vui lòng thử lại.');
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Có lỗi xảy ra. Vui lòng thử lại.';
      // Kiểm tra nếu lỗi là rate limit - set 5 phút
      if (errorMessage.includes('rate limit') || errorMessage.includes('429') || errorMessage.includes('rate limit exceeded')) {
        const rateLimitEnd = Date.now() + 5 * 60 * 1000; // 5 phút
        setRateLimitUntil(rateLimitEnd);
        setRateLimitCountdown(300);
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleOTPSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await verifyOTP(email, otp);
      if (result.success && result.user) {
        onLogin(result.user);
      } else {
        setError(result.error || 'OTP không hợp lệ. Vui lòng thử lại.');
      }
    } catch (err: any) {
      setError(err.message || 'Có lỗi xảy ra. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const handleBackToEmail = () => {
    setStep('email');
    setOtp('');
    setOtpSent(false);
    setError(null);
    setOtpExpiresAt(null);
    setTimeRemaining(0);
  };

  const handleResendOTP = async () => {
    setError(null);

    // Kiểm tra rate limit phía client (tối thiểu 10 giây giữa các request để tránh spam)
    const now = Date.now();
    if (lastOTPRequestTime && (now - lastOTPRequestTime) < 10000) {
      const remaining = Math.ceil((10000 - (now - lastOTPRequestTime)) / 1000);
      setError(`Vui lòng đợi ${remaining} giây trước khi gửi lại OTP.`);
      return;
    }

    // Không block cứng nhắc - chỉ cảnh báo nếu đang trong thời gian rate limit
    // Cho phép thử lại để kiểm tra xem Supabase còn rate limit không
    if (rateLimitUntil && now < rateLimitUntil) {
      const remaining = Math.ceil((rateLimitUntil - now) / 1000);
      // Chỉ cảnh báo, không block - để Supabase quyết định
      console.warn(`Rate limit warning: ${remaining} seconds remaining`);
    }

    setLoading(true);
    setLastOTPRequestTime(now);

    try {
      const result = await sendOTP(email);
      if (result.success) {
        setOtpSent(true);
        setError(null);
        setOtp(''); // Reset OTP input
        // Reset timer - OTP có hiệu lực trong 5 phút (300 giây)
        const expiresAt = Date.now() + 5 * 60 * 1000;
        setOtpExpiresAt(expiresAt);
        setTimeRemaining(300);
        // Reset rate limit khi thành công
        setRateLimitUntil(null);
        setLastOTPRequestTime(null);
      } else {
        // Nếu bị rate limit từ server, set countdown 5 phút (300 giây)
        // Supabase có thể rate limit lâu hơn 60 giây
        if (result.rateLimited) {
          const rateLimitEnd = Date.now() + 5 * 60 * 1000; // 5 phút
          setRateLimitUntil(rateLimitEnd);
          setRateLimitCountdown(300);
        }
        setError(result.error || 'Không thể gửi lại OTP. Vui lòng thử lại.');
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Có lỗi xảy ra. Vui lòng thử lại.';
      // Kiểm tra nếu lỗi là rate limit - set 5 phút
      if (errorMessage.includes('rate limit') || errorMessage.includes('429') || errorMessage.includes('rate limit exceeded')) {
        const rateLimitEnd = Date.now() + 5 * 60 * 1000; // 5 phút
        setRateLimitUntil(rateLimitEnd);
        setRateLimitCountdown(300);
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Timer countdown cho OTP
  useEffect(() => {
    if (step === 'otp' && otpExpiresAt) {
      const interval = setInterval(() => {
        const remaining = Math.max(0, Math.floor((otpExpiresAt - Date.now()) / 1000));
        setTimeRemaining(remaining);
        
        if (remaining === 0) {
          clearInterval(interval);
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [step, otpExpiresAt]);

  // Timer countdown cho rate limit
  useEffect(() => {
    if (rateLimitUntil) {
      const interval = setInterval(() => {
        const now = Date.now();
        const remaining = Math.max(0, Math.ceil((rateLimitUntil - now) / 1000));
        setRateLimitCountdown(remaining);
        
        if (remaining === 0) {
          // Khi countdown hết, reset rate limit để cho phép thử lại
          setRateLimitUntil(null);
          clearInterval(interval);
        }
      }, 1000);

      return () => clearInterval(interval);
    } else {
      // Reset countdown khi không còn rate limit
      setRateLimitCountdown(0);
    }
  }, [rateLimitUntil]);

  // Reset rate limit state khi component mount lại hoặc khi email thay đổi
  useEffect(() => {
    // Kiểm tra xem rate limit đã hết chưa khi component mount
    if (rateLimitUntil && Date.now() >= rateLimitUntil) {
      setRateLimitUntil(null);
      setRateLimitCountdown(0);
    }
  }, [email]);

  // Helper function để format thời gian từ giây sang dạng "X phút Y giây"
  const formatTimeRemaining = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds} giây`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (remainingSeconds === 0) {
      return `${minutes} phút`;
    }
    return `${minutes} phút ${remainingSeconds} giây`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-900 via-blue-800 to-sky-900 relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden">
          <div className="absolute top-10 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-[100px] animate-float-slow"></div>
          <div className="absolute bottom-10 right-1/4 w-80 h-80 bg-cyan-500/10 rounded-full blur-[80px]"></div>
      </div>

      <div className="relative z-10 w-full max-w-sm px-6">
        <div className="bg-white/10 backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-8 shadow-2xl">
            <div className="text-center mb-8">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-cyan-400 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-blue-500/30">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="white" className="w-8 h-8">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                    </svg>
                </div>
                <h1 className="text-3xl font-extrabold text-white tracking-tight">HR Connect</h1>
                <p className="text-blue-200 text-sm mt-2 font-medium">Hệ thống quản lý nhân sự 4.0</p>
            </div>

            {step === 'email' ? (
              <form onSubmit={handleEmailSubmit} className="space-y-4">
                  <div className="space-y-1">
                      <label className="text-[10px] font-bold text-blue-200 uppercase tracking-widest ml-3">Email</label>
                      <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="block w-full rounded-2xl border-0 bg-black/20 px-5 py-4 text-white placeholder:text-white/30 focus:ring-2 focus:ring-cyan-400 transition-all outline-none"
                          placeholder="ten@congty.com"
                      />
                  </div>
                  {error && (
                    <div className={`text-sm text-center px-4 py-2 rounded-lg ${
                      error.includes('rate limit') || error.includes('quá nhiều') 
                        ? 'text-yellow-300 bg-yellow-500/20 border border-yellow-500/30' 
                        : 'text-red-300 bg-red-500/20'
                    }`}>
                      {error}
                      {(error.includes('rate limit') || error.includes('quá nhiều')) && (
                        <div className="mt-2 text-xs text-yellow-200">
                          💡 <strong>Lưu ý:</strong> Nếu bạn đã nhận được mã OTP từ email trước đó, bạn vẫn có thể sử dụng mã đó để đăng nhập. Chỉ cần nhập email và mã OTP đã nhận được.
                        </div>
                      )}
                    </div>
                  )}
                  <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-4 rounded-2xl text-sm font-bold text-blue-900 bg-white hover:bg-blue-50 shadow-lg shadow-black/20 transition-all active:scale-[0.98] mt-4 disabled:opacity-50"
                  >
                      {loading ? 'Đang gửi OTP...' : 'Gửi mã OTP'}
                  </button>
                  {rateLimitUntil && Date.now() < rateLimitUntil && (
                    <div className="text-xs text-yellow-300 text-center mt-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                      <p className="font-semibold mb-1">⚠️ Rate Limit đang hoạt động</p>
                      <p>Vui lòng đợi {Math.floor(rateLimitCountdown / 60)} phút {rateLimitCountdown % 60} giây.</p>
                      <p className="mt-2 text-yellow-200">
                        💡 <strong>Mẹo:</strong> Nếu bạn đã nhận được mã OTP từ email trước đó, bạn có thể sử dụng mã đó ngay bây giờ mà không cần gửi lại.
                      </p>
                    </div>
                  )}
              </form>
            ) : (
              <form onSubmit={handleOTPSubmit} className="space-y-4">
                  <div className="space-y-1">
                      <label className="text-[10px] font-bold text-blue-200 uppercase tracking-widest ml-3">Mã OTP</label>
                      <input
                          type="text"
                          required
                          value={otp}
                          onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          className="block w-full rounded-2xl border-0 bg-black/20 px-5 py-4 text-white placeholder:text-white/30 focus:ring-2 focus:ring-cyan-400 transition-all outline-none text-center text-2xl tracking-widest font-bold"
                          placeholder="000000"
                          maxLength={6}
                      />
                      <p className="text-xs text-blue-300 text-center mt-2">
                        Mã OTP đã được gửi đến <span className="font-semibold">{email}</span>
                      </p>
                      {timeRemaining > 0 && (
                        <p className="text-xs text-yellow-300 text-center mt-1">
                          ⏱️ Mã OTP còn hiệu lực trong <span className="font-bold">{formatTimeRemaining(timeRemaining)}</span>
                        </p>
                      )}
                      {timeRemaining === 0 && otpExpiresAt && (
                        <p className="text-xs text-red-300 text-center mt-1">
                          ⚠️ Mã OTP đã hết hạn. Vui lòng yêu cầu mã mới.
                        </p>
                      )}
                  </div>
                  {error && (
                    <div className="text-red-300 text-sm text-center bg-red-500/20 px-4 py-2 rounded-lg">
                      {error}
                    </div>
                  )}
                  {otpSent && !error && (
                    <div className="text-green-300 text-sm text-center bg-green-500/20 px-4 py-2 rounded-lg">
                      ✅ Mã OTP mới đã được gửi! Vui lòng kiểm tra email.
                    </div>
                  )}
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-xs text-blue-200">
                    <p className="font-semibold mb-1">📧 Lưu ý:</p>
                    <ul className="list-disc list-inside space-y-1 text-blue-300/80">
                      <li>Mã OTP phải khớp với mã đã được gửi đến email của bạn</li>
                      <li>Mã OTP có hiệu lực trong 5 phút</li>
                      <li>Mỗi mã OTP chỉ sử dụng được một lần</li>
                    </ul>
                  </div>
                  <button
                      type="submit"
                      disabled={loading || otp.length !== 6}
                      className="w-full py-4 rounded-2xl text-sm font-bold text-blue-900 bg-white hover:bg-blue-50 shadow-lg shadow-black/20 transition-all active:scale-[0.98] mt-4 disabled:opacity-50"
                  >
                      {loading ? 'Đang xác thực...' : 'Xác thực OTP'}
                  </button>
                  <div className="flex gap-2 mt-4">
                    <button
                        type="button"
                        onClick={handleBackToEmail}
                        className="flex-1 py-3 rounded-xl text-sm font-medium text-blue-200 bg-white/5 hover:bg-white/10 border border-white/10 transition-all"
                    >
                        Quay lại
                    </button>
                    <button
                        type="button"
                        onClick={handleResendOTP}
                        disabled={loading}
                        className="flex-1 py-3 rounded-xl text-sm font-medium text-blue-200 bg-white/5 hover:bg-white/10 border border-white/10 transition-all disabled:opacity-50"
                    >
                        {loading ? 'Đang gửi...' : 'Gửi lại OTP'}
                    </button>
                  </div>
              </form>
            )}
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  // Kiểm tra environment variables
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  
  // Hiển thị lỗi nếu thiếu environment variables
  if (!supabaseUrl || !supabaseKey) {
    return <EnvError />;
  }

  const [user, setUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState('dashboard');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

  // Sync URL with view
  const updateViewAndURL = (newView: string, replace: boolean = false, userOverride?: User | null) => {
    setCurrentView(newView);
    let path = '/';
    
    // Sử dụng userOverride nếu có, nếu không thì dùng state user
    const currentUser = userOverride !== undefined ? userOverride : user;
    
    // Chỉ có /admin và /employee, / chỉ dành cho login
    if (!currentUser) {
      path = '/'; // Chưa login thì ở trang login
    } else if (newView === 'admin') {
      path = '/admin';
    } else if (currentUser.role === UserRole.ADMIN) {
      path = '/admin';
    } else {
      // EMPLOYEE dùng /employee
      path = '/employee';
    }
    
    if (replace) {
      window.history.replaceState({ view: newView }, '', path);
    } else {
      window.history.pushState({ view: newView }, '', path);
    }
  };

  // Handle browser back/forward
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      const path = window.location.pathname;
      
      // Nếu chưa login, chỉ cho phép ở /
      if (!user) {
        if (path !== '/') {
          window.history.replaceState({}, '', '/');
        }
        return;
      }
      
      // Nếu đã login nhưng ở /, redirect về URL phù hợp với role
      if (path === '/') {
        updateViewAndURL('dashboard', true);
        return;
      }
      
      // Chỉ có /admin và /employee
      if (path === '/admin') {
        if (user.role === UserRole.ADMIN) {
          setCurrentView('admin');
        } else {
          updateViewAndURL('dashboard', true);
        }
      } else if (path === '/employee') {
        // EMPLOYEE dùng /employee
        if (user.role === UserRole.EMPLOYEE) {
          setCurrentView('dashboard');
        } else {
          updateViewAndURL('dashboard', true);
        }
      } else {
        // URL không hợp lệ, redirect về URL phù hợp
        updateViewAndURL('dashboard', true);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [user]);

  // Initialize view from URL on mount
  useEffect(() => {
    const path = window.location.pathname;
    const savedUser = localStorage.getItem('current_user');
    
    if (savedUser) {
      const parsedUser = JSON.parse(savedUser);
      setUser(parsedUser);
      
      // Nếu đã login nhưng ở /, redirect về URL phù hợp với role
      if (path === '/') {
        let redirectPath = '/';
        if (parsedUser.role === UserRole.ADMIN) {
          redirectPath = '/admin';
          setCurrentView('admin');
        } else {
          // EMPLOYEE, HR, MANAGER đều dùng /employee
          redirectPath = '/employee';
          setCurrentView('dashboard');
        }
        window.history.replaceState({ view: 'dashboard' }, '', redirectPath);
        return;
      }
      
      // Kiểm tra URL có khớp với role không
      const isValidRoute = 
        (path === '/admin' && parsedUser.role === UserRole.ADMIN) ||
        (path === '/employee' && parsedUser.role === UserRole.EMPLOYEE);
      
      if (isValidRoute) {
        if (path === '/admin') {
          setCurrentView('admin');
        } else {
          setCurrentView('dashboard');
        }
      } else {
        // URL không khớp với role, redirect về URL đúng
        let redirectPath = '/';
        if (parsedUser.role === UserRole.ADMIN) {
          redirectPath = '/admin';
          setCurrentView('admin');
        } else {
          // EMPLOYEE, HR, MANAGER đều dùng /employee
          redirectPath = '/employee';
          setCurrentView('dashboard');
        }
        window.history.replaceState({ view: 'dashboard' }, '', redirectPath);
      }
    } else {
      // Chưa login, chỉ cho phép ở /
      if (path !== '/') {
        window.history.replaceState({}, '', '/');
      }
    }
  }, []);

  const handleLogin = async (foundUser: User) => {
    setUser(foundUser);
    localStorage.setItem('current_user', JSON.stringify(foundUser));
    // Redirect đến URL phù hợp với role sau khi login
    // Truyền foundUser vào updateViewAndURL để tránh race condition với setUser
    if (foundUser.role === UserRole.ADMIN) {
      updateViewAndURL('admin', true, foundUser);
    } else {
      // EMPLOYEE, HR, MANAGER đều dùng /employee
      updateViewAndURL('dashboard', true, foundUser); // Sẽ tự động redirect đến /employee
    }
  };

  const handleLogout = async () => {
    const { signOut } = await import('./services/auth');
    await signOut();
    setUser(null);
    localStorage.removeItem('current_user');
    // Sau khi logout, về trang login (/)
    window.history.replaceState({}, '', '/');
    setCurrentView('dashboard');
  };

  // Đảm bảo user đã login không thể ở /
  useEffect(() => {
    if (user && window.location.pathname === '/') {
      // User đã login nhưng ở /, redirect về URL phù hợp với role
      if (user.role === UserRole.ADMIN) {
        updateViewAndURL('admin', true);
      } else {
        updateViewAndURL('dashboard', true);
      }
    }
  }, [user]);

  if (!user) return <LoginScreen onLogin={handleLogin} />;

  const renderView = () => {
    switch (currentView) {
      case 'dashboard': return <Dashboard user={user} />;
      case 'checkin': return <CheckIn user={user} />;
      case 'shifts': return <ShiftRegister user={user} />;
      case 'payroll': return <Payroll user={user} />;
      case 'admin': 
        if (user.role !== UserRole.ADMIN) {
          // Redirect non-admin users
          updateViewAndURL('dashboard', true);
          return <Dashboard user={user} />;
        }
        return <AdminPanel user={user} setView={updateViewAndURL} setSelectedEmployeeId={setSelectedEmployeeId} onLogout={handleLogout} />;
      case 'salary-management': 
        if (user.role !== UserRole.ADMIN) {
          updateViewAndURL('dashboard', true);
          return <Dashboard user={user} />;
        }
        return <SalaryManagement user={user} setView={updateViewAndURL} />;
      case 'employee-profile': 
        if (!selectedEmployeeId) {
          return <div className="p-10 text-center text-slate-400">Không tìm thấy nhân viên</div>;
        }
        return <EmployeeProfile employeeId={selectedEmployeeId} currentUser={user} onBack={() => { updateViewAndURL('admin', false); setSelectedEmployeeId(null); }} setView={updateViewAndURL} />;
      default: return <Dashboard user={user} />;
    }
  };

  // Admin có layout riêng (desktop), không cần wrap trong Layout mobile
  if (isAdminRoute(currentView, user.role)) {
    return renderView();
  }

  return (
    <Layout user={user} currentView={currentView} setView={updateViewAndURL} onLogout={handleLogout}>
      <div className="max-w-md mx-auto min-h-full">
        {renderView()}
      </div>
    </Layout>
  );
};

export default App;