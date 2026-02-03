import React, { useState, useEffect } from 'react';
import { Notification, User } from '../types';
import { getNotifications, markNotificationAsRead } from '../services/db';
import {
  isPushNotificationSupported,
  isPushSupportedOnOrigin,
  getNotificationPermission,
  requestNotificationPermission,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  getUserPushSubscriptions,
  togglePushNotifications,
  resetPushAndServiceWorker,
} from '../services/push-notifications';

interface NotificationsPanelProps {
  user: User;
}

const NotificationsPanel: React.FC<NotificationsPanelProps> = ({ user }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);

  useEffect(() => {
    loadNotifications();
    checkPushSupport();
    loadPushStatus();
    // Reload notifications every 30 seconds
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [user.id]);

  const checkPushSupport = () => {
    setPushSupported(isPushNotificationSupported());
  };

  const loadPushStatus = async () => {
    if (!pushSupported) return;
    
    try {
      const subscriptions = await getUserPushSubscriptions(user.id);
      const permission = await getNotificationPermission();
      setPushEnabled(subscriptions.length > 0 && permission === 'granted');
    } catch (error) {
      console.error('Error loading push status:', error);
    }
  };

  const handleTogglePush = async () => {
    if (!pushSupported) {
      alert('Trình duyệt của bạn không hỗ trợ push notifications');
      return;
    }

    setPushError(null);
    setPushLoading(true);
    try {
      if (pushEnabled) {
        await unsubscribeFromPushNotifications(user.id);
        setPushEnabled(false);
        alert('Đã tắt thông báo đẩy');
      } else {
        const permission = await getNotificationPermission();
        if (permission !== 'granted') {
          const newPermission = await requestNotificationPermission();
          if (newPermission !== 'granted') {
            alert('Cần quyền thông báo để nhận thông báo đẩy. Vui lòng bật trong cài đặt trình duyệt.');
            setPushLoading(false);
            return;
          }
        }

        await subscribeToPushNotifications(user.id);
        setPushEnabled(true);
        setPushError(null);
        alert('Đã bật thông báo đẩy thành công!');
      }
    } catch (error: any) {
      const msg = error?.message || 'Có lỗi xảy ra khi thay đổi cài đặt thông báo đẩy';
      console.error('Error toggling push notifications:', error);
      setPushError(msg);
      alert(msg);
    } finally {
      setPushLoading(false);
    }
  };

  const handleResetPushAndRetry = async () => {
    setPushError(null);
    setPushLoading(true);
    try {
      await resetPushAndServiceWorker();
      window.location.reload();
    } catch (e) {
      setPushError('Không thể reset. Thử đóng trình duyệt và mở lại.');
      setPushLoading(false);
    }
  };

  const loadNotifications = async () => {
    try {
      const data = await getNotifications(user.id);
      setNotifications(data);
    } catch (error) {
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
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const unreadNotifications = notifications.filter(n => !n.read);
      await Promise.all(unreadNotifications.map(n => markNotificationAsRead(n.id)));
      setNotifications(prev => prev.map(notif => ({ ...notif, read: true })));
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
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
          {pushSupported && (
            <>
              <button
                onClick={handleTogglePush}
                disabled={pushLoading}
                className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors flex items-center space-x-2 ${
                  pushEnabled
                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                } ${pushLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
              {pushLoading ? (
                <>
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Đang xử lý...</span>
                </>
              ) : (
                <>
                  {pushEnabled ? (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-1.915 0-3.423.9-4.415 2.243l-.896 1.341-.896-1.341C10.975 2.9 9.467 2 7.552 2H7.4z" />
                      </svg>
                      <span>Đã bật</span>
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                      </svg>
                      <span>Bật thông báo đẩy</span>
                    </>
                  )}
                </>
              )}
            </button>
              {!isPushSupportedOnOrigin() && !pushEnabled && (
                <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-lg">
                  Chỉ khả dụng trên HTTPS (vd: hr.y99.info)
                </span>
              )}
            </>
          )}
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

      {/* Push error + reset */}
      {pushError && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-sm text-amber-800 flex-1">{pushError}</p>
          <button
            type="button"
            onClick={handleResetPushAndRetry}
            disabled={pushLoading}
            className="flex-shrink-0 px-4 py-2 text-sm font-medium text-amber-800 bg-amber-100 rounded-xl hover:bg-amber-200 transition-colors disabled:opacity-50"
          >
            Xóa cache SW và tải lại
          </button>
        </div>
      )}

      {/* Notifications List */}
      {notifications.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-sky-50 p-12 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8 text-slate-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
            </svg>
          </div>
          <p className="text-slate-400 font-medium">Chưa có thông báo nào</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((notif) => (
            <div
              key={notif.id}
              className={`bg-white rounded-2xl shadow-sm border-2 p-4 transition-all hover:shadow-md ${
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default NotificationsPanel;
