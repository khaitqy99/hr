import { User, UserRole, AttendanceRecord, LeaveRequest, Notification, RequestStatus, LeaveType, ShiftRegistration, PayrollRecord, ContractType, EmployeeStatus, AttendanceType, Department, Holiday, SystemConfig, OffType, ShiftTime } from '../types';
import { supabase } from './supabase';
import { emitUserEvent, emitAttendanceEvent, emitShiftEvent, emitPayrollEvent, emitDepartmentEvent, emitHolidayEvent, emitConfigEvent, emitNotificationEvent } from './events';

// Helper để check Supabase connection
export const isSupabaseAvailable = (): boolean => {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  return !!(url && key && url !== 'https://your-project.supabase.co');
};

// Fallback localStorage keys (chỉ dùng khi Supabase không available)
const USERS_KEY = 'hr_connect_users';
const ATTENDANCE_KEY = 'hr_connect_attendance';
const REQUESTS_KEY = 'hr_connect_requests';
const SHIFTS_KEY = 'hr_connect_shifts';
const NOTIFICATIONS_KEY = 'hr_connect_notifications';
const PAYROLL_KEY = 'hr_connect_payroll';
const OTP_CODES_KEY = 'hr_connect_otp_codes';

// Initial Admin User Only
const ADMIN_USER: User = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Admin',
  email: 'admin@congty.com',
  role: UserRole.ADMIN,
  department: 'Board',
  status: EmployeeStatus.ACTIVE,
  contractType: ContractType.OFFICIAL
};

// ============ INITIALIZATION ============

export const initializeDB = async () => {
  if (isSupabaseAvailable()) {
    try {
      // Kiểm tra xem admin user đã tồn tại chưa
      const { data: existingAdmin, error: selectError } = await supabase
        .from('users')
        .select('id')
        .eq('email', ADMIN_USER.email)
        .maybeSingle();

      // Nếu có lỗi và không phải là "not found", log và return
      if (selectError && selectError.code !== 'PGRST116') {
        console.warn('⚠️ Lỗi khi kiểm tra admin user:', selectError);
        // Không throw error, để app vẫn có thể chạy
        return;
      }

      if (!existingAdmin) {
        // Tạo admin user nếu chưa có
        const { error: insertError } = await supabase.from('users').insert({
          id: ADMIN_USER.id,
          name: ADMIN_USER.name,
          email: ADMIN_USER.email,
          role: ADMIN_USER.role,
          department: ADMIN_USER.department,
          status: ADMIN_USER.status,
          contract_type: ADMIN_USER.contractType,
        });

        // Xử lý lỗi 409 (Conflict) - user đã tồn tại
        if (insertError) {
          if (insertError.code === '23505' || insertError.code === 'PGRST409' || insertError.message?.includes('duplicate') || insertError.message?.includes('unique')) {
            // User đã tồn tại, không cần làm gì
            console.log('✅ Admin user đã tồn tại');
          } else {
            console.warn('⚠️ Lỗi khi tạo admin user:', insertError);
          }
        }
      }
    } catch (error: any) {
      // Xử lý lỗi 406 hoặc các lỗi khác
      if (error?.code === 'PGRST406' || error?.status === 406) {
        console.warn('⚠️ Lỗi 406 - Có thể do RLS policy hoặc Accept header. Thử lại với headers khác.');
      } else {
        console.warn('⚠️ Không thể khởi tạo Supabase, fallback về localStorage:', error);
      }
    }
  } else {
    // Fallback to localStorage
    if (!localStorage.getItem(USERS_KEY)) {
      localStorage.setItem(USERS_KEY, JSON.stringify([ADMIN_USER]));
    } else {
      const users: User[] = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
      const adminExists = users.some(u => u.email === ADMIN_USER.email);
      if (!adminExists) {
        users.push(ADMIN_USER);
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
      }
    }
  }

  // Dọn dẹp localStorage mỗi lần init để tránh lag khi dùng lâu
  cleanupLocalStorageOldData();
};

/** Dọn dẹp dữ liệu cũ trong localStorage để tránh lag khi dùng lâu */
function cleanupLocalStorageOldData(): void {
  try {
    const now = Date.now();
    const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

    // Attendance: giữ tối đa 90 ngày khi có nhiều bản ghi
    const attendanceRaw = localStorage.getItem(ATTENDANCE_KEY);
    if (attendanceRaw) {
      const arr: AttendanceRecord[] = JSON.parse(attendanceRaw);
      if (arr.length > 100) {
        const cutoff = now - NINETY_DAYS_MS;
        const filtered = arr.filter((r: AttendanceRecord) => r.timestamp >= cutoff);
        if (filtered.length < arr.length) {
          localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(filtered));
        }
      }
    }

    // OTP codes: xóa đã hết hạn
    const otpRaw = localStorage.getItem(OTP_CODES_KEY);
    if (otpRaw) {
      const otps: { expiresAt: number }[] = JSON.parse(otpRaw);
      const valid = otps.filter((o: { expiresAt: number }) => o.expiresAt > now);
      if (valid.length < otps.length) {
        localStorage.setItem(OTP_CODES_KEY, JSON.stringify(valid));
      }
    }
  } catch (e) {
    console.warn('cleanupLocalStorageOldData:', e);
  }
}

// ============ USERS ============

export const getCurrentUser = async (email: string): Promise<User | undefined> => {
  if (isSupabaseAvailable()) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email.toLowerCase())
        .single();

      if (error || !data) return undefined;

      return {
        id: data.id,
        name: data.name,
        email: data.email,
        role: data.role as UserRole,
        department: data.department,
        avatarUrl: data.avatar_url || undefined,
        employeeCode: data.employee_code || undefined,
        jobTitle: data.job_title || undefined,
        contractType: data.contract_type as ContractType | undefined,
        startDate: data.start_date || undefined,
        status: data.status as EmployeeStatus | undefined,
        grossSalary: data.gross_salary ? Number(data.gross_salary) : undefined,
        socialInsuranceSalary: data.social_insurance_salary ? Number(data.social_insurance_salary) : undefined,
        traineeSalary: data.trainee_salary ? Number(data.trainee_salary) : undefined,
      };
    } catch (error) {
      console.error('Error getting user from Supabase:', error);
      return undefined;
    }
  }

  // Fallback to localStorage
  const users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
  return users.find((u: User) => u.email === email);
};

export const getAllUsers = async (): Promise<User[]> => {
  if (isSupabaseAvailable()) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error || !data) return [];

      return data.map(user => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role as UserRole,
        department: user.department,
        avatarUrl: user.avatar_url || undefined,
        employeeCode: user.employee_code || undefined,
        jobTitle: user.job_title || undefined,
        contractType: user.contract_type as ContractType | undefined,
        startDate: user.start_date || undefined,
        status: user.status as EmployeeStatus | undefined,
        grossSalary: user.gross_salary ? Number(user.gross_salary) : undefined,
        socialInsuranceSalary: user.social_insurance_salary ? Number(user.social_insurance_salary) : undefined,
        traineeSalary: user.trainee_salary ? Number(user.trainee_salary) : undefined,
      }));
    } catch (error) {
      console.error('Error getting users from Supabase:', error);
      return [];
    }
  }

  // Fallback to localStorage
  return JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
};

export const createUser = async (data: Omit<User, 'id'> & { id?: string }): Promise<User> => {
  if (isSupabaseAvailable()) {
    try {
      // Check if email exists
      const existing = await getCurrentUser(data.email);
      if (existing) {
        // Nếu user đã tồn tại, trả về user đó thay vì throw error
        console.warn('User already exists, returning existing user');
        return existing;
      }

      const { data: newUser, error } = await supabase
        .from('users')
        .insert({
          id: data.id || undefined,
          name: data.name,
          email: data.email.trim().toLowerCase(),
          role: data.role ?? UserRole.EMPLOYEE,
          department: data.department,
          avatar_url: data.avatarUrl || null,
          employee_code: data.employeeCode?.trim() || null,
          job_title: data.jobTitle?.trim() || null,
          contract_type: data.contractType || null,
          start_date: data.startDate || null,
          status: data.status ?? EmployeeStatus.ACTIVE,
          gross_salary: data.grossSalary || null,
          social_insurance_salary: data.socialInsuranceSalary || null,
          trainee_salary: data.traineeSalary || null,
        })
        .select()
        .single();

      // Xử lý lỗi 409 Conflict (user đã tồn tại)
      if (error) {
        // Log error details for debugging
        console.error('Error creating user:', {
          code: error.code,
          message: error.message,
          status: error.status,
          details: error.details,
          hint: error.hint
        });

        // Check for various conflict error codes and messages
        const isConflictError =
          error.code === '23505' || // PostgreSQL unique constraint violation
          error.code === 'PGRST409' || // PostgREST 409 Conflict
          error.status === 409 || // HTTP 409 Conflict
          error.message?.toLowerCase().includes('duplicate') ||
          error.message?.toLowerCase().includes('unique') ||
          error.message?.toLowerCase().includes('already exists') ||
          error.message?.toLowerCase().includes('conflict') ||
          error.details?.toLowerCase().includes('duplicate') ||
          error.details?.toLowerCase().includes('unique') ||
          error.hint?.toLowerCase().includes('duplicate') ||
          error.hint?.toLowerCase().includes('unique');

        if (isConflictError) {
          // User đã tồn tại, lấy user đó
          console.warn('Conflict detected, attempting to fetch existing user:', data.email);
          const existingUser = await getCurrentUser(data.email);
          if (existingUser) {
            console.warn('User already exists (409), returning existing user');
            return existingUser;
          }
          // Nếu không tìm thấy user (có thể do RLS policy), throw error với message rõ ràng
          throw new Error('Email đã tồn tại trong hệ thống');
        }
        throw new Error(`Lỗi tạo user: ${error.message || error.code || error.details || 'Unknown error'}`);
      }
      if (!newUser) throw new Error('Không thể tạo user');

      const createdUser = {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role as UserRole,
        department: newUser.department,
        avatarUrl: newUser.avatar_url || undefined,
        employeeCode: newUser.employee_code || undefined,
        jobTitle: newUser.job_title || undefined,
        contractType: newUser.contract_type as ContractType | undefined,
        startDate: newUser.start_date || undefined,
        status: newUser.status as EmployeeStatus | undefined,
        grossSalary: newUser.gross_salary ? Number(newUser.gross_salary) : undefined,
        socialInsuranceSalary: newUser.social_insurance_salary ? Number(newUser.social_insurance_salary) : undefined,
        traineeSalary: newUser.trainee_salary ? Number(newUser.trainee_salary) : undefined,
      };

      // Emit event và invalidate cache
      invalidateUsersCache();
      await emitUserEvent('created', createdUser.id);

      return createdUser;
    } catch (error) {
      console.error('Error creating user in Supabase:', error);
      throw error;
    }
  }

  // Fallback to localStorage
  const users: User[] = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
  const existing = users.find((u: User) => u.email === data.email);
  if (existing) throw new Error('Email đã tồn tại');
  const id = data.id || 'u' + Date.now();
  const user: User = {
    id,
    name: data.name,
    email: data.email.trim().toLowerCase(),
    role: data.role ?? UserRole.EMPLOYEE,
    department: data.department,
    avatarUrl: data.avatarUrl,
    employeeCode: data.employeeCode?.trim() || undefined,
    jobTitle: data.jobTitle?.trim() || undefined,
    contractType: data.contractType,
    startDate: data.startDate,
    status: data.status ?? EmployeeStatus.ACTIVE,
    grossSalary: data.grossSalary,
    socialInsuranceSalary: data.socialInsuranceSalary,
    traineeSalary: data.traineeSalary,
  };
  users.push(user);
  localStorage.setItem(USERS_KEY, JSON.stringify(users));

  // Emit event và invalidate cache
  invalidateUsersCache();
  await emitUserEvent('created', user.id);

  return user;
};

