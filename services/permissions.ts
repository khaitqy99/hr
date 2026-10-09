import { User, UserRole } from '../types';

export const ADMIN_MODULES = [
  'users',
  'attendance',
  'shift',
  'payroll',
  'reports',
  'departments',
  'branches',
  'locations',
  'holidays',
  'config',
  'notifications',
  'export',
  'settings',
  'permissions',
] as const;

export type AdminModule = (typeof ADMIN_MODULES)[number];
export type AdminAccessLevel = 'view' | 'edit';

export const ADMIN_MODULE_LABELS: Record<AdminModule, string> = {
  users: 'Nhân viên',
  attendance: 'Chấm công',
  shift: 'Đăng ký ca',
  payroll: 'Bảng lương và tính lương',
  reports: 'Thống kê',
  departments: 'Phòng ban',
  branches: 'Chi nhánh',
  locations: 'Địa điểm',
  holidays: 'Ngày lễ',
  config: 'Cấu hình',
  notifications: 'Thông báo',
  export: 'Xuất/Nhập',
  settings: 'Hệ thống',
  permissions: 'Phân quyền',
};

export const ADMIN_PATH_TO_MODULE: Record<string, AdminModule> = {
  users: 'users',
  attendance: 'attendance',
  shift: 'shift',
  payroll: 'payroll',
  reports: 'reports',
  departments: 'departments',
  branches: 'branches',
  locations: 'locations',
  holidays: 'holidays',
  config: 'config',
  notifications: 'notifications',
  export: 'export',
  settings: 'settings',
  permissions: 'permissions',
};

const MODULE_ORDER = Object.keys(ADMIN_PATH_TO_MODULE);

export const FULL_ADMIN_PERMISSIONS: string[] = ADMIN_MODULES.map((module) => `${module}:edit`);

export const PERMISSION_PRESETS: Record<string, { label: string; description: string; permissions: string[] }> = {
  full: {
    label: 'Toàn quyền',
    description: 'Mọi mục, kể cả phân quyền.',
    permissions: FULL_ADMIN_PERMISSIONS,
  },
  operations: {
    label: 'Vận hành',
    description: 'Nhân viên, chấm công, ca, thống kê và thông báo. Không xem lương.',
    permissions: [
      'users:edit',
      'attendance:edit',
      'shift:edit',
      'reports:view',
      'notifications:edit',
    ],
  },
  payroll: {
    label: 'Lương',
    description: 'Xem nhân viên, sửa lương, thống kê và xuất dữ liệu.',
    permissions: ['users:view', 'payroll:edit', 'reports:view', 'export:edit'],
  },
};

export function parseAdminPermissions(raw: unknown): string[] | null {
  if (raw == null) return null;
  if (!Array.isArray(raw)) return null;
  return raw.filter((item): item is string => typeof item === 'string');
}

export function can(user: Pick<User, 'role' | 'adminPermissions'> | null | undefined, module: AdminModule, level: AdminAccessLevel): boolean {
  if (!user || user.role !== UserRole.ADMIN) return false;
  if (user.adminPermissions == null) return true;
  if (user.adminPermissions.includes(`${module}:edit`)) return true;
  return level === 'view' && user.adminPermissions.includes(`${module}:view`);
}

export function moduleAccess(user: Pick<User, 'role' | 'adminPermissions'> | null | undefined, module: AdminModule): 'none' | AdminAccessLevel {
  if (can(user, module, 'edit')) return 'edit';
  if (can(user, module, 'view')) return 'view';
  return 'none';
}

export function firstAllowedAdminPath(user: Pick<User, 'role' | 'adminPermissions'>): string | null {
  return MODULE_ORDER.find((path) => can(user, ADMIN_PATH_TO_MODULE[path], 'view')) ?? null;
}

export function permissionsFromLevels(levels: Record<AdminModule, 'none' | AdminAccessLevel>): string[] {
  return ADMIN_MODULES.flatMap((module) => {
    const level = levels[module];
    if (level === 'none') return [];
    if (module === 'permissions') return level === 'edit' ? ['permissions:edit'] : [];
    return [`${module}:${level}`];
  });
}

export function levelsFromPermissions(user: Pick<User, 'role' | 'adminPermissions'>): Record<AdminModule, 'none' | AdminAccessLevel> {
  return Object.fromEntries(ADMIN_MODULES.map((module) => [module, moduleAccess(user, module)])) as Record<AdminModule, 'none' | AdminAccessLevel>;
}

export function countPermissionAdmins(users: User[]): number {
  return users.filter((user) => user.role === UserRole.ADMIN && (user.adminPermissions == null || user.adminPermissions.includes('permissions:edit'))).length;
}
