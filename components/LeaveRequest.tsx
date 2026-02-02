import React, { useState, useEffect } from 'react';
import { User, LeaveRequest, LeaveType, RequestStatus } from '../types';
import { createLeaveRequest, getLeaveRequests } from '../services/db';

interface LeaveRequestProps {
  user: User;
}

const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  [LeaveType.SICK]: 'Nghỉ ốm',
  [LeaveType.VACATION]: 'Nghỉ phép',
  [LeaveType.PERSONAL]: 'Nghỉ cá nhân',
  [LeaveType.OTHER]: 'Khác'
};

const STATUS_LABELS: Record<RequestStatus, string> = {
  [RequestStatus.PENDING]: 'Chờ duyệt',
  [RequestStatus.APPROVED]: 'Đã duyệt',
  [RequestStatus.REJECTED]: 'Từ chối'
};

const LeaveRequestComponent: React.FC<LeaveRequestProps> = ({ user }) => {
  const [showForm, setShowForm] = useState(false);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [formData, setFormData] = useState({
    startDate: '',
    endDate: '',
    type: LeaveType.VACATION,
    reason: ''
  });
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ startDate?: string; endDate?: string; reason?: string }>({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const requests = await getLeaveRequests(user.id);
    setLeaveRequests(requests);
  };

  const validateForm = (): boolean => {
    const errors: { startDate?: string; endDate?: string; reason?: string } = {};
    
    if (!formData.startDate) {
      errors.startDate = 'Ngày bắt đầu là bắt buộc';
    }
    
    if (!formData.endDate) {
      errors.endDate = 'Ngày kết thúc là bắt buộc';
    } else if (formData.startDate && new Date(formData.endDate) < new Date(formData.startDate)) {
      errors.endDate = 'Ngày kết thúc phải sau ngày bắt đầu';
    }
    
    if (!formData.reason.trim()) {
      errors.reason = 'Lý do nghỉ phép là bắt buộc';
    }
    
    setFieldErrors(errors);
    setFormError(Object.keys(errors).length > 0 ? 'Vui lòng kiểm tra lại các trường bắt buộc' : '');
    
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFieldErrors({});
    
    if (!validateForm()) {
      return;
    }
    
    try {
      const request: LeaveRequest = {
        id: 'lr-' + Date.now(),
        userId: user.id,
        startDate: new Date(formData.startDate).getTime(),
        endDate: new Date(formData.endDate).getTime(),
        type: formData.type,
        reason: formData.reason.trim(),
        status: RequestStatus.PENDING,
        createdAt: Date.now()
      };
      
      await createLeaveRequest(request);
      setFormData({ startDate: '', endDate: '', type: LeaveType.VACATION, reason: '' });
      setShowForm(false);
      setFieldErrors({});
      loadData();
      alert('Đơn xin nghỉ phép đã được gửi thành công!');
    } catch (err: any) {
      setFormError(err?.message || 'Không thể gửi đơn xin nghỉ phép');
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('vi-VN');
  };

  const calculateDays = (startDate: number, endDate: number) => {
    const diff = endDate - startDate;
    return Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;
  };

  // Calculate remaining leave days (should be from user data or system config)
  // For now, return 0 if not configured - admin can set this per user
  const remainingLeaveDays = 0; // Will be calculated from user data or leave balance

  return (
    <div className="space-y-6 fade-up">
      {/* Header */}
      <div className="flex justify-between items-center bg-white p-4 rounded-3xl shadow-sm border border-sky-50">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Nghỉ phép</h2>
          <p className="text-xs text-slate-400 font-medium">Xin nghỉ và theo dõi đơn</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">Ngày nghỉ còn lại</p>
          <p className="text-lg font-bold text-blue-600">{remainingLeaveDays} ngày</p>
        </div>
      </div>

      {/* Create Request Button */}
      <button
        onClick={() => { setShowForm(!showForm); setFormError(''); setFieldErrors({}); }}
        className="w-full py-3 rounded-2xl text-sm font-bold bg-blue-600 text-white shadow-md hover:bg-blue-700 transition-colors"
      >
        {showForm ? 'Đóng form' : '+ Xin nghỉ phép'}
      </button>

      {/* Request Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl shadow-sm border border-sky-50 space-y-4">
          {formError && <p className="text-sm text-red-600 font-medium bg-red-50 p-3 rounded-xl">{formError}</p>}
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Ngày bắt đầu *</label>
              <input
                type="date"
                required
                value={formData.startDate}
                onChange={e => {
                  setFormData(f => ({ ...f, startDate: e.target.value }));
                  if (fieldErrors.startDate) setFieldErrors(prev => ({ ...prev, startDate: undefined }));
                }}
                className={`w-full rounded-xl border px-4 py-2.5 text-sm ${
                  fieldErrors.startDate ? 'border-red-300 bg-red-50' : 'border-slate-200'
                }`}
              />
              {fieldErrors.startDate && <span className="text-xs text-red-600 mt-1 block">{fieldErrors.startDate}</span>}
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Ngày kết thúc *</label>
              <input
                type="date"
                required
                value={formData.endDate}
                onChange={e => {
                  setFormData(f => ({ ...f, endDate: e.target.value }));
                  if (fieldErrors.endDate) setFieldErrors(prev => ({ ...prev, endDate: undefined }));
                }}
                className={`w-full rounded-xl border px-4 py-2.5 text-sm ${
                  fieldErrors.endDate ? 'border-red-300 bg-red-50' : 'border-slate-200'
                }`}
              />
              {fieldErrors.endDate && <span className="text-xs text-red-600 mt-1 block">{fieldErrors.endDate}</span>}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Loại nghỉ phép *</label>
            <select
              value={formData.type}
              onChange={e => setFormData(f => ({ ...f, type: e.target.value as LeaveType }))}
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
            >
              {Object.entries(LEAVE_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Lý do nghỉ phép *</label>
            <textarea
              required
              value={formData.reason}
              onChange={e => {
                setFormData(f => ({ ...f, reason: e.target.value }));
                if (fieldErrors.reason) setFieldErrors(prev => ({ ...prev, reason: undefined }));
              }}
              placeholder="Nhập lý do nghỉ phép..."
              rows={3}
              className={`w-full rounded-xl border px-4 py-2.5 text-sm resize-none ${
                fieldErrors.reason ? 'border-red-300 bg-red-50' : 'border-slate-200'
              }`}
            />
            {fieldErrors.reason && <span className="text-xs text-red-600 mt-1 block">{fieldErrors.reason}</span>}
          </div>

          {formData.startDate && formData.endDate && (
            <div className="bg-blue-50 p-3 rounded-xl">
              <p className="text-xs text-blue-700 font-medium">
                Số ngày nghỉ: {calculateDays(new Date(formData.startDate).getTime(), new Date(formData.endDate).getTime())} ngày
              </p>
            </div>
          )}

          <button type="submit" className="w-full py-3 rounded-xl text-sm font-bold bg-blue-600 text-white shadow-md hover:bg-blue-700 transition-colors">
            Gửi đơn xin nghỉ
          </button>
        </form>
      )}

      {/* Leave Requests List */}
      <div className="bg-white rounded-2xl shadow-sm border border-sky-50 overflow-hidden">
        <div className="p-4 border-b border-slate-50 bg-slate-50/50">
          <h3 className="text-sm font-bold text-slate-700">Lịch sử đơn xin nghỉ</h3>
        </div>
        {leaveRequests.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <p className="text-sm">Chưa có đơn xin nghỉ phép nào</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {leaveRequests.map((request) => (
              <div key={request.id} className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="text-sm font-bold text-slate-800">{LEAVE_TYPE_LABELS[request.type]}</p>
                    <p className="text-xs text-slate-500">
                      {formatDate(request.startDate)} - {formatDate(request.endDate)}
                    </p>
                    <p className="text-xs text-blue-500 font-medium mt-1">
                      {calculateDays(request.startDate, request.endDate)} ngày
                    </p>
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded-lg ${
                    request.status === RequestStatus.APPROVED ? 'bg-green-100 text-green-600' :
                    request.status === RequestStatus.REJECTED ? 'bg-red-100 text-red-600' :
                    'bg-orange-100 text-orange-600'
                  }`}>
                    {STATUS_LABELS[request.status]}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-2">{request.reason}</p>
                <p className="text-[10px] text-slate-400 mt-2">
                  Gửi lúc: {new Date(request.createdAt).toLocaleString('vi-VN')}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default LeaveRequestComponent;