export const updateUser = async (id: string, data: Partial<User>): Promise<User> => {
  if (isSupabaseAvailable()) {
    try {
      // Check if email exists (if changing email)
      if (data.email) {
        const existing = await getCurrentUser(data.email);
        if (existing && existing.id !== id) throw new Error('Email đã tồn tại');
      }

      const updateData: any = {};
      if (data.name) updateData.name = data.name;
      if (data.email) updateData.email = data.email.trim().toLowerCase();
      if (data.role) updateData.role = data.role;
      if (data.department) updateData.department = data.department;
      if (data.avatarUrl !== undefined) updateData.avatar_url = data.avatarUrl || null;
      if (data.employeeCode !== undefined) updateData.employee_code = data.employeeCode?.trim() || null;
      if (data.jobTitle !== undefined) updateData.job_title = data.jobTitle?.trim() || null;
      if (data.contractType !== undefined) updateData.contract_type = data.contractType || null;
      if (data.startDate !== undefined) updateData.start_date = data.startDate || null;
      if (data.status !== undefined) updateData.status = data.status;
      if (data.grossSalary !== undefined) updateData.gross_salary = data.grossSalary || null;
      if (data.socialInsuranceSalary !== undefined) updateData.social_insurance_salary = data.socialInsuranceSalary || null;
      if (data.traineeSalary !== undefined) updateData.trainee_salary = data.traineeSalary || null;

      const { data: updatedUser, error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw new Error(`Lỗi cập nhật user: ${error.message}`);
      if (!updatedUser) throw new Error('Không tìm thấy nhân viên');

      return {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role as UserRole,
        department: updatedUser.department,
        avatarUrl: updatedUser.avatar_url || undefined,
        employeeCode: updatedUser.employee_code || undefined,
        jobTitle: updatedUser.job_title || undefined,
        contractType: updatedUser.contract_type as ContractType | undefined,
        startDate: updatedUser.start_date || undefined,
        status: updatedUser.status as EmployeeStatus | undefined,
        grossSalary: updatedUser.gross_salary ? Number(updatedUser.gross_salary) : undefined,
        socialInsuranceSalary: updatedUser.social_insurance_salary ? Number(updatedUser.social_insurance_salary) : undefined,
        traineeSalary: updatedUser.trainee_salary ? Number(updatedUser.trainee_salary) : undefined,
      };

      // Emit event và invalidate cache
      invalidateUsersCache();
      await emitUserEvent('updated', updatedUser.id);

      return {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role as UserRole,
        department: updatedUser.department,
        avatarUrl: updatedUser.avatar_url || undefined,
        employeeCode: updatedUser.employee_code || undefined,
        jobTitle: updatedUser.job_title || undefined,
        contractType: updatedUser.contract_type as ContractType | undefined,
        startDate: updatedUser.start_date || undefined,
        status: updatedUser.status as EmployeeStatus | undefined,
        grossSalary: updatedUser.gross_salary ? Number(updatedUser.gross_salary) : undefined,
        socialInsuranceSalary: updatedUser.social_insurance_salary ? Number(updatedUser.social_insurance_salary) : undefined,
        traineeSalary: updatedUser.trainee_salary ? Number(updatedUser.trainee_salary) : undefined,
      };
    } catch (error) {
      console.error('Error updating user in Supabase:', error);
      throw error;
    }
  }

  // Fallback to localStorage
  const users: User[] = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
  const idx = users.findIndex((u: User) => u.id === id);
  if (idx === -1) throw new Error('Không tìm thấy nhân viên');

  if (data.email && data.email !== users[idx].email) {
    const existing = users.find((u: User) => u.email === data.email.trim().toLowerCase());
    if (existing) throw new Error('Email đã tồn tại');
  }
  users[idx] = {
    ...users[idx],
    ...data,
    email: data.email ? data.email.trim().toLowerCase() : users[idx].email,
    employeeCode: data.employeeCode?.trim() || undefined,
    jobTitle: data.jobTitle?.trim() || undefined,
  };
  localStorage.setItem(USERS_KEY, JSON.stringify(users));

  // Emit event và invalidate cache
  invalidateUsersCache();
  await emitUserEvent('updated', users[idx].id);

  return users[idx];
};

// ============ ATTENDANCE ============

export const getAttendance = async (userId: string): Promise<AttendanceRecord[]> => {
  if (isSupabaseAvailable()) {
    try {
      const { data, error } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false });

      if (error || !data) return [];

      return data.map(record => {
        const photoUrl = record.photo_url || undefined;
        // Log nếu photoUrl bị truncate (ngắn hơn 100 ký tự - URL Supabase thường dài hơn)
        if (photoUrl && photoUrl.length < 100 && photoUrl.includes('supabase.co/storage')) {
          console.warn('⚠️ Photo URL seems truncated in getAttendance:', {
            recordId: record.id,
            photoUrl,
            length: photoUrl.length,
            expectedMinLength: 150, // Supabase URLs thường dài hơn 150 ký tự
          });
        }
        return {
          id: record.id,
          userId: record.user_id,
          timestamp: record.timestamp,
          type: record.type as AttendanceType,
          location: record.location as { lat: number; lng: number; address?: string },
          status: record.status as any,
          synced: record.synced,
          notes: record.notes || undefined,
          photoUrl,
        };
      });
    } catch (error) {
      console.error('Error getting attendance from Supabase:', error);
      return [];
    }
  }

  // Fallback to localStorage
  const all = JSON.parse(localStorage.getItem(ATTENDANCE_KEY) || '[]');
  return all.filter((r: AttendanceRecord) => r.userId === userId).sort((a: AttendanceRecord, b: AttendanceRecord) => b.timestamp - a.timestamp);
};

export const getAllAttendance = async (limit?: number): Promise<AttendanceRecord[]> => {
  if (isSupabaseAvailable()) {
    try {
      let query = supabase
        .from('attendance_records')
        .select('*')
        .order('timestamp', { ascending: false });

      // Thêm limit nếu được chỉ định để tối ưu performance
      if (limit && limit > 0) {
        query = query.limit(limit);
      }

      const { data, error } = await query;

      if (error || !data) return [];

      return data.map(record => {
        const photoUrl = record.photo_url || undefined;
        // Log nếu photoUrl bị truncate (ngắn hơn 100 ký tự - URL Supabase thường dài hơn)
        if (photoUrl && photoUrl.length < 100 && photoUrl.includes('supabase.co/storage')) {
          console.warn('⚠️ Photo URL seems truncated in getAllAttendance:', {
            recordId: record.id,
            photoUrl,
            length: photoUrl.length,
            expectedMinLength: 150, // Supabase URLs thường dài hơn 150 ký tự
          });
        }
        return {
          id: record.id,
          userId: record.user_id,
          timestamp: record.timestamp,
          type: record.type as AttendanceType,
          location: record.location as { lat: number; lng: number; address?: string },
          status: record.status as any,
          synced: record.synced,
          notes: record.notes || undefined,
          photoUrl,
        };
      });
    } catch (error) {
      console.error('Error getting all attendance from Supabase:', error);
      return [];
    }
  }

  // Fallback to localStorage
  const all = JSON.parse(localStorage.getItem(ATTENDANCE_KEY) || '[]');
  const sorted = all.sort((a: AttendanceRecord, b: AttendanceRecord) => b.timestamp - a.timestamp);
  return limit && limit > 0 ? sorted.slice(0, limit) : sorted;
};

export const deleteAttendance = async (id: string): Promise<void> => {
  if (isSupabaseAvailable()) {
    try {
      const { error } = await supabase
        .from('attendance_records')
        .delete()
        .eq('id', id);

      if (error) throw new Error(`Lỗi xóa attendance: ${error.message}`);

      // Emit event và invalidate cache
      invalidateAttendanceCache();
      await emitAttendanceEvent('deleted', id);

      return;
    } catch (error) {
      console.error('Error deleting attendance from Supabase:', error);
      throw error;
    }
  }

  // Fallback to localStorage
  const all = JSON.parse(localStorage.getItem(ATTENDANCE_KEY) || '[]');
  const filtered = all.filter((r: AttendanceRecord) => r.id !== id);
  localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(filtered));

  // Emit event và invalidate cache
  invalidateAttendanceCache();
  await emitAttendanceEvent('deleted', id);
};

// Helper: Tính số ngày nghỉ từ leave requests trong tháng
// Cải thiện: Loại bỏ trùng lặp với shift OFF để tránh trừ 2 lần
export const calculateLeaveDays = async (userId: string, month: string): Promise<number> => {
  const [leaveRequests, shiftRegistrations] = await Promise.all([
    getLeaveRequests(userId),
    getShiftRegistrations(userId)
  ]);

  // Parse month format "MM-YYYY"
  const [monthStr, yearStr] = month.split('-');
  const targetMonth = parseInt(monthStr);
  const targetYear = parseInt(yearStr);

  // Filter approved leave requests that overlap with the target month
  const monthStart = new Date(targetYear, targetMonth - 1, 1).getTime();
  const monthEnd = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999).getTime();

  // Tạo Set các ngày đã có shift OFF để tránh trừ 2 lần
  // Lưu ý: Chỉ tính các ngày OFF không lương (OFF_DK, OFF_KL)
  // Các ngày OFF có lương (OFF_PN, OFF_LE) đã được tính công ở calculateShiftWorkDays
  const shiftOffDays = new Set<string>();
  shiftRegistrations
    .filter(shift => {
      const shiftDate = new Date(shift.date);
      return shift.status === RequestStatus.APPROVED &&
             shiftDate.getMonth() + 1 === targetMonth &&
             shiftDate.getFullYear() === targetYear &&
             shift.shift === 'OFF';
    })
    .forEach(shift => {
      const date = new Date(shift.date);
      const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      shiftOffDays.add(dateKey);
    });

  const leaveDaysSet = new Set<string>();

  leaveRequests
    .filter(req => req.status === RequestStatus.APPROVED)
    .forEach(req => {
      const startDate = req.startDate;
      const endDate = req.endDate;

      // Check if leave request overlaps with target month
      if (endDate >= monthStart && startDate <= monthEnd) {
        // Calculate overlap days
        const overlapStart = Math.max(startDate, monthStart);
        const overlapEnd = Math.min(endDate, monthEnd);

        // Count days (inclusive) và thêm vào Set
        const days = Math.floor((overlapEnd - overlapStart) / (1000 * 60 * 60 * 24)) + 1;
        for (let i = 0; i < days; i++) {
          const dayTimestamp = overlapStart + i * 24 * 60 * 60 * 1000;
          const date = new Date(dayTimestamp);
          const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
          
          // Chỉ thêm nếu ngày này chưa có shift OFF (tránh trùng lặp)
          if (!shiftOffDays.has(dateKey)) {
            leaveDaysSet.add(dateKey);
          }
        }
      }
    });

  return leaveDaysSet.size;
};

