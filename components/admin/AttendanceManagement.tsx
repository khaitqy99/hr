import React, { useState, useEffect } from 'react';
import { AttendanceRecord, AttendanceType, AttendanceStatus, User, UserRole } from '../../types';
import { getAllAttendance, deleteAttendance, getAllUsers } from '../../services/db';
import { deleteAttendancePhoto } from '../../services/storage';
import { exportToCSV } from '../../utils/export';

/**
 * Kiểm tra xem photoUrl có phải là base64 data URL không
 */
const isBase64DataUrl = (url: string): boolean => {
  return url.startsWith('data:image/');
};

/**
 * Kiểm tra xem photoUrl có phải là URL hợp lệ không
 */
const isValidUrl = (url: string): boolean => {
  try {
    if (isBase64DataUrl(url)) return true;
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

interface AttendanceManagementProps {
  onRegisterReload?: (handler: () => void | Promise<void>) => void;
  setView?: (view: string, options?: { adminPath?: string }) => void;
}

const AttendanceManagement: React.FC<AttendanceManagementProps> = ({ onRegisterReload, setView }) => {
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [attendanceFilter, setAttendanceFilter] = useState<string>('ALL');
  const [selectedEmployeeForAttendance, setSelectedEmployeeForAttendance] = useState<string>('ALL');
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  /** ID các bản ghi có ảnh không tải được (URL lỗi / bucket private / bản ghi cũ) */
  const [failedPhotoIds, setFailedPhotoIds] = useState<Set<string>>(new Set());
  /** Track images that are in viewport for lazy loading */
  const [visibleImageIds, setVisibleImageIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (onRegisterReload) {
      onRegisterReload(loadData);
    }
  }, [onRegisterReload]);

  // Intersection Observer for lazy loading images
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const recordId = entry.target.getAttribute('data-record-id');
            if (recordId) {
              setVisibleImageIds((prev) => new Set(prev).add(recordId));
            }
          }
        });
      },
      { rootMargin: '50px' } // Start loading 50px before image enters viewport
    );

    // Re-observe images when records change
    const imageElements = document.querySelectorAll('[data-record-id]');
    imageElements.forEach((el) => observer.observe(el));

    return () => {
      imageElements.forEach((el) => observer.unobserve(el));
    };
  }, [attendanceRecords]);

  const loadData = async () => {
    setIsLoading(true);
    setFailedPhotoIds(new Set());
    try {
      // Tối ưu: Chỉ load 500 records đầu tiên để tránh lag
      // Nếu cần tất cả, có thể load thêm khi scroll hoặc filter
      const records = await getAllAttendance(500);
      const users = await getAllUsers();
      setAttendanceRecords(records);
      setEmployees(users);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getFilteredData = () => {
    let filtered = attendanceRecords;

    if (selectedEmployeeForAttendance !== 'ALL') {
      filtered = filtered.filter(r => r.userId === selectedEmployeeForAttendance);
    }

    const now = Date.now();
    if (attendanceFilter === 'TODAY') {
      const todayStart = new Date().setHours(0, 0, 0, 0);
      filtered = filtered.filter(r => r.timestamp >= todayStart);
    } else if (attendanceFilter === 'WEEK') {
      const weekAgo = now - (7 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(r => r.timestamp >= weekAgo);
    } else if (attendanceFilter === 'MONTH') {
      const monthAgo = now - (30 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(r => r.timestamp >= monthAgo);
    }

    return filtered;
  };

  const filteredData = getFilteredData();

  const handleExport = () => {
    if (filteredData.length === 0) {
      alert('Không có dữ liệu để xuất');
      return;
    }
    // Format dữ liệu để export dễ đọc hơn
    const exportData = filteredData.map(record => {
      const employee = employees.find(e => e.id === record.userId);
      return {
        'Nhân viên': employee?.name || record.userId,
        'Phòng ban': employee?.department || '',
        'Thời gian': new Date(record.timestamp).toLocaleString('vi-VN'),
        'Ngày': new Date(record.timestamp).toLocaleDateString('vi-VN'),
        'Loại': record.type === AttendanceType.CHECK_IN ? 'Vào' : 'Ra',
        'Trạng thái': getStatusLabel(record.status).label,
        'Địa chỉ': record.location?.address || `${record.location?.lat}, ${record.location?.lng}`,
        'Ghi chú': record.notes || '',
      };
    });
    const dateRange = attendanceFilter === 'TODAY' ? 'hom_nay' : 
                      attendanceFilter === 'WEEK' ? 'tuan_nay' :
                      attendanceFilter === 'MONTH' ? 'thang_nay' : 'tat_ca';
    const filename = `attendance_${dateRange}_${Date.now()}.csv`;
    exportToCSV(exportData, filename);
  };

  const getStatusLabel = (status: AttendanceStatus) => {
    switch (status) {
      case AttendanceStatus.ON_TIME:
        return { label: 'Đúng giờ', className: 'bg-green-100 text-green-600' };
      case AttendanceStatus.LATE:
        return { label: 'Trễ', className: 'bg-orange-100 text-orange-600' };
      case AttendanceStatus.EARLY_LEAVE:
        return { label: 'Về sớm', className: 'bg-yellow-100 text-yellow-600' };
      case AttendanceStatus.OVERTIME:
        return { label: 'Tăng ca', className: 'bg-purple-100 text-purple-600' };
      default:
        return { label: status, className: 'bg-slate-100 text-slate-600' };
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-sky-50">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-slate-700">Bộ lọc</h3>
          <div className="flex items-center gap-2">
            {setView && (
              <button
                onClick={() => setView('admin', { adminPath: 'payroll' })}
                className="px-4 py-2 bg-green-600 text-white rounded-xl text-xs font-bold hover:bg-green-700 transition-colors flex items-center gap-2"
                title="Chuyển đến trang tính lương"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
                </svg>
                Tính lương
              </button>
            )}
            <button
              onClick={handleExport}
              disabled={isLoading || filteredData.length === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Xuất CSV ({filteredData.length})
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-2">Lọc theo thời gian</label>
            <div className="flex space-x-2">
              {['TODAY', 'WEEK', 'MONTH', 'ALL'].map(f => (
                <button
                  key={f}
                  onClick={() => setAttendanceFilter(f)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    attendanceFilter === f ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {f === 'TODAY' ? 'Hôm nay' : f === 'WEEK' ? 'Tuần' : f === 'MONTH' ? 'Tháng' : 'Tất cả'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-2">Lọc theo nhân viên</label>
            <select
              value={selectedEmployeeForAttendance}
              onChange={(e) => setSelectedEmployeeForAttendance(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
            >
              <option value="ALL">Tất cả nhân viên</option>
              {employees.filter(e => e.role !== UserRole.ADMIN).map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name} - {emp.department}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-sky-50">
          <p className="text-slate-400 font-medium">Đang tải dữ liệu...</p>
        </div>
      ) : filteredData.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-sky-50">
          <p className="text-slate-400 font-medium">Chưa có dữ liệu chấm công</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-sky-50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">Loại</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">Nhân viên</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">Thời gian</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">Vị trí</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">Hình ảnh</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">Trạng thái</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredData.map((record: AttendanceRecord) => {
                  const employee = employees.find(e => e.id === record.userId);
                  const statusInfo = getStatusLabel(record.status);
                  return (
                    <tr key={record.id} className="hover:bg-sky-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold ${
                          record.type === AttendanceType.CHECK_IN ? 'bg-blue-100 text-blue-600' : 'bg-cyan-100 text-cyan-600'
                        }`}>
                          {record.type === AttendanceType.CHECK_IN ? 'Vào' : 'Ra'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm font-bold text-slate-800">{employee?.name || record.userId}</p>
                          <p className="text-xs text-slate-500">{employee?.department || ''}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm text-slate-700">{new Date(record.timestamp).toLocaleDateString('vi-VN')}</p>
                          <p className="text-xs text-slate-500">{new Date(record.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {record.location ? (
                          <p className="text-xs text-slate-600">
                            {record.location.address || `${record.location.lat.toFixed(6)}, ${record.location.lng.toFixed(6)}`}
                          </p>
                        ) : (
                          <p className="text-xs text-slate-400">-</p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {record.photoUrl ? (
                          (() => {
                            const photoUrl = record.photoUrl;
                            const isBase64 = isBase64DataUrl(photoUrl);
                            const isValid = isValidUrl(photoUrl);
                            const hasFailed = failedPhotoIds.has(record.id);

                            // Nếu URL không hợp lệ hoặc đã fail
                            if (!isValid || hasFailed) {
                              return (
                                <div
                                  className="w-16 h-16 rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-[10px] text-slate-400 text-center leading-tight px-1"
                                  title={
                                    !isValid
                                      ? 'URL ảnh không hợp lệ'
                                      : 'Ảnh không tải được (có thể do bản ghi cũ hoặc bucket chưa public)'
                                  }
                                >
                                  {!isValid ? 'URL lỗi' : 'Không tải được'}
                                </div>
                              );
                            }

                            // Base64: hiển thị trực tiếp (không cần check error)
                            if (isBase64) {
                              return (
                                <button
                                  onClick={() => setSelectedPhoto(photoUrl)}
                                  className="w-16 h-16 rounded-lg overflow-hidden border-2 border-slate-200 hover:border-blue-500 transition-colors"
                                >
                                  <img
                                    src={photoUrl}
                                    alt="Attendance photo"
                                    className="w-full h-full object-cover"
                                  />
                                </button>
                              );
                            }

                            // HTTP URL: Lazy load chỉ khi image trong viewport
                            const shouldLoad = visibleImageIds.has(record.id);
                            return (
                              <button
                                onClick={() => setSelectedPhoto(photoUrl)}
                                className="w-16 h-16 rounded-lg overflow-hidden border-2 border-slate-200 hover:border-blue-500 transition-colors bg-slate-100"
                                data-record-id={record.id}
                              >
                                {shouldLoad ? (
                                  <img
                                    src={photoUrl}
                                    alt="Attendance photo"
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                    onError={(e) => {
                                      console.warn(`Failed to load photo for record ${record.id}:`, photoUrl);
                                      setFailedPhotoIds((prev) => new Set(prev).add(record.id));
                                    }}
                                    onLoad={() => {
                                      // Photo loaded successfully
                                    }}
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-[8px] text-slate-400">
                                    Loading...
                                  </div>
                                )}
                              </button>
                            );
                          })()
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-xs font-bold px-2 py-1 rounded-lg ${statusInfo.className}`}>
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={async () => {
                            if (confirm('Bạn có chắc muốn xóa bản ghi này?')) {
                              // Xóa ảnh khỏi Storage nếu có
                              if (record.photoUrl) {
                                await deleteAttendancePhoto(record.photoUrl);
                              }
                              await deleteAttendance(record.id);
                              loadData();
                            }
                          }}
                          className="text-sm text-red-600 hover:text-red-700 font-medium"
                        >
                          Xóa
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Photo Modal */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-white rounded-2xl overflow-hidden shadow-2xl">
            <button
              onClick={() => setSelectedPhoto(null)}
              className="absolute top-4 right-4 z-10 w-10 h-10 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow-lg transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <img
              src={selectedPhoto}
              alt="Attendance photo"
              className="w-full h-full object-contain max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceManagement;
