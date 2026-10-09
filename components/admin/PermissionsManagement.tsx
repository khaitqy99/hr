import React, { useEffect, useMemo, useState } from 'react';
import { User, UserRole } from '../../types';
import { getAllUsers, updateUser } from '../../services/db';
import {
  ADMIN_MODULES,
  ADMIN_MODULE_LABELS,
  AdminAccessLevel,
  AdminModule,
  PERMISSION_PRESETS,
  countPermissionAdmins,
  levelsFromPermissions,
  permissionsFromLevels,
} from '../../services/permissions';

interface PermissionsManagementProps {
  currentUser: User;
  onRegisterReload?: (handler: () => void | Promise<void>) => void;
  onUserUpdated?: (user: User) => void;
}

const emptyLevels = (): Record<AdminModule, 'none' | AdminAccessLevel> =>
  Object.fromEntries(ADMIN_MODULES.map((module) => [module, 'none'])) as Record<AdminModule, 'none' | AdminAccessLevel>;

const PermissionsManagement: React.FC<PermissionsManagementProps> = ({ currentUser, onRegisterReload, onUserUpdated }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [levels, setLevels] = useState(emptyLevels);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = async () => {
    const rows = await getAllUsers();
    setUsers(rows);
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    onRegisterReload?.(load);
  }, [onRegisterReload]);

  const managedUsers = useMemo(
    () => users.filter((user) => user.role === UserRole.ADMIN || (user.adminPermissions?.length ?? 0) > 0),
    [users]
  );
  const grantableUsers = users.filter((user) => !managedUsers.some((managed) => managed.id === user.id) && user.status !== 'LEFT');
  const selected = users.find((user) => user.id === selectedId) ?? null;

  const openUser = (user: User) => {
    setSelectedId(user.id);
    setLevels(levelsFromPermissions(user.role === UserRole.ADMIN ? user : { ...user, role: UserRole.ADMIN, adminPermissions: user.adminPermissions ?? [] }));
    setError(null);
    setNotice(null);
  };

  const applyPreset = (key: string) => {
    const preset = PERMISSION_PRESETS[key];
    if (!preset) return;
    setLevels(levelsFromPermissions({ role: UserRole.ADMIN, adminPermissions: preset.permissions }));
  };

  const save = async () => {
    if (!selected) return;
    const permissions = permissionsFromLevels(levels);
    const nextRole = permissions.length > 0 ? UserRole.ADMIN : UserRole.EMPLOYEE;
    const nextUsers = users.map((user) => (
      user.id === selected.id ? { ...user, role: nextRole, adminPermissions: permissions } : user
    ));
    if (countPermissionAdmins(nextUsers) < 1) {
      setError('Phải còn ít nhất một người được sửa phân quyền.');
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await updateUser(selected.id, { role: nextRole, adminPermissions: permissions });
      setUsers((current) => current.map((user) => (user.id === updated.id ? updated : user)));
      onUserUpdated?.(updated);
      setNotice(nextRole === UserRole.ADMIN ? 'Đã lưu quyền quản trị.' : 'Đã gỡ quyền quản trị. Tài khoản trở lại nhân viên.');
      if (nextRole !== UserRole.ADMIN) setSelectedId(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Không lưu được quyền';
      setError(/admin_permissions|schema cache|PGRST204/i.test(message)
        ? 'Chưa có cột quyền trên Supabase. Chạy migration 042_admin_permissions.sql rồi thử lại.'
        : message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-6">
      <div className="bg-white rounded-2xl border border-sky-50 shadow-sm p-4 space-y-4">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Người có quyền admin</h3>
          <p className="text-xs text-slate-500 mt-1">Chọn một người để chỉnh từng mục.</p>
        </div>
        <div className="space-y-2">
          {managedUsers.length === 0 && <p className="text-xs text-slate-400">Chưa có tài khoản admin.</p>}
          {managedUsers.map((user) => (
            <button
              key={user.id}
              type="button"
              data-readonly-allow="true"
              onClick={() => openUser(user)}
              className={`w-full text-left rounded-xl px-3 py-3 border ${selectedId === user.id ? 'border-blue-300 bg-blue-50' : 'border-slate-100 hover:bg-slate-50'}`}
            >
              <p className="text-sm font-bold text-slate-800">{user.name}</p>
              <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
              <p className="text-[11px] text-blue-600 mt-1">
                {user.adminPermissions == null ? 'Toàn quyền' : `${user.adminPermissions.length} quyền`}
              </p>
            </button>
          ))}
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-2">Cấp quyền cho nhân viên</label>
          <select
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            value=""
            onChange={(event) => {
              const user = users.find((item) => item.id === event.target.value);
              if (user) openUser({ ...user, role: UserRole.ADMIN, adminPermissions: [] });
            }}
          >
            <option value="">Chọn nhân viên</option>
            {grantableUsers.map((user) => (
              <option key={user.id} value={user.id}>{user.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-sky-50 shadow-sm p-6">
        {!selected ? (
          <p className="text-sm text-slate-400">Chọn một tài khoản để phân quyền.</p>
        ) : (
          <div className="space-y-5">
            <div>
              <h3 className="text-lg font-bold text-slate-800">{selected.name}</h3>
              <p className="text-xs text-slate-500">{selected.email}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(PERMISSION_PRESETS).map(([key, preset]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => applyPreset(key)}
                  className="rounded-xl bg-slate-50 px-3 py-2 text-left hover:bg-blue-50"
                  title={preset.description}
                >
                  <span className="block text-xs font-bold text-slate-700">{preset.label}</span>
                  <span className="block text-[11px] text-slate-500 max-w-[220px]">{preset.description}</span>
                </button>
              ))}
            </div>
            <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl">
              {ADMIN_MODULES.map((module) => (
                <div key={module} className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="text-sm text-slate-700">{ADMIN_MODULE_LABELS[module]}</span>
                  {module === 'permissions' ? (
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
                      <input
                        type="checkbox"
                        checked={levels.permissions === 'edit'}
                        onChange={(event) => setLevels((current) => ({ ...current, permissions: event.target.checked ? 'edit' : 'none' }))}
                      />
                      Được cấp quyền
                    </label>
                  ) : (
                    <select
                      value={levels[module]}
                      onChange={(event) => setLevels((current) => ({ ...current, [module]: event.target.value as 'none' | AdminAccessLevel }))}
                      className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-bold text-slate-700"
                    >
                      <option value="none">Không vào</option>
                      <option value="view">Chỉ xem</option>
                      <option value="edit">Được sửa</option>
                    </select>
                  )}
                </div>
              ))}
            </div>
            {error && <p className="text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>}
            {notice && <p className="text-xs text-emerald-700 bg-emerald-50 rounded-xl px-3 py-2">{notice}</p>}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving}
                className="px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold disabled:opacity-50"
              >
                {saving ? 'Đang lưu...' : 'Lưu quyền'}
              </button>
              <button
                type="button"
                onClick={() => setLevels(emptyLevels())}
                className="px-4 py-2.5 rounded-xl bg-red-50 text-red-600 text-sm font-bold"
              >
                Gỡ toàn bộ quyền
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PermissionsManagement;
