import React, { useState, useEffect, lazy, Suspense } from 'react';
import { User } from '../types';
import { supabase } from '../services/supabase';
import { isSupabaseAvailable } from '../services/db';
import { useDataEvents } from '../utils/useDataEvents';

const UsersManagement = lazy(() => import('./admin/UsersManagement'));
const AttendanceManagement = lazy(() => import('./admin/AttendanceManagement'));
const ShiftManagement = lazy(() => import('./admin/ShiftManagement'));
const PayrollManagement = lazy(() => import('./admin/PayrollManagement'));
const ReportsDashboard = lazy(() => import('./admin/ReportsDashboard'));
const SettingsPanel = lazy(() => import('./admin/SettingsPanel'));
const DepartmentsManagement = lazy(() => import('./admin/DepartmentsManagement'));
const HolidaysManagement = lazy(() => import('./admin/HolidaysManagement'));
const SystemConfigManagement = lazy(() => import('./admin/SystemConfigManagement'));
const DataExportManagement = lazy(() => import('./admin/DataExportManagement'));
const NotificationsManagement = lazy(() => import('./admin/NotificationsManagement'));

interface AdminPanelProps {
  user: User;
  setView: (view: string, options?: { employeeId?: string }) => void;
  setSelectedEmployeeId: (id: string) => void;
  onLogout?: () => void;
  /** Tab từ URL (path segment), ví dụ 'users', 'attendance' */
  initialTab?: string;
  /** Gọi khi user đổi tab để App cập nhật URL (path segment, ví dụ 'users', 'attendance') */
  onTabChange?: (pathSegment: string) => void;
}

export type Tab = 'USERS' | 'ATTENDANCE' | 'SHIFT' | 'PAYROLL' | 'REPORTS' | 'DEPARTMENTS' | 'HOLIDAYS' | 'CONFIG' | 'EXPORT' | 'NOTIFICATIONS' | 'SETTINGS';

/** Map tab id to URL path segment (e.g. /admin/users) */
export const TAB_TO_PATH: Record<Tab, string> = {
  USERS: 'users',
  ATTENDANCE: 'attendance',
  SHIFT: 'shift',
  PAYROLL: 'payroll',
  REPORTS: 'reports',
  DEPARTMENTS: 'departments',
  HOLIDAYS: 'holidays',
  CONFIG: 'config',
  EXPORT: 'export',
  NOTIFICATIONS: 'notifications',
  SETTINGS: 'settings',
};

const PATH_TO_TAB: Record<string, Tab> = Object.fromEntries(
  (Object.entries(TAB_TO_PATH) as [Tab, string][]).map(([tab, path]) => [path, tab])
);

const DEFAULT_TAB: Tab = 'USERS';

