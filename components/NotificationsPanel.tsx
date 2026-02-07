import React, { useState, useEffect } from 'react';
import type { Notification, User } from '../types';
import { getNotifications, markNotificationAsRead } from '../services/db';
import { sendLocalNotification, getNotificationPermission } from '../services/push';
import { supabase } from '../services/supabase';
import { isSupabaseAvailable } from '../services/db';

interface NotificationsPanelProps {
  user: User;
  setView?: (view: string, options?: { replace?: boolean; adminPath?: string; employeeId?: string }) => void;
}

const NotificationsPanel: React.FC<NotificationsPanelProps> = ({ user, setView }) => {
  // Helper function để xác định view cần điều hướng dựa trên nội dung notification
  const getNotificationAction = (notif: Notification): { view: string; options?: any } | null => {
    const title = notif.title.toLowerCase();
    const message = notif.message.toLowerCase();

    // Đăng ký ca
    if (title.includes('đăng ký ca') || title.includes('ca làm việc') || message.includes('đăng ký ca')) {
      return { view: 'shifts' };
    }

    // Chấm công
    if (title.includes('chấm công') || message.includes('chấm công')) {
      return { view: 'checkin' };
    }

    // Bảng lương
    if (title.includes('lương') || title.includes('payroll') || message.includes('bảng lương')) {
      return { view: 'payroll' };
    }

    // Admin views
    if (user.role === 'ADMIN') {
      if (title.includes('nhân viên') || message.includes('nhân viên')) {
        return { view: 'admin', options: { adminPath: 'users' } };
      }
      if (title.includes('chấm công') || message.includes('chấm công')) {
        return { view: 'admin', options: { adminPath: 'attendance' } };
      }
      if (title.includes('ca') || message.includes('ca')) {
        return { view: 'admin', options: { adminPath: 'shift' } };
      }
      if (title.includes('lương') || message.includes('lương')) {
        return { view: 'admin', options: { adminPath: 'payroll' } };
      }
    }

    return null;
  };

  const handleNotificationClick = (notif: Notification) => {
    if (!setView) return;
    const action = getNotificationAction(notif);
    if (action) {
      setView(action.view, action.options);
    }
  };
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadNotifications();
    // Reload notifications every 60 seconds (tăng từ 30s để giảm số lượng requests)
    // Chỉ reload khi tab đang active để tránh lãng phí tài nguyên
    let interval: NodeJS.Timeout | null = null;
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (interval) {
          clearInterval(interval);
          interval = null;
        }
      } else {
        loadNotifications();
        interval = setInterval(loadNotifications, 60000); // 60 giây
      }
    };
    
    if (!document.hidden) {
      interval = setInterval(loadNotifications, 60000); // 60 giây
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      if (interval) clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user.id]);

  // Supabase Realtime subscription để nhận notifications real-time (giống zenpush)
  useEffect(() => {
    if (!isSupabaseAvailable() || !user) return;

    console.log('🔔 [HR] Setting up Supabase Realtime subscription for notifications...');

    // Subscribe to notifications table changes
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          console.log('📨 [HR] Realtime notification received:', payload);
          const newNotification = payload.new as any;
          
          // Hiển thị push notification NGAY LẬP TỨC (giống zenpush)
          const permission = getNotificationPermission();
          if (permission === 'granted') {
            try {
              await sendLocalNotification({
                title: newNotification.title,
                body: newNotification.message,
                icon: '/icon-192.png',
                url: '/employee/notifications',
                tag: `notification-${newNotification.id}`,
                data: {
                  notificationId: newNotification.id,
                  type: newNotification.type,
                },
              });
            } catch (error) {
              console.error('❌ [HR] Error showing push notification:', error);
            }
          }
          
          // Sau đó reload notifications để cập nhật UI
          loadNotifications();
        }
      )
      .subscribe((status) => {
        console.log('🔔 [HR] Realtime subscription status:', status);
      });

    return () => {
      console.log('🔔 [HR] Cleaning up Realtime subscription');
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const loadNotifications = async () => {
    try {
      setError(null);
      const data = await getNotifications(user.id);
      setNotifications(data);
    } catch (error: any) {
      const errorMessage = 'Không thể tải thông báo: ' + (error?.message || 'Vui lòng thử lại');
      setError(errorMessage);
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      await markNotificationAsRead(id);
      setNotifications(prev => 
        prev.map(notif => notif.id === id ? { ...notif, read: true } : notif)
      );
    } catch (error: any) {
      console.error('Error marking notification as read:', error);
      // Hiển thị error cho user
      alert('Không thể đánh dấu đã đọc: ' + (error?.message || 'Vui lòng thử lại'));
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const unreadNotifications = notifications.filter(n => !n.read);
      await Promise.all(unreadNotifications.map(n => markNotificationAsRead(n.id)));
      setNotifications(prev => prev.map(notif => ({ ...notif, read: true })));
    } catch (error: any) {
      console.error('Error marking all notifications as read:', error);
      // Hiển thị error cho user
      alert('Không thể đánh dấu tất cả đã đọc: ' + (error?.message || 'Vui lòng thử lại'));
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'success':
        return 'bg-green-100 text-green-600 border-green-200';
      case 'warning':
        return 'bg-yellow-100 text-yellow-600 border-yellow-200';
      case 'error':
        return 'bg-red-100 text-red-600 border-red-200';
      default:
        return 'bg-blue-100 text-blue-600 border-blue-200';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'success':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
          </svg>
        );
      case 'warning':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        );
      case 'error':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default:
        return (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
          </svg>
        );
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'success':
        return 'Thành công';
      case 'warning':
        return 'Cảnh báo';
      case 'error':
        return 'Lỗi';
      default:
        return 'Thông tin';
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-800">Thông báo</h2>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-sky-50 p-8 text-center">
          <p className="text-slate-400 font-medium">Đang tải thông báo...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Thông báo</h2>
          {unreadCount > 0 && (
            <p className="text-sm text-slate-500 mt-1">
              Bạn có <span className="font-bold text-blue-600">{unreadCount}</span> thông báo chưa đọc
            </p>
          )}
        </div>
        <div className="flex items-center space-x-3 flex-wrap gap-2">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors"
            >
              Đánh dấu tất cả đã đọc
            </button>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm text-red-600 font-medium">{error}</p>
          <button
            onClick={loadNotifications}
            className="mt-2 text-xs text-red-600 hover:text-red-700 underline"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* Notifications List */}
      {notifications.length === 0 && !error ? (
        <div className="bg-white rounded-2xl shadow-sm border border-sky-50 p-12 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8 text-slate-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
            </svg>
          </div>
          <p className="text-slate-400 font-medium">Chưa có thông báo nào</p>
        </div>
      ) : notifications.length > 0 ? (
        <div className="space-y-3">
          {notifications.map((notif) => {
            const hasAction = setView && getNotificationAction(notif) !== null;
            return (
            <div
              key={notif.id}
              onClick={() => hasAction && handleNotificationClick(notif)}
              className={`bg-white rounded-2xl shadow-sm border-2 p-4 transition-all ${
                hasAction ? 'cursor-pointer hover:shadow-md' : ''
              } ${
                notif.read 
                  ? 'border-slate-100 opacity-75' 
                  : 'border-blue-200 bg-blue-50/30'
              }`}
            >
              <div className="flex items-start space-x-3">
                {/* Icon */}
                <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${getTypeColor(notif.type)}`}>
                  {getTypeIcon(notif.type)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex-1">
                      <h3 className="text-sm font-bold text-slate-800 mb-1">{notif.title}</h3>
                      <p className="text-xs text-slate-500 mb-2">{notif.message}</p>
                    </div>
                    {!notif.read && (
                      <button
                        onClick={() => handleMarkAsRead(notif.id)}
                        className="flex-shrink-0 ml-2 text-xs font-medium text-blue-600 hover:text-blue-700 px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors"
                      >
                        Đánh dấu đã đọc
                      </button>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center space-x-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${getTypeColor(notif.type)}`}>
                        {getTypeLabel(notif.type)}
                      </span>
                      {!notif.read && (
                        <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                      )}
                    </div>
                    <span className="text-xs text-slate-400">
                      {new Date(notif.timestamp).toLocaleString('vi-VN', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                </div>
              </div>
              {hasAction && (
                <div className="mt-2 pt-2 border-t border-slate-100">
                  <span className="text-xs text-blue-600 font-medium">Nhấn để xem chi tiết →</span>
                </div>
              )}
            </div>
          );
          })}
        </div>
      ) : null}
    </div>
  );
};

export default NotificationsPanel;
