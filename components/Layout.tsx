import React, { useState, useRef, useEffect } from 'react';
import { User, UserRole } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  user: User;
  currentView: string;
  setView: (view: string) => void;
  onLogout: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, user, currentView, setView, onLogout }) => {
  // Swipe Logic State
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);
  const minSwipeDistance = 80; // px required to trigger swipe
  const maxVerticalRatio = 0.5; // vuốt ngang phải rõ: |dx| > |dy| * (1/0.5) = 2 lần

  // Animation Direction State
  const [animClass, setAnimClass] = useState('fade-up');
  
  // Profile Menu State
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Define View Order
  // Admin chỉ có các tab quản lý, không có tab chức năng nhân viên
  // Nhân viên có các tab chức năng nhân viên
  let views: string[];
  if (user.role === UserRole.ADMIN) {
    views = ['admin', 'salary-management'];
  } else {
    // Nhân viên có các tab chức năng nhân viên (không có tab nghỉ phép - chỉ admin quản lý)
    views = ['dashboard', 'checkin', 'shifts', 'payroll', 'notifications'];
  }

  // Wrapper to set view and calculate animation direction instantly
  const handleSetView = (newView: string) => {
    if (newView === currentView) return;
    
    const prevIndex = views.indexOf(currentView);
    const currIndex = views.indexOf(newView);

    if (currIndex > prevIndex) {
        setAnimClass('animate-enter-right');
    } else {
        setAnimClass('animate-enter-left');
    }
    setView(newView);
  };

  // Tối ưu touch events cho iOS - sử dụng passive listeners khi có thể
  const onTouchStart = (e: React.TouchEvent) => {
    // Chỉ xử lý nếu không phải scroll
    if (e.target instanceof HTMLElement && e.target.closest('.no-scrollbar')) {
      setTouchEnd(null);
      const t = e.targetTouches[0];
      if (t) {
        setTouchStart({ x: t.clientX, y: t.clientY });
      }
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    // Chỉ update nếu đã có touchStart
    if (touchStart) {
      const t = e.targetTouches[0];
      if (t) {
        setTouchEnd({ x: t.clientX, y: t.clientY });
      }
    }
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const dx = touchStart.x - touchEnd.x;
    const dy = touchStart.y - touchEnd.y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    // Chỉ coi là vuốt ngang khi: khoảng cách ngang đủ lớn VÀ ngang rõ hơn dọc
    const isHorizontalSwipe = absDx >= minSwipeDistance && absDx >= absDy / maxVerticalRatio;
    const isLeftSwipe = isHorizontalSwipe && dx > 0;
    const isRightSwipe = isHorizontalSwipe && dx < 0;

    const currentIndex = views.indexOf(currentView);

    if (isLeftSwipe) {
        // Go Next (Swipe Left -> Content comes from Right)
        if (currentIndex < views.length - 1) {
            handleSetView(views[currentIndex + 1]);
        }
    }

    if (isRightSwipe) {
        // Go Back (Swipe Right -> Content comes from Left)
        if (currentIndex > 0) {
            handleSetView(views[currentIndex - 1]);
        }
    }
  };

  // Sliding pill: vị trí theo tab đang active
  const navContainerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [indicatorPos, setIndicatorPos] = useState({ left: 0, top: 0, width: 48, height: 48 });

  // Tối ưu updateIndicatorPos với requestAnimationFrame để tránh lag trên iOS
  const updateIndicatorPos = () => {
    requestAnimationFrame(() => {
      const idx = views.indexOf(currentView);
      const btn = itemRefs.current[idx];
      const container = navContainerRef.current;
      if (btn && container) {
        const cr = container.getBoundingClientRect();
        const br = btn.getBoundingClientRect();
        // Trừ border của container vì pill được đặt relative to padding edge
        const borderLeft = container.clientLeft || 0;
        const borderTop = container.clientTop || 0;
        setIndicatorPos({
          left: br.left - cr.left - borderLeft,
          top: br.top - cr.top - borderTop,
          width: br.width,
          height: br.height,
        });
      }
    });
  };

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(updateIndicatorPos);
    });
    const lateUpdate = setTimeout(updateIndicatorPos, 120);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(lateUpdate);
    };
  }, [currentView, views.length]);

  // Debounce resize để tránh lag trên iOS
  useEffect(() => {
    let resizeTimeout: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        updateIndicatorPos();
      }, 150); // Debounce 150ms
    };
    window.addEventListener('resize', handleResize, { passive: true });
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimeout);
    };
  }, [currentView, views.length]);

  // Tắt menu nhấn giữ & chọn text (giống app mobile), trừ input/textarea
  useEffect(() => {
    const allowTarget = (el: EventTarget | null) => {
      if (!el || !(el instanceof HTMLElement)) return false;
      return !!el.closest('input, textarea, [contenteditable="true"]');
    };
    const onContextMenu = (e: Event) => {
      if (!allowTarget(e.target)) e.preventDefault();
    };
    const onSelectStart = (e: Event) => {
      if (!allowTarget(e.target)) e.preventDefault();
    };
    document.addEventListener('contextmenu', onContextMenu, { passive: false });
    document.addEventListener('selectstart', onSelectStart, { passive: false });
    return () => {
      document.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('selectstart', onSelectStart);
    };
  }, []);

  // Nav config theo role
  const navConfig: { view: string; label: string; icon: React.ReactNode }[] = [];
  
  if (user.role === UserRole.ADMIN) {
    // Admin chỉ có các tab quản lý
    navConfig.push(
      { view: 'admin', label: 'Quản lý', icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" /></svg> },
      { view: 'salary-management', label: 'Tính lương', icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" /></svg> }
    );
  } else {
    // Nhân viên có các tab chức năng nhân viên (không có tab nghỉ phép - chỉ admin quản lý)
    navConfig.push(
      { view: 'dashboard', label: 'Trang chủ', icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg> },
      { view: 'checkin', label: 'Chấm công', icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
      { view: 'shifts', label: 'Lịch làm', icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg> },
      { view: 'payroll', label: 'Lương', icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
      { view: 'notifications', label: 'Thông báo', icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg> }
    );
  }

  const NavItem = React.memo(({ view, icon, label, index }: { view: string; icon: React.ReactNode; label: string; index: number }) => {
    const isActive = currentView === view;
    return (
      <button
        ref={(el) => { itemRefs.current[index] = el; }}
        type="button"
        onClick={() => handleSetView(view)}
        title={label}
        className={`nav-item relative flex items-center justify-center h-12 min-w-[3rem] select-none touch-manipulation z-10 rounded-full ${
          isActive
            ? 'w-12 sm:flex-grow sm:w-auto sm:px-5'
            : 'w-12 hover:bg-sky-50 active:scale-95'
        }`}
      >
        <div className={`nav-icon flex items-center justify-center shrink-0 w-6 h-6 leading-none [&_svg]:block [&_svg]:shrink-0 ${isActive ? 'scale-100 text-white translate-y-0' : 'scale-90 text-slate-400'}`}>
          {icon}
        </div>
        <span
          className={`nav-label whitespace-nowrap overflow-hidden font-bold text-xs text-white ${
            isActive
              ? 'hidden sm:inline sm:max-w-[100px] sm:ml-2 opacity-100 translate-x-0'
              : 'max-w-0 ml-0 opacity-0 -translate-x-2'
          }`}
        >
          {label}
        </span>
      </button>
    );
  });

  // Admin có layout riêng (desktop với sidebar), không cần layout mobile
  if (user.role === UserRole.ADMIN && (currentView === 'admin' || currentView === 'salary-management')) {
    return <>{children}</>;
  }

  return (
    <div className="flex flex-col h-screen bg-sky-50/50 overflow-hidden">
      {/* Header - Glassmorphism */}
      <header className="px-5 py-2.5 flex justify-between items-center sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-sky-100/50">
        <div className="flex items-center space-x-2.5">
          <div className="relative">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 p-[2px] shadow-lg shadow-blue-200/50">
                <div className="w-full h-full rounded-full bg-white flex items-center justify-center text-blue-700 font-extrabold text-xs">
                {user.name.charAt(0)}
                </div>
            </div>
            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 border-2 border-white rounded-full"></div>
          </div>
          <div className="flex flex-col">
            <h1 className="text-xs font-bold text-slate-800 leading-tight">{user.name}</h1>
            <span className="text-[9px] font-semibold text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded-full w-fit mt-0.5">
                {user.role}
            </span>
          </div>
        </div>
        <div className="relative" ref={profileMenuRef}>
          <button 
            onClick={() => setShowProfileMenu(!showProfileMenu)} 
            className="p-2 rounded-full text-slate-400 hover:text-blue-500 hover:bg-blue-50 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          
          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-slate-200 py-2 z-50">
              <button
                onClick={() => {
                  setShowProfileMenu(false);
                  // Navigate to profile if exists, or just close menu
                }}
                className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center space-x-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
                <span>Xem hồ sơ</span>
              </button>
              <button
                onClick={() => {
                  setShowProfileMenu(false);
                  // Navigate to settings if exists
                }}
                className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center space-x-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>Cài đặt</span>
              </button>
              <hr className="my-2 border-slate-200" />
              <button
                onClick={() => {
                  setShowProfileMenu(false);
                  onLogout();
                }}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                </svg>
                <span>Đăng xuất</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content with Swipe Handlers & Animation Wrapper */}
      <main 
        className="flex-1 overflow-y-auto px-5 pb-32 pt-4 no-scrollbar touch-pan-y overflow-x-hidden"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          // Tối ưu scroll performance trên iOS
          WebkitOverflowScrolling: 'touch',
          // Force GPU acceleration cho scroll
          transform: 'translateZ(0)',
        }}
      >
        {/* Using key={currentView} forces React to destroy and recreate this div, triggering the CSS animation */}
        {/* Tối ưu: chỉ dùng will-change khi đang animate, không dùng liên tục */}
        <div key={currentView} className={`w-full min-h-full ${animClass}`} style={{
          // Chỉ enable will-change khi đang có animation
          willChange: animClass !== 'fade-up' ? 'transform, opacity' : 'auto',
        }}>
            {children}
        </div>
      </main>

      {/* Bottom Navigation - Pill trượt khi chuyển tab, safe-area cho iOS notch */}
      <nav className="fixed left-1/2 -translate-x-1/2 w-[92%] max-w-[400px] z-40" style={{ bottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
        <div ref={navContainerRef} className="nav-bar-wrap relative bg-white/90 backdrop-blur-2xl rounded-full shadow-[0_20px_40px_-12px_rgba(0,0,0,0.12)] border-2 border-sky-200 p-1.5 flex justify-between items-center gap-0.5">
          {/* Pill trượt theo tab active — blue/cyan đồng bộ với dự án */}
          <div
            className="nav-sliding-pill absolute left-0 top-0 rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 shadow-lg shadow-blue-500/30 pointer-events-none"
            style={{
              transform: `translate(${indicatorPos.left}px, ${indicatorPos.top}px)`,
              width: indicatorPos.width,
              height: indicatorPos.height,
              transition: 'transform 0.32s cubic-bezier(0.4, 0, 0.2, 1), width 0.32s cubic-bezier(0.4, 0, 0.2, 1), height 0.32s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          />
          {navConfig.map((item, index) => (
            <NavItem key={item.view} view={item.view} label={item.label} icon={item.icon} index={index} />
          ))}
        </div>
      </nav>
    </div>
  );
};

export default Layout;