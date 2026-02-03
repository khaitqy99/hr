import React, { useState, useEffect } from 'react';
import { Notification, User, UserRole } from '../../types';
import { getAllUsers, getAllNotifications, createNotification, deleteNotification } from '../../services/db';

const NotificationsManagement: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    userId: 'ALL',
    title: '',
    message: '',
    type: 'info' as 'info' | 'warning' | 'success' | 'error',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const users = await getAllUsers();
    setEmployees(users);
    const allNotifications = await getAllNotifications();
    setNotifications(allNotifications);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.message.trim()) {
      alert('Tiêu đề và nội dung là bắt buộc');
      return;
    }

    try {
      if (formData.userId === 'ALL') {
        // Send to all employees
        const employeesToNotify = employees.filter(e => e.role !== UserRole.ADMIN);
        for (const emp of employeesToNotify) {
          await createNotification({
            userId: emp.id,
            title: formData.title.trim(),
            message: formData.message.trim(),
            read: false,
            timestamp: Date.now(),
            type: formData.type,
          });
        }
      } else {
        // Send to specific user
        await createNotification({
          userId: formData.userId,
          title: formData.title.trim(),
          message: formData.message.trim(),
          read: false,
          timestamp: Date.now(),
          type: formData.type,
        });
      }

      loadData();
      resetForm();
      alert('Gửi thông báo thành công!');
    } catch (error: any) {
      alert(error?.message || 'Có lỗi xảy ra khi gửi thông báo');
    }
  };

  const resetForm = () => {
    setFormData({
      userId: 'ALL',
      title: '',
      message: '',
      type: 'info',
    });
    setShowForm(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Bạn có chắc muốn xóa thông báo này?')) {
      try {
        await deleteNotification(id);
        loadData();
      } catch (error: any) {
        alert(error?.message || 'Có lỗi xảy ra khi xóa thông báo');
      }
    }
  };

  const getUserName = (userId: string) => {
    const user = employees.find(e => e.id === userId);
    return user?.name || userId;
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'success':
        return 'bg-green-100 text-green-600';
      case 'warning':
        return 'bg-yellow-100 text-yellow-600';
      case 'error':
        return 'bg-red-100 text-red-600';
      default:
        return 'bg-blue-100 text-blue-600';
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800">Quản lý thông báo</h2>
        <button
          onClick={() => setShowForm(true)}
          className="px-6 py-3 rounded-xl text-sm font-bold bg-blue-600 text-white shadow-lg hover:bg-blue-700 transition-colors"
        >
          + Gửi thông báo
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl shadow-sm border border-sky-50">
          <h3 className="text-lg font-bold text-slate-700 mb-4">Gửi thông báo mới</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Gửi đến</label>
              <select
                value={formData.userId}
                onChange={e => setFormData({ ...formData, userId: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
              >
                <option value="ALL">Tất cả nhân viên</option>
                {employees.filter(e => e.role !== UserRole.ADMIN).map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.name} - {emp.department}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Loại thông báo</label>
              <select
                value={formData.type}
                onChange={e => setFormData({ ...formData, type: e.target.value as any })}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
              >
                <option value="info">Thông tin</option>
                <option value="success">Thành công</option>
                <option value="warning">Cảnh báo</option>
                <option value="error">Lỗi</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Tiêu đề *</label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
                placeholder="Tiêu đề thông báo"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Nội dung *</label>
              <textarea
                required
                value={formData.message}
                onChange={e => setFormData({ ...formData, message: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
                rows={4}
                placeholder="Nội dung thông báo..."
              />
            </div>
          </div>
          <div className="flex space-x-3 mt-4">
            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors"
            >
              Gửi thông báo
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="px-6 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-200 transition-colors"
            >
              Hủy
            </button>
          </div>
        </form>
      )}

      {notifications.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-sky-50">
          <p className="text-slate-400 font-medium">Chưa có thông báo nào</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-sky-50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">Người nhận</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">Tiêu đề</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">Loại</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">Thời gian</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">Trạng thái</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {notifications.map((notif) => (
                  <tr key={notif.id} className="hover:bg-sky-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-sm text-slate-700">{getUserName(notif.userId)}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-bold text-slate-800">{notif.title}</p>
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">{notif.message}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-bold px-2 py-1 rounded-lg ${getTypeColor(notif.type)}`}>
                        {getTypeLabel(notif.type)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-slate-700">{new Date(notif.timestamp).toLocaleString('vi-VN')}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-bold px-2 py-1 rounded-lg ${
                        notif.read ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'
                      }`}>
                        {notif.read ? 'Đã đọc' : 'Chưa đọc'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleDelete(notif.id)}
                        className="text-sm text-red-600 hover:text-red-700 font-medium"
                      >
                        Xóa
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationsManagement;
