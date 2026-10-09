-- Quyền chi tiết cho tài khoản admin. NULL = admin cũ, app hiểu là toàn quyền.
-- Giá trị: 'users:view', 'users:edit', 'payroll:edit', 'permissions:edit', ...

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS admin_permissions text[];

COMMENT ON COLUMN public.users.admin_permissions IS
  'Quyền admin dạng module:view hoặc module:edit. NULL giữ nghĩa toàn quyền cho admin đã có.';

UPDATE public.users
SET admin_permissions = ARRAY[
  'users:edit',
  'attendance:edit',
  'shift:edit',
  'payroll:edit',
  'reports:edit',
  'departments:edit',
  'branches:edit',
  'locations:edit',
  'holidays:edit',
  'config:edit',
  'notifications:edit',
  'export:edit',
  'settings:edit',
  'permissions:edit'
]::text[]
WHERE role = 'ADMIN'
  AND admin_permissions IS NULL;