// Helper: Tính số ngày làm việc từ shift registrations trong tháng
// Quy tắc tính công:
// Helper: Tính số giờ giữa 2 thời điểm
const calculateHoursBetween = (startTime: string, endTime: string): number => {
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  
  const totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
  return totalMinutes / 60;
};

// Helper: Tính tổng số giờ làm việc từ shift registrations
// Trả về tổng số giờ (không bao gồm OT)
const calculateTotalWorkHours = async (
  userId: string,
  month: string,
  shiftRegistrations: ShiftRegistration[],
  holidays: Holiday[]
): Promise<number> => {
  const workHoursPerDay = await getConfigNumber('work_hours_per_day', 8);
  
  // Parse month format "MM-YYYY"
  const [monthStr, yearStr] = month.split('-');
  const targetMonth = parseInt(monthStr);
  const targetYear = parseInt(yearStr);

  let totalHours = 0;
  const processedDates = new Set<string>(); // Tránh tính trùng ngày

  // Tính giờ từ shift registrations
  shiftRegistrations
    .filter(shift => {
      const shiftDate = new Date(shift.date);
      return shift.status === RequestStatus.APPROVED &&
             shiftDate.getMonth() + 1 === targetMonth &&
             shiftDate.getFullYear() === targetYear;
    })
    .forEach(shift => {
      const date = new Date(shift.date);
      const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      
      // Tránh tính trùng ngày
      if (processedDates.has(dateKey)) return;
      processedDates.add(dateKey);

      if (shift.shift === 'CUSTOM' && shift.startTime && shift.endTime) {
        // Ca CUSTOM: Tính giờ từ startTime → endTime
        const hours = calculateHoursBetween(shift.startTime, shift.endTime);
        // Chỉ tính tối đa workHoursPerDay giờ (phần thừa là OT)
        totalHours += Math.min(hours, workHoursPerDay);
      } else if (shift.shift === 'OFF') {
        // OFF có lương: Tính đủ workHoursPerDay giờ
        if (shift.offType === OffType.OFF_PN || shift.offType === OffType.LE) {
          totalHours += workHoursPerDay;
        }
        // OFF không lương: Không tính (OFF_DK, OFF_KL)
      } else if (shift.shift !== 'OFF') {
        // Các ca làm việc khác: Tính đủ workHoursPerDay giờ
        totalHours += workHoursPerDay;
      }
    });

  // Tự động thêm giờ cho ngày lễ hưởng lương (không cần đăng ký ca)
  holidays
    .filter(holiday => holiday.isPaid)
    .forEach(holiday => {
      const holidayDate = new Date(holiday.date);
      
      if (holiday.isRecurring) {
        // Ngày lễ hàng năm
        if (holidayDate.getMonth() + 1 === targetMonth) {
          const dateKey = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(holidayDate.getDate()).padStart(2, '0')}`;
          
          // Kiểm tra xem ngày này có shift OFF không lương không
          const hasUnpaidOff = shiftRegistrations.some(shift => {
            const shiftDate = new Date(shift.date);
            const shiftDateKey = `${shiftDate.getFullYear()}-${String(shiftDate.getMonth() + 1).padStart(2, '0')}-${String(shiftDate.getDate()).padStart(2, '0')}`;
            return shift.status === RequestStatus.APPROVED &&
                   shiftDateKey === dateKey &&
                   shift.shift === 'OFF' &&
                   (shift.offType === OffType.OFF_DK || shift.offType === OffType.OFF_KL);
          });
          
          // Chỉ thêm nếu chưa xử lý và không có OFF không lương
          if (!processedDates.has(dateKey) && !hasUnpaidOff) {
            totalHours += workHoursPerDay;
            processedDates.add(dateKey);
          }
        }
      } else {
        // Ngày lễ cố định
        if (holidayDate.getMonth() + 1 === targetMonth && holidayDate.getFullYear() === targetYear) {
          const dateKey = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(holidayDate.getDate()).padStart(2, '0')}`;
          
          const hasUnpaidOff = shiftRegistrations.some(shift => {
            const shiftDate = new Date(shift.date);
            const shiftDateKey = `${shiftDate.getFullYear()}-${String(shiftDate.getMonth() + 1).padStart(2, '0')}-${String(shiftDate.getDate()).padStart(2, '0')}`;
            return shift.status === RequestStatus.APPROVED &&
                   shiftDateKey === dateKey &&
                   shift.shift === 'OFF' &&
                   (shift.offType === OffType.OFF_DK || shift.offType === OffType.OFF_KL);
          });
          
          if (!processedDates.has(dateKey) && !hasUnpaidOff) {
            totalHours += workHoursPerDay;
            processedDates.add(dateKey);
          }
        }
      }
    });

  return totalHours;
};

// ✅ Các ca làm việc (MORNING, AFTERNOON, NIGHT, CUSTOM): Được tính công
// ✅ OFF_PN (Phép năm): Được hưởng lương, tính công
// ✅ OFF_LE (Nghỉ lễ): Được hưởng lương, tính công
// ❌ OFF_DK (Định kỳ): Không lương, không tính công
// ❌ OFF_KL (Không lương): Không lương, không tính công
// Cải thiện: Tự động tính công cho ngày lễ trong hệ thống (không cần đăng ký ca)
// 
// CẢI TIẾN MỚI: Tính công theo GIỜ thay vì theo NGÀY
// - Công thức: Tổng giờ / Số giờ chuẩn mỗi ngày
// - Ví dụ: 4 giờ / 8 = 0.5 công, 6 giờ / 8 = 0.75 công
export const calculateShiftWorkDays = async (userId: string, month: string): Promise<number> => {
  const [shiftRegistrations, holidays, workHoursPerDay] = await Promise.all([
    getShiftRegistrations(userId),
    getHolidays(),
    getConfigNumber('work_hours_per_day', 8)
  ]);

  // Tính tổng số giờ làm việc
  const totalHours = await calculateTotalWorkHours(userId, month, shiftRegistrations, holidays);
  
  // Chuyển giờ thành công: 4 giờ = 0.5 công, 8 giờ = 1 công
  const workDays = totalHours / workHoursPerDay;
  
  // Làm tròn theo đơn vị 0.5 (nửa ngày): 26.38 → 26.5, 27.00 → 27
  return Math.round(workDays * 2) / 2;
};

// Helper: Tính số giờ OT từ shift registrations trong tháng
// OT = tổng số giờ làm việc vượt quá 9 tiếng/ca (chỉ tính ca CUSTOM)
export const calculateShiftOTHours = async (userId: string, month: string): Promise<number> => {
  const shiftRegistrations = await getShiftRegistrations(userId);

  // Parse month format "MM-YYYY"
  const [monthStr, yearStr] = month.split('-');
  const targetMonth = parseInt(monthStr);
  const targetYear = parseInt(yearStr);

  let totalOT = 0;

  shiftRegistrations
    .filter(shift => {
      const shiftDate = new Date(shift.date);
      if (shift.status !== RequestStatus.APPROVED ||
        shiftDate.getMonth() + 1 !== targetMonth ||
        shiftDate.getFullYear() !== targetYear) {
        return false;
      }
      // Chỉ tính OT cho ca CUSTOM có startTime và endTime
      return shift.shift === ShiftTime.CUSTOM && shift.startTime && shift.endTime;
    })
    .forEach(shift => {
      if (!shift.startTime || !shift.endTime) return;

      // Tính số giờ của ca
      const [startHour, startMin] = shift.startTime.split(':').map(Number);
      const [endHour, endMin] = shift.endTime.split(':').map(Number);
      const shiftHours = (endHour * 60 + endMin - startHour * 60 - startMin) / 60;

      // Nếu ca > 9 tiếng thì phần thừa là OT
      if (shiftHours > 9) {
        totalOT += shiftHours - 9;
      }
    });

  return parseFloat(totalOT.toFixed(1));
};

export const calculateAttendanceStats = async (userId: string, month: string): Promise<{ actualWorkDays: number; otHours: number }> => {
  const records = await getAttendance(userId);

  // Parse month format "MM-YYYY"
  const [monthStr, yearStr] = month.split('-');
  const targetMonth = parseInt(monthStr);
  const targetYear = parseInt(yearStr);

  // Filter records for the target month
  const monthRecords = records.filter(record => {
    const recordDate = new Date(record.timestamp);
    return recordDate.getMonth() + 1 === targetMonth && recordDate.getFullYear() === targetYear;
  });

  // Group records by date (YYYY-MM-DD)
  const recordsByDate: { [date: string]: { checkIn?: AttendanceRecord; checkOut?: AttendanceRecord } } = {};

  monthRecords.forEach(record => {
    const date = new Date(record.timestamp);
    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

    if (!recordsByDate[dateKey]) {
      recordsByDate[dateKey] = {};
    }

    if (record.type === AttendanceType.CHECK_IN) {
      recordsByDate[dateKey].checkIn = record;
    } else if (record.type === AttendanceType.CHECK_OUT) {
      recordsByDate[dateKey].checkOut = record;
    }
  });

  // Calculate work days and OT hours
  let actualWorkDays = 0;
  let totalOtHours = 0;
  // Lấy số giờ làm việc tiêu chuẩn từ config (mặc định 8 giờ)
  const standardWorkHours = await getConfigNumber('work_hours_per_day', 8);

  Object.values(recordsByDate).forEach(dayRecords => {
    if (dayRecords.checkIn && dayRecords.checkOut) {
      // Valid work day (has both check-in and check-out)
      actualWorkDays++;

      // Calculate work hours
      const checkInTime = dayRecords.checkIn.timestamp;
      const checkOutTime = dayRecords.checkOut.timestamp;
      const workHours = (checkOutTime - checkInTime) / (1000 * 60 * 60); // Convert to hours

      // Cải thiện: Tính OT khi làm việc > 9 tiếng (8h làm + 1h nghỉ trưa)
      // Hoặc khi có status OVERTIME từ check-out
      const workHoursWithBreak = standardWorkHours + 1;
      if (workHours > workHoursWithBreak) {
        totalOtHours += workHours - workHoursWithBreak;
      } else if (dayRecords.checkOut.status === 'OVERTIME') {
        // Nếu được đánh dấu OVERTIME nhưng chưa đủ 9 tiếng, vẫn tính là OT tối thiểu 0.5h
        // (Trường hợp checkout muộn hơn shift nhưng chưa đủ 9 tiếng)
        const minOT = 0.5;
        if (totalOtHours === 0 || workHours > workHoursWithBreak - minOT) {
          totalOtHours += Math.max(minOT, workHours - workHoursWithBreak);
        }
      }
    }
  });

  return {
    actualWorkDays,
    otHours: Math.round(totalOtHours * 10) / 10 // Round to 1 decimal place
  };
};

