import React, { useState, useEffect } from 'react';
import { AllowedLocation, Branch } from '../../types';
import { getAllowedLocations, createAllowedLocation, updateAllowedLocation, deleteAllowedLocation, getBranches } from '../../services/db';

interface LocationsManagementProps {
  language: 'vi' | 'en';
}

const LocationsManagement: React.FC<LocationsManagementProps> = ({ language }) => {
  const [locations, setLocations] = useState<AllowedLocation[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingLocation, setEditingLocation] = useState<AllowedLocation | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    branchId: '',
    latitude: '',
    longitude: '',
    radiusMeters: '200',
    isActive: true,
  });

  const t = {
    vi: {
      title: 'Quản lý địa điểm check-in',
      addLocation: 'Thêm địa điểm',
      editLocation: 'Sửa địa điểm',
      name: 'Tên địa điểm',
      branch: 'Chi nhánh',
      noBranch: 'Không gán chi nhánh',
      latitude: 'Vĩ độ (Latitude)',
      longitude: 'Kinh độ (Longitude)',
      radius: 'Bán kính (mét)',
      status: 'Trạng thái',
      active: 'Hoạt động',
      inactive: 'Tạm dừng',
      actions: 'Thao tác',
      edit: 'Sửa',
      delete: 'Xóa',
      save: 'Lưu',
      cancel: 'Hủy',
      loading: 'Đang tải...',
      noData: 'Chưa có địa điểm nào',
      confirmDelete: 'Bạn có chắc muốn xóa địa điểm này?',
      deleteSuccess: 'Đã xóa địa điểm thành công!',
      saveSuccess: 'Đã lưu địa điểm thành công!',
      error: 'Có lỗi xảy ra',
      getCurrentLocation: 'Lấy vị trí hiện tại',
      gettingLocation: 'Đang lấy vị trí...',
      locationError: 'Không thể lấy vị trí',
      allBranches: 'Tất cả chi nhánh',
    },
    en: {
      title: 'Check-in Locations Management',
      addLocation: 'Add Location',
      editLocation: 'Edit Location',
      name: 'Location Name',
      branch: 'Branch',
      noBranch: 'No branch assigned',
      latitude: 'Latitude',
      longitude: 'Longitude',
      radius: 'Radius (meters)',
      status: 'Status',
      active: 'Active',
      inactive: 'Inactive',
      actions: 'Actions',
      edit: 'Edit',
      delete: 'Delete',
      save: 'Save',
      cancel: 'Cancel',
      loading: 'Loading...',
      noData: 'No locations yet',
      confirmDelete: 'Are you sure you want to delete this location?',
      deleteSuccess: 'Location deleted successfully!',
      saveSuccess: 'Location saved successfully!',
      error: 'An error occurred',
      getCurrentLocation: 'Get Current Location',
      gettingLocation: 'Getting location...',
      locationError: 'Cannot get location',
      allBranches: 'All Branches',
    }
  };

  const text = t[language];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [locationsData, branchesData] = await Promise.all([
        getAllowedLocations(),
        getBranches(),
      ]);
      setLocations(locationsData);
      setBranches(branchesData);
    } catch (error) {
      console.error('Error loading data:', error);
      alert(text.error);
    } finally {
      setLoading(false);
    }
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert(text.locationError);
      return;
    }

    setFormData(prev => ({ ...prev, latitude: text.gettingLocation, longitude: text.gettingLocation }));

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData(prev => ({
          ...prev,
          latitude: position.coords.latitude.toFixed(8),
          longitude: position.coords.longitude.toFixed(8),
        }));
      },
      (error) => {
        console.error('Error getting location:', error);
        alert(text.locationError);
        setFormData(prev => ({ ...prev, latitude: '', longitude: '' }));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const locationData = {
        name: formData.name,
        branchId: formData.branchId || undefined,
        latitude: parseFloat(formData.latitude),
        longitude: parseFloat(formData.longitude),
        radiusMeters: parseInt(formData.radiusMeters),
        isActive: formData.isActive,
      };

      if (editingLocation) {
        await updateAllowedLocation(editingLocation.id, locationData);
      } else {
        await createAllowedLocation(locationData);
      }

      alert(text.saveSuccess);
      setShowForm(false);
      setEditingLocation(null);
      setFormData({
        name: '',
        branchId: '',
        latitude: '',
        longitude: '',
        radiusMeters: '200',
        isActive: true,
      });
      loadData();
    } catch (error) {
      console.error('Error saving location:', error);
      alert(text.error);
    }
  };

  const handleEdit = (location: AllowedLocation) => {
    setEditingLocation(location);
    setFormData({
      name: location.name,
      branchId: location.branchId || '',
      latitude: location.latitude.toString(),
      longitude: location.longitude.toString(),
      radiusMeters: location.radiusMeters.toString(),
      isActive: location.isActive,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(text.confirmDelete)) return;

    try {
      await deleteAllowedLocation(id);
      alert(text.deleteSuccess);
      loadData();
    } catch (error) {
      console.error('Error deleting location:', error);
      alert(text.error);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingLocation(null);
    setFormData({
      name: '',
      branchId: '',
      latitude: '',
      longitude: '',
      radiusMeters: '200',
      isActive: true,
    });
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">{text.loading}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800">{text.title}</h2>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            {text.addLocation}
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl shadow-sm border border-sky-50 p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4">
            {editingLocation ? text.editLocation : text.addLocation}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">{text.name}</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">{text.branch}</label>
              <select
                value={formData.branchId}
                onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
              >
                <option value="">{text.noBranch}</option>
                {branches.filter(b => b.isActive).map(branch => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name} ({branch.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">{text.latitude}</label>
                <input
                  type="text"
                  value={formData.latitude}
                  onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
                  placeholder="10.040675858019696"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">{text.longitude}</label>
                <input
                  type="text"
                  value={formData.longitude}
                  onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
                  placeholder="105.78463187148355"
                  required
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleGetCurrentLocation}
              className="px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 transition-colors flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
              {text.getCurrentLocation}
            </button>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">{text.radius}</label>
              <input
                type="number"
                value={formData.radiusMeters}
                onChange={(e) => setFormData({ ...formData, radiusMeters: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
                min="10"
                max="5000"
                required
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <label htmlFor="isActive" className="text-sm font-bold text-slate-700">
                {text.active}
              </label>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors"
              >
                {text.save}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-300 transition-colors"
              >
                {text.cancel}
              </button>
            </div>
          </form>
        </div>
      )}

      {locations.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-sky-50">
          <p className="text-slate-400">{text.noData}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-sky-50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">{text.name}</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">{text.branch}</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">{text.latitude}</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">{text.longitude}</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">{text.radius}</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">{text.status}</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">{text.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {locations.map((location) => {
                  const branch = branches.find(b => b.id === location.branchId);
                  return (
                    <tr key={location.id} className="hover:bg-sky-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold text-slate-800">{location.name}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-slate-700">
                          {branch ? `${branch.name} (${branch.code})` : text.noBranch}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-slate-700">{location.latitude.toFixed(6)}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-slate-700">{location.longitude.toFixed(6)}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-slate-700">{location.radiusMeters}m</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-xs font-bold px-2 py-1 rounded-lg ${
                          location.isActive ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {location.isActive ? text.active : text.inactive}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEdit(location)}
                            className="px-3 py-1 bg-blue-100 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-200 transition-colors"
                          >
                            {text.edit}
                          </button>
                          <button
                            onClick={() => handleDelete(location.id)}
                            className="px-3 py-1 bg-red-100 text-red-600 rounded-lg text-xs font-bold hover:bg-red-200 transition-colors"
                          >
                            {text.delete}
                          </button>
                        </div>
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

export default LocationsManagement;
