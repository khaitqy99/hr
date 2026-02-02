import React, { useState } from 'react';
import { User } from '../types';
import UsersManagement from './admin/UsersManagement';
import AttendanceManagement from './admin/AttendanceManagement';
import LeaveManagement from './admin/LeaveManagement';
import ShiftManagement from './admin/ShiftManagement';
import PayrollManagement from './admin/PayrollManagement';
import ReportsDashboard from './admin/ReportsDashboard';
import SettingsPanel from './admin/SettingsPanel';
import DepartmentsManagement from './admin/DepartmentsManagement';
import HolidaysManagement from './admin/HolidaysManagement';
import SystemConfigManagement from './admin/SystemConfigManagement';
import DataExportManagement from './admin/DataExportManagement';
import NotificationsManagement from './admin/NotificationsManagement';

interface AdminPanelProps {
  user: User;
  setView: (view: string) => void;
  setSelectedEmployeeId: (id: string) => void;
  onLogout?: () => void;
}

type Tab = 'USERS' | 'ATTENDANCE' | 'LEAVE' | 'SHIFT' | 'PAYROLL' | 'REPORTS' | 'DEPARTMENTS' | 'HOLIDAYS' | 'CONFIG' | 'EXPORT' | 'NOTIFICATIONS' | 'SETTINGS';

const AdminPanel: React.FC<AdminPanelProps> = ({ user, setView, setSelectedEmployeeId, onLogout }) => {
  const [activeTab, setActiveTab] = useState<Tab>('USERS');
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = React.useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleEditUser = (emp: User) => {
    setSelectedEmployeeId(emp.id);
    setView('employee-profile');
  };

  const tabs: Array<{ id: Tab; label: string; icon: string; category: 'main' | 'config' }> = [
    { id: 'USERS', label: 'Nhân viên', icon: '👥', category: 'main' },
    { id: 'ATTENDANCE', label: 'Chấm công', icon: '⏰', category: 'main' },
    { id: 'LEAVE', label: 'Nghỉ phép', icon: '🏖️', category: 'main' },
    { id: 'SHIFT', label: 'Đăng ký ca', icon: '📅', category: 'main' },
    { id: 'PAYROLL', label: 'Bảng lương', icon: '💰', category: 'main' },
    { id: 'REPORTS', label: 'Thống kê', icon: '📊', category: 'main' },
    { id: 'DEPARTMENTS', label: 'Phòng ban', icon: '🏢', category: 'config' },
    { id: 'HOLIDAYS', label: 'Ngày lễ', icon: '🎉', category: 'config' },
    { id: 'CONFIG', label: 'Cấu hình', icon: '⚙️', category: 'config' },
    { id: 'NOTIFICATIONS', label: 'Thông báo', icon: '🔔', category: 'config' },
    { id: 'EXPORT', label: 'Xuất/Nhập', icon: '💾', category: 'config' },
    { id: 'SETTINGS', label: 'Hệ thống', icon: '🔧', category: 'config' },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'USERS':
        return <UsersManagement onEditUser={handleEditUser} />;
      case 'ATTENDANCE':
        return <AttendanceManagement />;
      case 'LEAVE':
        return <LeaveManagement />;
      case 'SHIFT':
        return <ShiftManagement />;
      case 'PAYROLL':
        return <PayrollManagement />;
      case 'REPORTS':
        return <ReportsDashboard />;
      case 'DEPARTMENTS':
        return <DepartmentsManagement />;
      case 'HOLIDAYS':
        return <HolidaysManagement />;
      case 'CONFIG':
        return <SystemConfigManagement />;
      case 'NOTIFICATIONS':
        return <NotificationsManagement />;
      case 'EXPORT':
        return <DataExportManagement />;
      case 'SETTINGS':
        return <SettingsPanel />;
      default:
        return <UsersManagement onEditUser={handleEditUser} />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="px-6 h-[73px] border-b border-slate-200 flex flex-col justify-center">
          <h1 className="text-lg font-bold text-slate-800 leading-tight">HR Connect</h1>
          <p className="text-xs text-slate-500 mt-0.5 leading-tight">Quản trị hệ thống</p>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {/* Main Management */}
          <div className="mb-4">
            <p className="text-xs font-bold text-slate-400 uppercase mb-2 px-4">Quản lý</p>
            {tabs.filter(t => t.category === 'main').map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-all mb-1 ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span className="text-lg">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
          
          {/* Configuration */}
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase mb-2 px-4">Cấu hình</p>
            {tabs.filter(t => t.category === 'config').map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-all mb-1 ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span className="text-lg">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </nav>
        <div className="p-4 border-t border-slate-200">
          <div className="flex items-center space-x-3 px-4 py-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-white font-bold text-xs">
              {user.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-800 truncate">{user.name}</p>
              <p className="text-[10px] text-slate-500">{user.role}</p>
            </div>
          </div>
          {onLogout && (
            <button
              onClick={onLogout}
              className="w-full flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
              </svg>
              <span>Đăng xuất</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 px-6 h-[73px] sticky top-0 z-10 flex items-center">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center space-x-4">
              <div>
                <h1 className="text-lg font-bold text-slate-800 leading-tight">
                  {tabs.find(t => t.id === activeTab)?.label || 'Quản lý'}
                </h1>
                <p className="text-xs text-slate-500 mt-0.5 leading-tight">Hệ thống quản lý nhân sự</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="relative" ref={profileMenuRef}>
                <button
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="flex items-center space-x-3 px-4 py-2 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-white font-bold text-xs">
                    {user.name.charAt(0)}
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-bold text-slate-800">{user.name}</p>
                    <p className="text-[10px] text-slate-500">{user.role}</p>
                  </div>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={`w-4 h-4 text-slate-400 transition-transform ${showProfileMenu ? 'rotate-180' : ''}`}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>
                
                {showProfileMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-slate-200 py-2 z-50">
                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        // Navigate to profile if exists
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
                    {onLogout && (
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
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto p-6">
            {/* Key prop forces React to remount component when activeTab changes, ensuring data reload */}
            <div key={activeTab}>
              {renderContent()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