/**
 * Trả về các ngày trong tháng có chấm công không đủ (chỉ có check-in hoặc chỉ có check-out).
 * HR có thể dùng để bù công tay khi tính lương hoặc nhắc nhân viên.
 */
export const getIncompleteAttendanceDays = async (
  userId: string,
  month: string
): Promise<{ date: string; hasCheckIn: boolean; hasCheckOut: boolean }[]> => {
  const records = await getAttendance(userId);
  const [monthStr, yearStr] = month.split('-');
  const targetMonth = parseInt(monthStr);
  const targetYear = parseInt(yearStr);

  const monthRecords = records.filter(record => {
    const d = new Date(record.timestamp);
    return d.getMonth() + 1 === targetMonth && d.getFullYear() === targetYear;
  });

  const byDate: { [key: string]: { checkIn: boolean; checkOut: boolean } } = {};
  monthRecords.forEach(record => {
    const date = new Date(record.timestamp);
    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    if (!byDate[dateKey]) byDate[dateKey] = { checkIn: false, checkOut: false };
    if (record.type === AttendanceType.CHECK_IN) byDate[dateKey].checkIn = true;
    if (record.type === AttendanceType.CHECK_OUT) byDate[dateKey].checkOut = true;
  });

  const incomplete: { date: string; hasCheckIn: boolean; hasCheckOut: boolean }[] = [];
  Object.entries(byDate).forEach(([dateKey, v]) => {
    const hasBoth = v.checkIn && v.checkOut;
    if (!hasBoth && (v.checkIn || v.checkOut)) {
      incomplete.push({ date: dateKey, hasCheckIn: v.checkIn, hasCheckOut: v.checkOut });
    }
  });
  incomplete.sort((a, b) => a.date.localeCompare(b.date));
  return incomplete;
};

export const saveAttendance = async (record: AttendanceRecord): Promise<void> => {
  if (isSupabaseAvailable()) {
    try {
      // Bảng attendance_records dùng id UUID (default uuid_generate_v4()), không truyền id từ client
      const photoUrlToSave = record.photoUrl || null;

      // Log nếu photoUrl quá ngắn (có thể bị truncate)
      if (photoUrlToSave && photoUrlToSave.length < 100 && photoUrlToSave.includes('supabase.co/storage')) {
        console.warn('⚠️ Saving potentially truncated photo URL:', {
          photoUrl: photoUrlToSave,
          length: photoUrlToSave.length,
          userId: record.userId,
          timestamp: record.timestamp,
        });
      }

      const { error } = await supabase
        .from('attendance_records')
        .insert({
          user_id: record.userId,
          timestamp: record.timestamp,
          type: record.type,
          location: record.location,
          status: record.status,
          synced: record.synced,
          notes: record.notes || null,
          photo_url: photoUrlToSave,
        });

      if (error) throw new Error(`Lỗi lưu attendance: ${error.message}`);

      // Emit event và invalidate cache
      invalidateAttendanceCache();
      await emitAttendanceEvent('created', record.id);

      return;
    } catch (error) {
      console.error('Error saving attendance to Supabase:', error);
      throw error;
    }
  }

  // Fallback to localStorage
  const all = JSON.parse(localStorage.getItem(ATTENDANCE_KEY) || '[]');
  all.push(record);
  localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(all));

  // Emit event và invalidate cache
  invalidateAttendanceCache();
  await emitAttendanceEvent('created', record.id);
};

// ============ LEAVE REQUESTS ============

export const getLeaveRequests = async (userId?: string, role?: UserRole): Promise<LeaveRequest[]> => {
  if (isSupabaseAvailable()) {
    try {
      let query = supabase
        .from('leave_requests')
        .select('*');

      // If not admin, filter by userId
      if (userId && role !== UserRole.ADMIN) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error || !data) return [];

      return data.map(req => ({
        id: req.id,
        userId: req.user_id,
        startDate: req.start_date,
        endDate: req.end_date,
        type: req.type as LeaveType,
        reason: req.reason,
        status: req.status as RequestStatus,
        createdAt: req.created_at,
      }));
    } catch (error) {
      console.error('Error getting leave requests from Supabase:', error);
      return [];
    }
  }

  // Fallback to localStorage
  const all = JSON.parse(localStorage.getItem(REQUESTS_KEY) || '[]');
  if (role === UserRole.ADMIN) {
    return all.sort((a: LeaveRequest, b: LeaveRequest) => b.createdAt - a.createdAt);
  }
  return all.filter((r: LeaveRequest) => r.userId === userId).sort((a: LeaveRequest, b: LeaveRequest) => b.createdAt - a.createdAt);
};

// Function createLeaveRequest đã được xóa vì không được sử dụng
// Theo thiết kế: Chỉ admin quản lý đơn nghỉ, nhân viên không thể tạo đơn nghỉ

export const updateLeaveRequestStatus = async (id: string, status: RequestStatus): Promise<void> => {
  if (isSupabaseAvailable()) {
    try {
      const { error } = await supabase
        .from('leave_requests')
        .update({ status })
        .eq('id', id);

      if (error) throw new Error(`Lỗi cập nhật leave request: ${error.message}`);
      return;
    } catch (error) {
      console.error('Error updating leave request in Supabase:', error);
      throw error;
    }
  }

  // Fallback to localStorage
  const all = JSON.parse(localStorage.getItem(REQUESTS_KEY) || '[]');
  const idx = all.findIndex((r: LeaveRequest) => r.id === id);
  if (idx !== -1) {
    all[idx].status = status;
    localStorage.setItem(REQUESTS_KEY, JSON.stringify(all));
  }
};

// ============ SHIFT REGISTRATIONS ============

export const getShiftRegistrations = async (userId?: string, role?: UserRole): Promise<ShiftRegistration[]> => {
  if (isSupabaseAvailable()) {
    try {
      let query = supabase
        .from('shift_registrations')
        .select('*');

      // If not admin, filter by userId
      if (userId && role !== UserRole.ADMIN) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query.order('date', { ascending: false });

      if (error || !data) return [];

      return data.map(shift => ({
        id: shift.id,
        userId: shift.user_id,
        date: shift.date,
        shift: shift.shift as any,
        startTime: shift.start_time || undefined,
        endTime: shift.end_time || undefined,
        offType: shift.off_type as any,
        status: shift.status as RequestStatus,
        rejectionReason: shift.rejection_reason || undefined,
        createdAt: shift.created_at,
      }));
    } catch (error) {
      console.error('Error getting shift registrations from Supabase:', error);
      return [];
    }
  }

  // Fallback to localStorage
  const all = JSON.parse(localStorage.getItem(SHIFTS_KEY) || '[]');
  if (role === UserRole.ADMIN) {
    return all.sort((a: ShiftRegistration, b: ShiftRegistration) => b.date - a.date);
  }
  return all.filter((r: ShiftRegistration) => r.userId === userId).sort((a: ShiftRegistration, b: ShiftRegistration) => b.date - a.date);
};

/** Đăng ký ca. options.initialStatus: Admin có thể truyền APPROVED để tạo ca và duyệt luôn. */
export const registerShift = async (
  shift: ShiftRegistration,
  options?: { initialStatus?: RequestStatus }
): Promise<void> => {
  const status = options?.initialStatus ?? shift.status;
  if (isSupabaseAvailable()) {
    try {
      const { error } = await supabase
        .from('shift_registrations')
        .insert({
          user_id: shift.userId,
          date: shift.date,
          shift: shift.shift,
          start_time: shift.startTime || null,
          end_time: shift.endTime || null,
          off_type: shift.offType || null,
          status,
          created_at: shift.createdAt,
        });

      if (error) throw new Error(`Lỗi đăng ký ca: ${error.message}`);

      invalidateShiftsCache();
      await emitShiftEvent('created', shift.id);
      return;
    } catch (error) {
      console.error('Error registering shift in Supabase:', error);
      throw error;
    }
  }

  const all = JSON.parse(localStorage.getItem(SHIFTS_KEY) || '[]');
  const shiftToSave = { ...shift, status };
  all.push(shiftToSave);
  localStorage.setItem(SHIFTS_KEY, JSON.stringify(all));
  invalidateShiftsCache();
  await emitShiftEvent('created', shift.id);
};

export const updateShiftStatus = async (id: string, status: RequestStatus, rejectionReason?: string): Promise<void> => {
  if (isSupabaseAvailable()) {
    try {
      const payload: { status: RequestStatus; rejection_reason?: string | null } = { status };
      if (status === RequestStatus.REJECTED) {
        payload.rejection_reason = rejectionReason?.trim() || null;
      } else {
        payload.rejection_reason = null;
      }
      const { error } = await supabase
        .from('shift_registrations')
        .update(payload)
        .eq('id', id);

      if (error) throw new Error(`Lỗi cập nhật ca: ${error.message}`);

      // Emit event và invalidate cache
      invalidateShiftsCache();
      await emitShiftEvent('updated', id);

      return;
    } catch (error) {
      console.error('Error updating shift status in Supabase:', error);
      throw error;
    }
  }

  // Fallback to localStorage
  const all = JSON.parse(localStorage.getItem(SHIFTS_KEY) || '[]');
  const idx = all.findIndex((r: ShiftRegistration) => r.id === id);
  if (idx !== -1) {
    all[idx].status = status;
    if (status === RequestStatus.REJECTED) {
      all[idx].rejectionReason = rejectionReason?.trim() || undefined;
    } else {
      all[idx].rejectionReason = undefined;
    }
    localStorage.setItem(SHIFTS_KEY, JSON.stringify(all));

    // Emit event và invalidate cache
    invalidateShiftsCache();
    await emitShiftEvent('updated', id);
  }
};

