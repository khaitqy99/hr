import React from 'react';
import { User } from '../types';

interface AdminLayoutProps {
  user: User;
  children: React.ReactNode;
  onLogout?: () => void;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ user, children, onLogout }) => {
  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-6 border-b border-slate-200">
          <h1 className="text-xl font-bold text-slate-800">HR Connect</h1>
          <p className="text-xs text-slate-500 mt-1">Quản trị hệ thống</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {/* Sidebar content sẽ được render bởi children */}
        </div>
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
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  );
};

export default AdminLayout;