const AdminPanel: React.FC<AdminPanelProps> = ({ user, setView, setSelectedEmployeeId, onLogout, initialTab, onTabChange }) => {
  const tabFromUrl = (initialTab && PATH_TO_TAB[initialTab]) ? PATH_TO_TAB[initialTab] : DEFAULT_TAB;
  const [activeTab, setActiveTab] = useState<Tab>(tabFromUrl);

  // Đồng bộ tab khi URL thay đổi (back/forward)
  React.useEffect(() => {
    setActiveTab(tabFromUrl);
  }, [initialTab, tabFromUrl]);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = React.useRef<HTMLDivElement>(null);
  const reloadHandlerRef = React.useRef<(() => void) | null>(null);
  const [isReloading, setIsReloading] = React.useState(false);
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
    setView('employee-profile', { employeeId: emp.id });
  };

  const iconClass = 'w-5 h-5 shrink-0';
  const tabs: Array<{ id: Tab; label: string; icon: React.ReactNode; category: 'main' | 'config' }> = [
    { id: 'USERS', label: 'Nhân viên', icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={iconClass}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>, category: 'main' },
    { id: 'ATTENDANCE', label: 'Chấm công', icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={iconClass}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>, category: 'main' },
    { id: 'SHIFT', label: 'Đăng ký ca', icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={iconClass}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" /></svg>, category: 'main' },
    { id: 'PAYROLL', label: 'Bảng lương', icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={iconClass}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" /></svg>, category: 'main' },
    { id: 'REPORTS', label: 'Thống kê', icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={iconClass}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>, category: 'main' },
    { id: 'DEPARTMENTS', label: 'Phòng ban', icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={iconClass}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" /></svg>, category: 'config' },
    { id: 'HOLIDAYS', label: 'Ngày lễ', icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={iconClass}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-9.75h.008v.008H12v-.008zm0 3h.008v.008H12V15zm0 3h.008v.008H12V18zm-2.25-4.5h.008v.008H9.75V13.5zm0 3h.008v.008H9.75V16.5zm0 3h.008v.008H9.75V19.5zm2.25-6h.008v.008H12V13.5zm0 3h.008v.008H12V16.5zm0 3h.008v.008H12V19.5zm2.25-6h.008v.008H14.25V13.5zm0 3h.008v.008H14.25V16.5zm0 3h.008v.008H14.25V19.5zm2.25-6h.008v.008H16.5V13.5zm0 3h.008v.008H16.5V16.5zm0 3h.008v.008H16.5V19.5z" /></svg>, category: 'config' },
    { id: 'CONFIG', label: 'Cấu hình', icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={iconClass}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>, category: 'config' },
    { id: 'NOTIFICATIONS', label: 'Thông báo', icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={iconClass}><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg>, category: 'config' },
    { id: 'EXPORT', label: 'Xuất/Nhập', icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={iconClass}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>, category: 'config' },
    { id: 'SETTINGS', label: 'Hệ thống', icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={iconClass}><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>, category: 'config' },
  ];

  const handleReload = async () => {
    if (reloadHandlerRef.current) {
      setIsReloading(true);
      try {
        await reloadHandlerRef.current();
      } finally {
        setIsReloading(false);
      }
    }
  };

  const registerReloadHandler = React.useCallback((handler: () => void | Promise<void>) => {
    reloadHandlerRef.current = handler;
  }, []);

  // Reset reload handler when tab changes
  React.useEffect(() => {
    reloadHandlerRef.current = null;
  }, [activeTab]);

  // Supabase Realtime: cập nhật AdminPanel khi bất kỳ bảng nào thay đổi (multi-admin sync)
  useEffect(() => {
    if (!isSupabaseAvailable()) return;
    const reload = () => {
      if (reloadHandlerRef.current) {
        reloadHandlerRef.current().catch(() => {});
      }
    };
    const channel = supabase
      .channel('admin-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_records' }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shift_registrations' }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payroll_records' }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'departments' }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'holidays' }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'system_configs' }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, reload)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Backup: data events khi app trong session này thay đổi
  useDataEvents(
    [
      'users:created', 'users:updated', 'users:deleted',
      'attendance:created', 'attendance:updated', 'attendance:deleted',
      'shifts:created', 'shifts:updated', 'shifts:deleted',
      'payroll:created', 'payroll:updated', 'payroll:deleted',
      'departments:created', 'departments:updated', 'departments:deleted',
      'holidays:created', 'holidays:updated', 'holidays:deleted',
      'config:updated',
      'notifications:created', 'notifications:updated',
    ],
    async () => {
      // Tự động reload tab hiện tại khi có thay đổi dữ liệu
      if (reloadHandlerRef.current) {
        try {
          await reloadHandlerRef.current();
        } catch (error) {
          console.error('Error reloading data after event:', error);
        }
      }
    }
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'USERS':
        return <UsersManagement onEditUser={handleEditUser} onRegisterReload={registerReloadHandler} />;
      case 'ATTENDANCE':
        return <AttendanceManagement onRegisterReload={registerReloadHandler} setView={setView} />;
      case 'SHIFT':
        return <ShiftManagement onRegisterReload={registerReloadHandler} setView={setView} />;
      case 'PAYROLL':
        return <PayrollManagement onRegisterReload={registerReloadHandler} setView={setView} />;
      case 'REPORTS':
        return <ReportsDashboard onRegisterReload={registerReloadHandler} setView={setView} />;
      case 'DEPARTMENTS':
        return <DepartmentsManagement onRegisterReload={registerReloadHandler} />;
      case 'HOLIDAYS':
        return <HolidaysManagement onRegisterReload={registerReloadHandler} />;
      case 'CONFIG':
        return <SystemConfigManagement onRegisterReload={registerReloadHandler} />;
      case 'NOTIFICATIONS':
        return <NotificationsManagement onRegisterReload={registerReloadHandler} />;
      case 'EXPORT':
        return <DataExportManagement onRegisterReload={registerReloadHandler} />;
      case 'SETTINGS':
        return <SettingsPanel onRegisterReload={registerReloadHandler} />;
      default:
        return <UsersManagement onEditUser={handleEditUser} onRegisterReload={registerReloadHandler} />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <div className="bg-white border-r border-slate-200 flex flex-col shrink-0 w-52">
        <div className="h-[56px] border-b border-slate-200 flex items-center shrink-0 px-4 gap-2.5">
          <img src="/logo.png" alt="Y99 HR Logo" className="h-7 w-7 object-contain flex-shrink-0" />
          <div className="flex flex-col justify-center min-w-0">
            <h1 className="text-base font-bold text-slate-800 leading-tight">Y99 HR</h1>
            <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">Quản trị hệ thống</p>
          </div>
        </div>
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto overflow-x-hidden">
          {/* Main Management */}
          <div className="mb-4">
            <p className="text-xs font-bold text-slate-400 uppercase mb-2 px-4">Quản lý</p>
            {tabs.filter(t => t.category === 'main').map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  onTabChange?.(TAB_TO_PATH[tab.id]);
                }}
                title={tab.label}
                className={`w-full flex items-center rounded-xl text-sm font-medium mb-1 min-h-[44px] py-3 pl-4 pr-4 ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span className="flex items-center justify-center text-current shrink-0 w-5 h-5">{tab.icon}</span>
                <span className="whitespace-nowrap ml-3">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Configuration */}
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase mb-2 px-4">Cấu hình</p>
            {tabs.filter(t => t.category === 'config').map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  onTabChange?.(TAB_TO_PATH[tab.id]);
                }}
                title={tab.label}
                className={`w-full flex items-center rounded-xl text-sm font-medium mb-1 min-h-[44px] py-3 pl-4 pr-4 ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span className="flex items-center justify-center text-current shrink-0 w-5 h-5">{tab.icon}</span>
                <span className="whitespace-nowrap ml-3">{tab.label}</span>
              </button>
            ))}
          </div>
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 px-4 h-[56px] sticky top-0 z-10 flex items-center">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center space-x-3">
              <div>
                <h1 className="text-base font-bold text-slate-800 leading-tight">
                  {tabs.find(t => t.id === activeTab)?.label || 'Quản lý'}
                </h1>
                <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">Hệ thống quản lý nhân sự</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={handleReload}
                disabled={isReloading || !reloadHandlerRef.current}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isReloading || !reloadHandlerRef.current
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                }`}
                title="Tải lại dữ liệu mới nhất"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  className={`w-4 h-4 ${isReloading ? 'animate-spin' : ''}`}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
                  />
                </svg>
                <span>{isReloading ? 'Đang tải...' : 'Tải lại'}</span>
              </button>
              <div className="relative" ref={profileMenuRef}>
                <button
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="flex items-center space-x-2 px-3 py-1.5 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-white font-bold text-[10px]">
                    {user.name.charAt(0)}
                  </div>
                  <div className="text-left">
                    <p className="text-[11px] font-bold text-slate-800">{user.name}</p>
                    <p className="text-[9px] text-slate-500">{user.role}</p>
                  </div>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={`w-3.5 h-3.5 text-slate-400 transition-transform ${showProfileMenu ? 'rotate-180' : ''}`}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>
                
                {showProfileMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-slate-200 py-2 z-50">
                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        setView('employee-profile', { employeeId: user.id });
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
          <div className="w-full p-6">
            <Suspense fallback={<div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" /></div>}>
              <div key={activeTab}>
                {renderContent()}
              </div>
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