/** Cập nhật nội dung ca đã đăng ký (đổi lịch). Nhân viên: chuyển PENDING. Admin: keepStatus=true giữ nguyên trạng thái. */
export const updateShiftRegistration = async (
  id: string,
  data: { shift: string; startTime?: string | null; endTime?: string | null; offType?: string | null },
  options?: { keepStatus?: boolean }
): Promise<void> => {
  const setPending = !options?.keepStatus;
  if (isSupabaseAvailable()) {
    try {
      const payload: Record<string, unknown> = {
        shift: data.shift,
        start_time: data.startTime || null,
        end_time: data.endTime || null,
        off_type: data.offType || null,
        rejection_reason: null,
      };
      if (setPending) {
        (payload as Record<string, RequestStatus>).status = RequestStatus.PENDING;
      }
      const { error } = await supabase
        .from('shift_registrations')
        .update(payload)
        .eq('id', id);

      if (error) throw new Error(`Lỗi đổi lịch: ${error.message}`);

      invalidateShiftsCache();
      await emitShiftEvent('updated', id);
      return;
    } catch (error) {
      console.error('Error updating shift registration:', error);
      throw error;
    }
  }

  const all = JSON.parse(localStorage.getItem(SHIFTS_KEY) || '[]');
  const idx = all.findIndex((r: ShiftRegistration) => r.id === id);
  if (idx !== -1) {
    all[idx] = {
      ...all[idx],
      shift: data.shift,
      startTime: data.startTime || undefined,
      endTime: data.endTime || undefined,
      offType: (data.offType as OffType) || undefined,
      status: setPending ? RequestStatus.PENDING : all[idx].status,
      rejectionReason: undefined,
    };
    localStorage.setItem(SHIFTS_KEY, JSON.stringify(all));
    invalidateShiftsCache();
    await emitShiftEvent('updated', id);
  }
};

// ============ PAYROLL ============

export const getPayroll = async (userId: string, month?: string): Promise<PayrollRecord[]> => {
  if (isSupabaseAvailable()) {
    try {
      let query = supabase
        .from('payroll_records')
        .select('*')
        .eq('user_id', userId);

      if (month) {
        query = query.eq('month', month);
      }

      const { data, error } = await query.order('month', { ascending: false });

      if (error || !data) return [];

      return data.map(record => ({
        id: record.id,
        userId: record.user_id,
        month: record.month,
        baseSalary: Number(record.base_salary),
        standardWorkDays: record.standard_work_days,
        actualWorkDays: record.actual_work_days,
        otHours: Number(record.ot_hours),
        otPay: Number(record.ot_pay),
        allowance: Number(record.allowance),
        bonus: Number(record.bonus),
        deductions: Number(record.deductions),
        netSalary: Number(record.net_salary),
        status: record.status as 'PAID' | 'PENDING',
      }));
    } catch (error) {
      console.error('Error getting payroll from Supabase:', error);
      return [];
    }
  }

  // Fallback to localStorage
  const saved: PayrollRecord[] = JSON.parse(localStorage.getItem(PAYROLL_KEY) || '[]');
  const savedForUser = saved.filter(r => r.userId === userId).sort((a, b) => {
    const [aMonth, aYear] = a.month.split('-').map(Number);
    const [bMonth, bYear] = b.month.split('-').map(Number);
    if (aYear !== bYear) return bYear - aYear;
    return bMonth - aMonth;
  });

  if (month) return savedForUser.filter(r => r.month === month);
  return savedForUser;
};

export const getAllPayrolls = async (month: string): Promise<PayrollRecord[]> => {
  if (isSupabaseAvailable()) {
    try {
      const { data, error } = await supabase
        .from('payroll_records')
        .select('*')
        .eq('month', month)
        .order('month', { ascending: false });

      if (error || !data) return [];

      return data.map(record => ({
        id: record.id,
        userId: record.user_id,
        month: record.month,
        baseSalary: Number(record.base_salary),
        standardWorkDays: record.standard_work_days,
        actualWorkDays: record.actual_work_days,
        otHours: Number(record.ot_hours),
        otPay: Number(record.ot_pay),
        allowance: Number(record.allowance),
        bonus: Number(record.bonus),
        deductions: Number(record.deductions),
        netSalary: Number(record.net_salary),
        status: record.status as 'PAID' | 'PENDING',
      }));
    } catch (error) {
      console.error('Error getting all payrolls from Supabase:', error);
      return [];
    }
  }

  // Fallback to localStorage
  const saved: PayrollRecord[] = JSON.parse(localStorage.getItem(PAYROLL_KEY) || '[]');
  return saved.filter(r => r.month === month).sort((a, b) => {
    const [aMonth, aYear] = a.month.split('-').map(Number);
    const [bMonth, bYear] = b.month.split('-').map(Number);
    if (aYear !== bYear) return bYear - aYear;
    return bMonth - aMonth;
  });
};

export const createOrUpdatePayroll = async (record: PayrollRecord): Promise<PayrollRecord> => {
  if (isSupabaseAvailable()) {
    try {
      const { data, error } = await supabase
        .from('payroll_records')
        .upsert({
          id: record.id,
          user_id: record.userId,
          month: record.month,
          base_salary: record.baseSalary,
          standard_work_days: record.standardWorkDays,
          actual_work_days: record.actualWorkDays,
          ot_hours: record.otHours,
          ot_pay: record.otPay,
          allowance: record.allowance,
          bonus: record.bonus,
          deductions: record.deductions,
          net_salary: record.netSalary,
          status: record.status,
        }, {
          onConflict: 'id'
        })
        .select()
        .single();

      if (error) throw new Error(`Lỗi lưu payroll: ${error.message}`);
      if (!data) throw new Error('Không thể lưu payroll record');

      return {
        id: data.id,
        userId: data.user_id,
        month: data.month,
        baseSalary: Number(data.base_salary),
        standardWorkDays: data.standard_work_days,
        actualWorkDays: data.actual_work_days,
        otHours: Number(data.ot_hours),
        otPay: Number(data.ot_pay),
        allowance: Number(data.allowance),
        bonus: Number(data.bonus),
        deductions: Number(data.deductions),
        netSalary: Number(data.net_salary),
        status: data.status as 'PAID' | 'PENDING',
      };

      // Emit event và invalidate cache
      invalidatePayrollCache(record.month);
      await emitPayrollEvent(record.id ? 'updated' : 'created', data.id);

      return {
        id: data.id,
        userId: data.user_id,
        month: data.month,
        baseSalary: Number(data.base_salary),
        standardWorkDays: data.standard_work_days,
        actualWorkDays: data.actual_work_days,
        otHours: Number(data.ot_hours),
        otPay: Number(data.ot_pay),
        allowance: Number(data.allowance),
        bonus: Number(data.bonus),
        deductions: Number(data.deductions),
        netSalary: Number(data.net_salary),
        status: data.status as 'PAID' | 'PENDING',
      };
    } catch (error) {
      console.error('Error saving payroll to Supabase:', error);
      throw error;
    }
  }

  // Fallback to localStorage
  const all: PayrollRecord[] = JSON.parse(localStorage.getItem(PAYROLL_KEY) || '[]');
  const existingIndex = all.findIndex((r: PayrollRecord) => r.id === record.id);
  const isUpdate = existingIndex >= 0;

  if (isUpdate) {
    all[existingIndex] = record;
  } else {
    all.push(record);
  }

  localStorage.setItem(PAYROLL_KEY, JSON.stringify(all));

  // Emit event và invalidate cache
  invalidatePayrollCache(record.month);
  await emitPayrollEvent(isUpdate ? 'updated' : 'created', record.id);

  return record;
};

export const calculatePayroll = async (
  employee: User,
  month: string,
  actualWorkDays?: number,
  otHours?: number,
  allowance: number = 0,
  bonus: number = 0,
  useAttendance: boolean = false,
  useLeave: boolean = true,
  useShift: boolean = true,
  customDeductions?: number // Tham số tùy chọn cho phép nhập tay số tiền khấu trừ
): Promise<PayrollRecord> => {
  const baseSalary = employee.grossSalary || employee.traineeSalary || 0;
  // Lấy các config từ system configs
  const [standardWorkDays, socialInsuranceAmount, overtimeRate, workHoursPerDay] = await Promise.all([
    getConfigNumber('standard_work_days', 27),
    getConfigNumber('social_insurance_amount', 0),
    getConfigNumber('overtime_rate', 1.5),
    getConfigNumber('work_hours_per_day', 8)
  ]);
  
  // Validation: Đảm bảo các giá trị config hợp lệ
  const validStandardWorkDays = standardWorkDays > 0 ? standardWorkDays : 27;
  const validWorkHoursPerDay = workHoursPerDay > 0 ? workHoursPerDay : 8;
  const validOvertimeRate = overtimeRate > 0 ? overtimeRate : 1.5;

  let finalWorkDays = actualWorkDays;
  let finalOtHours = otHours ?? 0;

  // Ưu tiên ngày công từ đăng ký ca (shift) — không phụ thuộc check-in/check-out
  if (useShift && actualWorkDays === undefined) {
    const shiftWorkDays = await calculateShiftWorkDays(employee.id, month);
    finalWorkDays = shiftWorkDays;
  }

  // Ưu tiên giờ OT từ đăng ký ca (shift) — không phụ thuộc check-in/check-out
  if (useShift && otHours === undefined) {
    const shiftOTHours = await calculateShiftOTHours(employee.id, month);
    finalOtHours = shiftOTHours;
  }

  // Cải thiện: Nếu không có shift hoặc shift = 0, fallback sang attendance
  // Điều này xử lý trường hợp nhân viên không đăng ký ca nhưng vẫn đi làm
  if (useAttendance && (finalWorkDays === 0 || finalWorkDays === undefined || otHours === undefined)) {
    const attendanceStats = await calculateAttendanceStats(employee.id, month);
    
    // Nếu không có shift hoặc shift = 0, dùng attendance
    if (finalWorkDays === 0 || finalWorkDays === undefined) {
      finalWorkDays = attendanceStats.actualWorkDays;
    }
    
    // Cộng thêm OT từ attendance (nếu có)
    if (otHours === undefined) {
      finalOtHours = attendanceStats.otHours;
    } else if (attendanceStats.otHours > 0) {
      // Lấy giá trị lớn hơn giữa shift OT và attendance OT
      finalOtHours = Math.max(finalOtHours, attendanceStats.otHours);
    }
  }

  // Trừ ngày nghỉ từ leave requests nếu useLeave = true
  // Lưu ý: calculateLeaveDays đã loại bỏ trùng lặp với shift OFF
  if (useLeave && finalWorkDays !== undefined) {
    const leaveDays = await calculateLeaveDays(employee.id, month);
    finalWorkDays = Math.max(0, finalWorkDays - leaveDays);
    // Làm tròn theo đơn vị 0.5 sau khi trừ ngày nghỉ
    finalWorkDays = Math.round(finalWorkDays * 2) / 2;
  }

  // Fallback to default if still undefined
  finalWorkDays = finalWorkDays ?? validStandardWorkDays;
  finalOtHours = finalOtHours ?? 0;

  // Lương theo ngày công: LCB/standardWorkDays * số ngày công thực tế
  const workDaySalary = (baseSalary / validStandardWorkDays) * finalWorkDays;
  
  // Lương OT: (LCB/standardWorkDays/workHoursPerDay) * overtimeRate * số giờ làm thêm
  // Công thức: (LCB / 27 / 8) × 1.5 × số giờ OT
  const hourlyRate = baseSalary / validStandardWorkDays / validWorkHoursPerDay;
  const otHourlyRate = hourlyRate * validOvertimeRate;
  const otPay = otHourlyRate * finalOtHours;
  
  // Debug logging để kiểm tra công thức
  if (finalOtHours > 0) {
    console.log('=== OT Calculation Debug ===');
    console.log('Employee:', employee.name);
    console.log('Base Salary:', baseSalary);
    console.log('Standard Work Days:', validStandardWorkDays);
    console.log('Work Hours Per Day:', validWorkHoursPerDay);
    console.log('Overtime Rate:', validOvertimeRate);
    console.log('OT Hours:', finalOtHours);
    console.log('Hourly Rate:', hourlyRate);
    console.log('OT Hourly Rate:', otHourlyRate);
    console.log('OT Pay:', otPay);
    console.log('Expected (manual calc):', (baseSalary / validStandardWorkDays / validWorkHoursPerDay) * validOvertimeRate * finalOtHours);
    console.log('===========================');
  }
  
  // Công thức đúng: basicSalary (theo ngày công) + overtimePay + allowance + bonus - deductions
  const totalIncome = workDaySalary + otPay + allowance + bonus;

  // Tính khấu trừ: Chỉ nhân viên chính thức mới có khấu trừ BHXH
  let deductions = 0;
  if (customDeductions !== undefined && customDeductions !== null) {
    // Nếu có nhập tay thì dùng giá trị nhập tay
    deductions = customDeductions;
  } else if (employee.contractType === ContractType.OFFICIAL) {
    // Chỉ nhân viên chính thức mới tự động khấu trừ BHXH
    deductions = socialInsuranceAmount;
  }
  // Nhân viên học việc (TRIAL) không có khấu trừ, deductions = 0

  const netSalary = totalIncome - deductions;

  // Đảm bảo tính toán chính xác (fix lỗi underpay)
  const calculatedNetSalary = Math.round(totalIncome - deductions);

  return {
    id: `pr-${employee.id}-${month}`,
    userId: employee.id,
    month,
    baseSalary: Math.round(baseSalary),
    standardWorkDays: validStandardWorkDays,
    actualWorkDays: finalWorkDays,
    otHours: finalOtHours,
    otPay: Math.round(otPay),
    allowance,
    bonus,
    deductions: Math.round(deductions),
    netSalary: calculatedNetSalary, // Sử dụng giá trị đã tính lại để đảm bảo chính xác
    status: 'PENDING'
  };
};

