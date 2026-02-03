import React, { useState, useEffect } from 'react';
import { ShiftRegistration, RequestStatus, User, UserRole } from '../../types';
import { getShiftRegistrations, updateShiftStatus, getAllUsers } from '../../services/db';

interface ShiftManagementProps {
  onRegisterReload?: (handler: () => void | Promise<void>) => void;
}

const ShiftManagement: React.FC<ShiftManagementProps> = ({ onRegisterReload }) => {
  const [shiftRequests, setShiftRequests] = useState<ShiftRegistration[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [filter, setFilter] = useState<RequestStatus | 'ALL'>('PENDING');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (onRegisterReload) {
      onRegisterReload(loadData);
    }
  }, [onRegisterReload]);

  const loadData = async () => {
    const shifts = await getShiftRegistrations(undefined, UserRole.ADMIN);
    const users = await getAllUsers();
    setShiftRequests(shifts);
    setEmployees(users);
  };

  const handleAction = async (id: string, status: RequestStatus) => {
    await updateShiftStatus(id, status);
    loadData();
  };

  const filteredData = shiftRequests.filter(r => filter === 'ALL' || r.status === filter);

  const getShiftLabel = (shift: string) => {
    switch (shift) {
      case 'MORNING':
        return 'Ca Sáng';
      case 'AFTERNOON':
        return 'Ca Chiều';
      case 'EVENING':
        return 'Ca Tối';
      default:
        return shift;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800">Quản lý đăng ký ca</h2>
      </div>

      {/* Filter */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-sky-50">
        <div className="flex space-x-2">
          {['PENDING', 'APPROVED', 'REJECTED', 'ALL'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f as any)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                filter === f ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {f === 'PENDING' ? 'Mới' : f === 'ALL' ? 'Tất cả' : f.substring(0, 4)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {filteredData.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-sky-50">
          <p className="text-slate-400 font-medium">Danh sách trống</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-sky-50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">Nhân viên</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">Ca làm</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">Ngày làm</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">Trạng thái</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredData.map((item: ShiftRegistration) => {
                  const employee = employees.find(e => e.id === item.userId);
                  return (
                    <tr key={item.id} className="hover:bg-sky-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm font-bold text-slate-800">{employee?.name || item.userId}</p>
                          <p className="text-xs text-slate-500">{employee?.department || ''}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-slate-700">{getShiftLabel(item.shift)}</span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-slate-700">{new Date(item.date).toLocaleDateString('vi-VN')}</p>
                      </td>
                      <td className="px-6 py-4">
                        {item.status !== RequestStatus.PENDING && (
                          <span className={`text-xs font-bold px-2 py-1 rounded-lg ${
                            item.status === RequestStatus.APPROVED ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                          }`}>
                            {item.status}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {item.status === RequestStatus.PENDING && (
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleAction(item.id, RequestStatus.APPROVED)}
                              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors"
                            >
                              Chấp thuận
                            </button>
                            <button
                              onClick={() => handleAction(item.id, RequestStatus.REJECTED)}
                              className="px-4 py-2 bg-white text-slate-500 border border-slate-200 rounded-lg text-xs font-bold hover:bg-slate-50 transition-colors"
                            >
                              Từ chối
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShiftManagement;