// ============ NOTIFICATIONS ============

export const getNotifications = async (userId: string): Promise<Notification[]> => {
  if (isSupabaseAvailable()) {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false });

      if (error || !data) return [];

      return data.map(notif => ({
        id: notif.id,
        userId: notif.user_id,
        title: notif.title,
        message: notif.message,
        read: notif.read,
        timestamp: notif.timestamp,
        type: notif.type as 'info' | 'warning' | 'success' | 'error',
      }));
    } catch (error) {
      console.error('Error getting notifications from Supabase:', error);
      return [];
    }
  }

  // Fallback to localStorage
  const all: Notification[] = JSON.parse(localStorage.getItem(NOTIFICATIONS_KEY) || '[]');
  const userNotifications = all.filter((n: Notification) => n.userId === userId);
  return userNotifications.sort((a: Notification, b: Notification) => b.timestamp - a.timestamp);
};

export const createNotification = async (notification: Omit<Notification, 'id'>): Promise<Notification> => {
  if (isSupabaseAvailable()) {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .insert({
          user_id: notification.userId,
          title: notification.title,
          message: notification.message,
          read: notification.read || false,
          timestamp: notification.timestamp,
          type: notification.type,
        })
        .select()
        .single();

      if (error) throw new Error(`Lỗi tạo notification: ${error.message}`);
      if (!data) throw new Error('Không thể tạo notification');

      const createdNotification: Notification = {
        id: data.id,
        userId: data.user_id,
        title: data.title,
        message: data.message,
        read: data.read,
        timestamp: data.timestamp,
        type: data.type as 'info' | 'warning' | 'success' | 'error',
      };

      return createdNotification;
    } catch (error) {
      console.error('Error creating notification in Supabase:', error);
      throw error;
    }
  }

  // Fallback to localStorage
  const all: Notification[] = JSON.parse(localStorage.getItem(NOTIFICATIONS_KEY) || '[]');
  const newNotification: Notification = {
    ...notification,
    id: 'notif-' + Date.now(),
  };
  all.push(newNotification);
  localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(all));
  return newNotification;
};

export const markNotificationAsRead = async (id: string): Promise<void> => {
  if (isSupabaseAvailable()) {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', id);

      if (error) throw new Error(`Lỗi cập nhật notification: ${error.message}`);
      return;
    } catch (error) {
      console.error('Error updating notification in Supabase:', error);
      throw error;
    }
  }

  // Fallback to localStorage
  const all: Notification[] = JSON.parse(localStorage.getItem(NOTIFICATIONS_KEY) || '[]');
  const idx = all.findIndex((n: Notification) => n.id === id);
  if (idx >= 0) {
    all[idx].read = true;
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(all));
  }
};

export const deleteNotification = async (id: string): Promise<void> => {
  if (isSupabaseAvailable()) {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id);

      if (error) throw new Error(`Lỗi xóa notification: ${error.message}`);
      return;
    } catch (error) {
      console.error('Error deleting notification in Supabase:', error);
      throw error;
    }
  }

  // Fallback to localStorage
  const all: Notification[] = JSON.parse(localStorage.getItem(NOTIFICATIONS_KEY) || '[]');
  const filtered = all.filter((n: Notification) => n.id !== id);
  localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(filtered));
};

export const getAllNotifications = async (): Promise<Notification[]> => {
  if (isSupabaseAvailable()) {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('timestamp', { ascending: false });

      if (error || !data) return [];

      return data.map(notif => ({
        id: notif.id,
        userId: notif.user_id,
        title: notif.title,
        message: notif.message,
        read: notif.read,
        timestamp: notif.timestamp,
        type: notif.type as 'info' | 'warning' | 'success' | 'error',
      }));
    } catch (error) {
      console.error('Error getting all notifications from Supabase:', error);
      return [];
    }
  }

  // Fallback to localStorage
  return JSON.parse(localStorage.getItem(NOTIFICATIONS_KEY) || '[]');
};

// ============ DEPARTMENTS ============

export const getDepartments = async (): Promise<Department[]> => {
  if (isSupabaseAvailable()) {
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .order('created_at', { ascending: false });

      if (error || !data) return [];

      return data.map(dept => ({
        id: dept.id,
        name: dept.name,
        code: dept.code || undefined,
        description: dept.description || undefined,
        managerId: dept.manager_id || undefined,
        createdAt: dept.created_at,
        isActive: dept.is_active ?? true,
      }));
    } catch (error) {
      console.error('Error getting departments from Supabase:', error);
      return [];
    }
  }

  // Fallback to localStorage
  return JSON.parse(localStorage.getItem('hr_connect_departments') || '[]');
};

export const createDepartment = async (data: Omit<Department, 'id' | 'createdAt'>): Promise<Department> => {
  if (isSupabaseAvailable()) {
    try {
      const { data: newDept, error } = await supabase
        .from('departments')
        .insert({
          name: data.name,
          code: data.code || null,
          description: data.description || null,
          manager_id: data.managerId || null,
          is_active: data.isActive ?? true,
          created_at: Date.now(),
        })
        .select()
        .single();

      if (error) throw new Error(`Lỗi tạo department: ${error.message}`);
      if (!newDept) throw new Error('Không thể tạo department');

      return {
        id: newDept.id,
        name: newDept.name,
        code: newDept.code || undefined,
        description: newDept.description || undefined,
        managerId: newDept.manager_id || undefined,
        createdAt: newDept.created_at,
        isActive: newDept.is_active ?? true,
      };
    } catch (error) {
      console.error('Error creating department in Supabase:', error);
      throw error;
    }
  }

  // Fallback to localStorage
  const all: Department[] = JSON.parse(localStorage.getItem('hr_connect_departments') || '[]');
  const newDepartment: Department = {
    ...data,
    id: 'dept-' + Date.now(),
    createdAt: Date.now(),
  };
  all.push(newDepartment);
  localStorage.setItem('hr_connect_departments', JSON.stringify(all));
  return newDepartment;
};

export const updateDepartment = async (id: string, data: Partial<Department>): Promise<Department> => {
  if (isSupabaseAvailable()) {
    try {
      const updateData: any = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.code !== undefined) updateData.code = data.code || null;
      if (data.description !== undefined) updateData.description = data.description || null;
      if (data.managerId !== undefined) updateData.manager_id = data.managerId || null;
      if (data.isActive !== undefined) updateData.is_active = data.isActive;

      const { data: updatedDept, error } = await supabase
        .from('departments')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw new Error(`Lỗi cập nhật department: ${error.message}`);
      if (!updatedDept) throw new Error('Không tìm thấy department');

      return {
        id: updatedDept.id,
        name: updatedDept.name,
        code: updatedDept.code || undefined,
        description: updatedDept.description || undefined,
        managerId: updatedDept.manager_id || undefined,
        createdAt: updatedDept.created_at,
        isActive: updatedDept.is_active ?? true,
      };
    } catch (error) {
      console.error('Error updating department in Supabase:', error);
      throw error;
    }
  }

  // Fallback to localStorage
  const all: Department[] = JSON.parse(localStorage.getItem('hr_connect_departments') || '[]');
  const idx = all.findIndex((d: Department) => d.id === id);
  if (idx === -1) throw new Error('Không tìm thấy department');
  all[idx] = { ...all[idx], ...data };
  localStorage.setItem('hr_connect_departments', JSON.stringify(all));
  return all[idx];
};

export const deleteDepartment = async (id: string): Promise<void> => {
  if (isSupabaseAvailable()) {
    try {
      const { error } = await supabase
        .from('departments')
        .delete()
        .eq('id', id);

      if (error) throw new Error(`Lỗi xóa department: ${error.message}`);
      return;
    } catch (error) {
      console.error('Error deleting department in Supabase:', error);
      throw error;
    }
  }

  // Fallback to localStorage
  const all: Department[] = JSON.parse(localStorage.getItem('hr_connect_departments') || '[]');
  const filtered = all.filter((d: Department) => d.id !== id);
  localStorage.setItem('hr_connect_departments', JSON.stringify(filtered));
};

// ============ HOLIDAYS ============

export const getHolidays = async (): Promise<Holiday[]> => {
  if (isSupabaseAvailable()) {
    try {
      const { data, error } = await supabase
        .from('holidays')
        .select('*')
        .order('date', { ascending: true });

      if (error || !data) return [];

      return data.map(holiday => ({
        id: holiday.id,
        name: holiday.name,
        date: holiday.date,
        type: holiday.type as 'NATIONAL' | 'COMPANY' | 'REGIONAL',
        isRecurring: holiday.is_recurring ?? false,
        description: holiday.description || undefined,
        createdAt: holiday.created_at,
      }));
    } catch (error) {
      console.error('Error getting holidays from Supabase:', error);
      return [];
    }
  }

  // Fallback to localStorage
  return JSON.parse(localStorage.getItem('hr_connect_holidays') || '[]');
};

export const createHoliday = async (data: Omit<Holiday, 'id' | 'createdAt'>): Promise<Holiday> => {
  if (isSupabaseAvailable()) {
    try {
      const { data: newHoliday, error } = await supabase
        .from('holidays')
        .insert({
          name: data.name,
          date: data.date,
          type: data.type,
          is_recurring: data.isRecurring ?? false,
          description: data.description || null,
          created_at: Date.now(),
        })
        .select()
        .single();

      if (error) throw new Error(`Lỗi tạo holiday: ${error.message}`);
      if (!newHoliday) throw new Error('Không thể tạo holiday');

      return {
        id: newHoliday.id,
        name: newHoliday.name,
        date: newHoliday.date,
        type: newHoliday.type as 'NATIONAL' | 'COMPANY' | 'REGIONAL',
        isRecurring: newHoliday.is_recurring ?? false,
        description: newHoliday.description || undefined,
        createdAt: newHoliday.created_at,
      };
    } catch (error) {
      console.error('Error creating holiday in Supabase:', error);
      throw error;
    }
  }

  // Fallback to localStorage
  const all: Holiday[] = JSON.parse(localStorage.getItem('hr_connect_holidays') || '[]');
  const newHoliday: Holiday = {
    ...data,
    id: 'holiday-' + Date.now(),
    createdAt: Date.now(),
  };
  all.push(newHoliday);
  localStorage.setItem('hr_connect_holidays', JSON.stringify(all));
  return newHoliday;
};

export const updateHoliday = async (id: string, data: Partial<Holiday>): Promise<Holiday> => {
  if (isSupabaseAvailable()) {
    try {
      const updateData: any = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.date !== undefined) updateData.date = data.date;
      if (data.type !== undefined) updateData.type = data.type;
      if (data.isRecurring !== undefined) updateData.is_recurring = data.isRecurring;
      if (data.description !== undefined) updateData.description = data.description || null;

      const { data: updatedHoliday, error } = await supabase
        .from('holidays')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw new Error(`Lỗi cập nhật holiday: ${error.message}`);
      if (!updatedHoliday) throw new Error('Không tìm thấy holiday');

      return {
        id: updatedHoliday.id,
        name: updatedHoliday.name,
        date: updatedHoliday.date,
        type: updatedHoliday.type as 'NATIONAL' | 'COMPANY' | 'REGIONAL',
        isRecurring: updatedHoliday.is_recurring ?? false,
        description: updatedHoliday.description || undefined,
        createdAt: updatedHoliday.created_at,
      };
    } catch (error) {
      console.error('Error updating holiday in Supabase:', error);
      throw error;
    }
  }

  // Fallback to localStorage
  const all: Holiday[] = JSON.parse(localStorage.getItem('hr_connect_holidays') || '[]');
  const idx = all.findIndex((h: Holiday) => h.id === id);
  if (idx === -1) throw new Error('Không tìm thấy holiday');
  all[idx] = { ...all[idx], ...data };
  localStorage.setItem('hr_connect_holidays', JSON.stringify(all));
  return all[idx];
};

export const deleteHoliday = async (id: string): Promise<void> => {
  if (isSupabaseAvailable()) {
    try {
      const { error } = await supabase
        .from('holidays')
        .delete()
        .eq('id', id);

      if (error) throw new Error(`Lỗi xóa holiday: ${error.message}`);
      return;
    } catch (error) {
      console.error('Error deleting holiday in Supabase:', error);
      throw error;
    }
  }

  // Fallback to localStorage
  const all: Holiday[] = JSON.parse(localStorage.getItem('hr_connect_holidays') || '[]');
  const filtered = all.filter((h: Holiday) => h.id !== id);
  localStorage.setItem('hr_connect_holidays', JSON.stringify(filtered));
};

/** Import ngày lễ Việt Nam mặc định (có hưởng lương theo Bộ luật Lao động). Trả về số ngày lễ đã thêm mới. */
export const seedVietnamHolidays = async (): Promise<{ added: number; skipped: number }> => {
  const { getVietnamHolidaysSeed } = await import('../data/vietnam-holidays');
  const seeds = getVietnamHolidaysSeed();
  const existing = await getHolidays();
  const existingDateSet = new Set(existing.map(h => h.date));
  const existingRecurringKeys = new Set(
    existing.filter(h => h.isRecurring).map(h => {
      const d = new Date(h.date);
      return `${h.name}|${d.getMonth()}|${d.getDate()}`;
    })
  );
  let added = 0;
  let skipped = 0;

  for (const seed of seeds) {
    const d = new Date(seed.date);
    const recurringKey = `${seed.name}|${d.getMonth()}|${d.getDate()}`;
    const isDuplicate = seed.isRecurring
      ? existingRecurringKeys.has(recurringKey)
      : existingDateSet.has(seed.date);
    if (isDuplicate) {
      skipped++;
      continue;
    }
    try {
      await createHoliday(seed);
      existingDateSet.add(seed.date);
      if (seed.isRecurring) existingRecurringKeys.add(recurringKey);
      added++;
    } catch {
      skipped++;
    }
  }

  if (added > 0) {
    invalidateHolidaysCache();
  }
  return { added, skipped };
};

// ============ SYSTEM CONFIGS ============

export const getSystemConfigs = async (): Promise<SystemConfig[]> => {
  if (isSupabaseAvailable()) {
    try {
      const { data, error } = await supabase
        .from('system_configs')
        .select('*')
        .order('category', { ascending: true });

      if (error || !data) return [];

      // DB lưu updated_at Unix seconds (theo migration); chuẩn hóa ra ms cho app
      return data.map(config => ({
        id: config.id,
        key: config.key,
        value: config.value,
        description: config.description || undefined,
        category: config.category as 'ATTENDANCE' | 'PAYROLL' | 'GENERAL' | 'NOTIFICATION',
        updatedAt: config.updated_at < 1e12 ? config.updated_at * 1000 : config.updated_at,
        updatedBy: config.updated_by || undefined,
      }));
    } catch (error) {
      console.error('Error getting system configs from Supabase:', error);
      return [];
    }
  }

  // Fallback to localStorage
  const saved = localStorage.getItem('hr_connect_system_configs');
  if (saved) {
    return JSON.parse(saved);
  }
  // Return default configs if not found
  return [];
};

export const updateSystemConfig = async (id: string, value: string, updatedBy?: string): Promise<SystemConfig> => {
  if (isSupabaseAvailable()) {
    try {
      const { data: updatedConfig, error } = await supabase
        .from('system_configs')
        .update({
          value,
          updated_at: Math.floor(Date.now() / 1000),
          updated_by: updatedBy || null,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw new Error(`Lỗi cập nhật config: ${error.message}`);
      if (!updatedConfig) throw new Error('Không tìm thấy config');

      // Invalidate cache sau khi update
      invalidateConfigCache();
      await emitConfigEvent();

      return {
        id: updatedConfig.id,
        key: updatedConfig.key,
        value: updatedConfig.value,
        description: updatedConfig.description || undefined,
        category: updatedConfig.category as 'ATTENDANCE' | 'PAYROLL' | 'GENERAL' | 'NOTIFICATION',
        updatedAt: updatedConfig.updated_at < 1e12 ? updatedConfig.updated_at * 1000 : updatedConfig.updated_at,
        updatedBy: updatedConfig.updated_by || undefined,
      };
    } catch (error) {
      console.error('Error updating system config in Supabase:', error);
      throw error;
    }
  }

  // Fallback to localStorage
  const all: SystemConfig[] = JSON.parse(localStorage.getItem('hr_connect_system_configs') || '[]');
  const idx = all.findIndex((c: SystemConfig) => c.id === id);
  if (idx === -1) throw new Error('Không tìm thấy config');
  all[idx] = { ...all[idx], value, updatedAt: Date.now(), updatedBy };
  localStorage.setItem('hr_connect_system_configs', JSON.stringify(all));
  invalidateConfigCache();
  await emitConfigEvent();
  return all[idx];
};



// ============ SYSTEM CONFIG HELPERS ============

/** Cache để tránh load configs nhiều lần */
let configCache: SystemConfig[] | null = null;
let configCacheTime: number = 0;
const CONFIG_CACHE_TTL = 5 * 60 * 1000; // 5 phút

/** Load và cache system configs */
const loadConfigsWithCache = async (): Promise<SystemConfig[]> => {
  const now = Date.now();
  if (configCache && (now - configCacheTime) < CONFIG_CACHE_TTL) {
    return configCache;
  }
  configCache = await getSystemConfigs();
  configCacheTime = now;
  return configCache;
};

/** Lấy giá trị config theo key với fallback */
export const getConfigValue = async (key: string, defaultValue: string): Promise<string> => {
  try {
    const configs = await loadConfigsWithCache();
    const config = configs.find(c => c.key === key);
    return config?.value || defaultValue;
  } catch (error) {
    console.error(`Error getting config ${key}:`, error);
    return defaultValue;
  }
};

/** Lấy giá trị config dạng number với fallback */
export const getConfigNumber = async (key: string, defaultValue: number): Promise<number> => {
  const value = await getConfigValue(key, String(defaultValue));
  const num = parseFloat(value);
  return isNaN(num) ? defaultValue : num;
};

/** Lấy office location từ config */
export const getOfficeLocation = async (): Promise<{ lat: number; lng: number; radiusMeters: number }> => {
  const [lat, lng, radius] = await Promise.all([
    getConfigNumber('office_latitude', 10.040675858019696),
    getConfigNumber('office_longitude', 105.78463187148355),
    getConfigNumber('office_radius_meters', 200)
  ]);
  return { lat, lng, radiusMeters: radius };
};

/** Invalidate config cache (gọi sau khi update config) */
export const invalidateConfigCache = () => {
  configCache = null;
  configCacheTime = 0;
};

// ============ CACHE INVALIDATION HELPERS ============

/**
 * Cache invalidation cho các loại dữ liệu
 * Các component có thể listen events để tự động reload khi cache bị invalidate
 */

// Users cache (nếu có)
let usersCache: User[] | null = null;
export const invalidateUsersCache = () => {
  usersCache = null;
};

// Attendance cache (nếu có)
let attendanceCache: AttendanceRecord[] | null = null;
export const invalidateAttendanceCache = () => {
  attendanceCache = null;
};

// Shifts cache (nếu có)
let shiftsCache: ShiftRegistration[] | null = null;
export const invalidateShiftsCache = () => {
  shiftsCache = null;
};

// Payroll cache (nếu có) - giới hạn 12 tháng để tránh memory leak khi dùng lâu
const PAYROLL_CACHE_MAX_MONTHS = 12;
let payrollCache: Map<string, PayrollRecord[]> = new Map();

function trimPayrollCacheIfNeeded(): void {
  if (payrollCache.size <= PAYROLL_CACHE_MAX_MONTHS) return;
  const keys = Array.from(payrollCache.keys()).sort();
  const toDelete = keys.slice(0, keys.length - PAYROLL_CACHE_MAX_MONTHS);
  toDelete.forEach(k => payrollCache.delete(k));
}

export const invalidatePayrollCache = (month?: string) => {
  if (month) {
    payrollCache.delete(month);
  } else {
    payrollCache.clear();
  }
  trimPayrollCacheIfNeeded();
};

// Departments cache (nếu có)
let departmentsCache: Department[] | null = null;
export const invalidateDepartmentsCache = () => {
  departmentsCache = null;
};

// Holidays cache (nếu có)
let holidaysCache: Holiday[] | null = null;
export const invalidateHolidaysCache = () => {
  holidaysCache = null;
};

/**
 * Invalidate tất cả caches
 */
export const invalidateAllCaches = () => {
  invalidateConfigCache();
  invalidateUsersCache();
  invalidateAttendanceCache();
  invalidateShiftsCache();
  invalidatePayrollCache();
  invalidateDepartmentsCache();
  invalidateHolidaysCache();
};

// ============ OTP CODES ============

interface OTPCode {
  id: string;
  email: string;
  code: string;
  expiresAt: number;
  used: boolean;
  createdAt: number;
}

/**
 * Tạo mã OTP và lưu vào database
 */
export const createOTPCode = async (email: string, expiresInMinutes: number = 5): Promise<{ code: string; expiresAt: number } | null> => {
  // Tạo mã OTP 6 chữ số ngẫu nhiên
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + expiresInMinutes * 60 * 1000;

  if (isSupabaseAvailable()) {
    try {
      const { data, error } = await supabase
        .from('otp_codes')
        .insert({
          email: email.toLowerCase(),
          code: code,
          expires_at: new Date(expiresAt).toISOString(),
          used: false,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating OTP code:', error);
        return null;
      }

      return {
        code: code,
        expiresAt: expiresAt,
      };
    } catch (error) {
      console.error('Error creating OTP code in Supabase:', error);
      return null;
    }
  }

  // Fallback to localStorage
  const otpCodes: OTPCode[] = JSON.parse(localStorage.getItem(OTP_CODES_KEY) || '[]');
  const newOTP: OTPCode = {
    id: 'otp_' + Date.now(),
    email: email.toLowerCase(),
    code: code,
    expiresAt: expiresAt,
    used: false,
    createdAt: Date.now(),
  };
  otpCodes.push(newOTP);
  // Xóa các OTP đã hết hạn
  const validOTPs = otpCodes.filter(otp => otp.expiresAt > Date.now());
  localStorage.setItem(OTP_CODES_KEY, JSON.stringify(validOTPs));

  return {
    code: code,
    expiresAt: expiresAt,
  };
};

/**
 * Xác thực mã OTP
 */
export const verifyOTPCode = async (email: string, code: string): Promise<boolean> => {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedCode = code.trim();

  if (isSupabaseAvailable()) {
    try {
      // Tìm OTP chưa dùng và chưa hết hạn
      // Select cả expires_at để kiểm tra lại trong code
      const { data, error } = await supabase
        .from('otp_codes')
        .select('id, expires_at')
        .eq('email', normalizedEmail)
        .eq('code', normalizedCode)
        .eq('used', false)
        .gt('expires_at', new Date().toISOString())
        .limit(1)
        .maybeSingle();

      if (error || !data) {
        return false;
      }

      // Kiểm tra lại expiration một lần nữa để đảm bảo chắc chắn
      // Chuyển expires_at từ ISO string sang timestamp để so sánh chính xác
      const expiresAt = new Date(data.expires_at).getTime();
      const now = Date.now();

      if (expiresAt <= now) {
        // OTP đã hết hạn
        return false;
      }

      // Đánh dấu OTP đã được sử dụng
      // Sử dụng function mark_otp_as_used để bypass RLS nếu cần
      const { data: updateResult, error: updateError } = await supabase
        .rpc('mark_otp_as_used', { p_otp_id: data.id });

      if (updateError) {
        // Fallback: Thử UPDATE trực tiếp nếu function không tồn tại
        console.warn('Function mark_otp_as_used không khả dụng, thử UPDATE trực tiếp:', updateError);
        const { error: directUpdateError } = await supabase
          .from('otp_codes')
          .update({ used: true })
          .eq('id', data.id);

        if (directUpdateError) {
          console.error('Error marking OTP as used:', directUpdateError);
          return false;
        }
      } else if (updateResult === false) {
        // Function trả về false nghĩa là OTP không hợp lệ hoặc đã được dùng
        console.warn('OTP không hợp lệ hoặc đã được sử dụng');
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error verifying OTP code:', error);
      return false;
    }
  }

  // Fallback to localStorage
  const otpCodes: OTPCode[] = JSON.parse(localStorage.getItem(OTP_CODES_KEY) || '[]');
  const otp = otpCodes.find(
    otp =>
      otp.email === normalizedEmail &&
      otp.code === normalizedCode &&
      !otp.used &&
      otp.expiresAt > Date.now()
  );

  if (otp) {
    // Đánh dấu đã sử dụng
    otp.used = true;
    localStorage.setItem(OTP_CODES_KEY, JSON.stringify(otpCodes));
    return true;
  }

  return false;
};

// ============ OFFLINE SYNC ============

/**
 * Đồng bộ các attendance records chưa được sync từ localStorage lên Supabase
 * Chỉ sync khi Supabase available và đang online
 */
export const syncOfflineAttendance = async (): Promise<{ synced: number; errors: number }> => {
  if (!isSupabaseAvailable() || !navigator.onLine) {
    return { synced: 0, errors: 0 };
  }

  try {
    // Lấy tất cả records từ localStorage
    const localRecords: AttendanceRecord[] = JSON.parse(localStorage.getItem(ATTENDANCE_KEY) || '[]');

    // Lọc các records chưa được sync
    const unsyncedRecords = localRecords.filter(record => !record.synced);

    if (unsyncedRecords.length === 0) {
      return { synced: 0, errors: 0 };
    }

    let syncedCount = 0;
    let errorCount = 0;

    // Sync từng record lên Supabase
    for (const record of unsyncedRecords) {
      try {
        // Kiểm tra xem record đã tồn tại trên Supabase chưa (dựa vào timestamp và user_id)
        const { data: existing } = await supabase
          .from('attendance_records')
          .select('id')
          .eq('user_id', record.userId)
          .eq('timestamp', record.timestamp)
          .maybeSingle();

        if (existing) {
          // Record đã tồn tại, đánh dấu là synced trong localStorage
          const updatedRecords = localRecords.map(r =>
            r.id === record.id ? { ...r, synced: true } : r
          );
          localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(updatedRecords));
          syncedCount++;
          continue;
        }

        // Insert record mới vào Supabase
        const { error } = await supabase
          .from('attendance_records')
          .insert({
            user_id: record.userId,
            timestamp: record.timestamp,
            type: record.type,
            location: record.location,
            status: record.status,
            synced: true,
            notes: record.notes || null,
            photo_url: record.photoUrl || null,
          });

        if (error) {
          console.error('Error syncing attendance record:', error);
          errorCount++;
        } else {
          // Đánh dấu record đã được sync trong localStorage
          const updatedRecords = localRecords.map(r =>
            r.id === record.id ? { ...r, synced: true } : r
          );
          localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(updatedRecords));
          syncedCount++;
        }
      } catch (error) {
        console.error('Error syncing individual attendance record:', error);
        errorCount++;
      }
    }

    return { synced: syncedCount, errors: errorCount };
  } catch (error) {
    console.error('Error syncing offline attendance:', error);
    return { synced: 0, errors: 0 };
  }
};

/**
 * Đồng bộ tất cả dữ liệu offline (attendance, leave requests, shifts, etc.)
 */
export const syncAllOfflineData = async (): Promise<{
  attendance: { synced: number; errors: number };
  totalSynced: number;
  totalErrors: number;
}> => {
  const attendance = await syncOfflineAttendance();

  // Có thể thêm sync cho các loại dữ liệu khác ở đây nếu cần

  return {
    attendance,
    totalSynced: attendance.synced,
    totalErrors: attendance.errors,
  };
};

// Initialize database on module load
initializeDB();

export const createSystemConfig = async (
  key: string,
  value: string,
  description?: string,
  category: string = 'GENERAL'
): Promise<SystemConfig> => {
  if (isSupabaseAvailable()) {
    try {
      const { data, error } = await supabase
        .from('system_configs')
        .insert({
          key,
          value,
          description,
          category,
          updated_at: Math.floor(Date.now() / 1000)
        })
        .select()
        .single();

      if (error) throw new Error(`Lỗi tạo config: ${error.message}`);
      if (!data) throw new Error('Không thể tạo config');

      invalidateConfigCache();
      await emitConfigEvent();

      return {
        id: data.id,
        key: data.key,
        value: data.value,
        description: data.description || undefined,
        category: data.category as any,
        updatedAt: data.updated_at < 1e12 ? data.updated_at * 1000 : data.updated_at,
        updatedBy: data.updated_by || undefined,
      };
    } catch (error) {
      console.error('Error creating system config in Supabase:', error);
      throw error;
    }
  }

  // Fallback to localStorage
  const all: SystemConfig[] = JSON.parse(localStorage.getItem('hr_connect_system_configs') || '[]');
  // Check duplicate
  if (all.some(c => c.key === key)) {
    throw new Error('Config key already exists');
  }

  const newConfig: SystemConfig = {
    id: 'cfg_' + Date.now() + Math.random().toString(36).substr(2, 9),
    key,
    value,
    description,
    category: category as any,
    updatedAt: Date.now()
  };

  all.push(newConfig);
  localStorage.setItem('hr_connect_system_configs', JSON.stringify(all));
  invalidateConfigCache();
  await emitConfigEvent();
  return newConfig;
};
