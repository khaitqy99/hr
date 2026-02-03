import { User, UserRole, AttendanceRecord, LeaveRequest, Notification, RequestStatus, LeaveType, ShiftRegistration, PayrollRecord, ContractType, EmployeeStatus, AttendanceType, Department, Holiday, SystemConfig } from '../types';
import { supabase } from './supabase';

// Helper để check Supabase connection
const isSupabaseAvailable = (): boolean => {
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
};

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
        if (error.code === '23505' || error.message.includes('duplicate') || error.message.includes('unique')) {
          // User đã tồn tại, lấy user đó
          const existingUser = await getCurrentUser(data.email);
          if (existingUser) {
            console.warn('User already exists (409), returning existing user');
            return existingUser;
          }
        }
        throw new Error(`Lỗi tạo user: ${error.message}`);
      }
      if (!newUser) throw new Error('Không thể tạo user');

      return {
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

      return data.map(record => ({
        id: record.id,
        userId: record.user_id,
        timestamp: record.timestamp,
        type: record.type as AttendanceType,
        location: record.location as { lat: number; lng: number; address?: string },
        status: record.status as any,
        synced: record.synced,
        notes: record.notes || undefined,
        photoUrl: record.photo_url || undefined,
      }));
    } catch (error) {
      console.error('Error getting attendance from Supabase:', error);
      return [];
    }
  }

  // Fallback to localStorage
  const all = JSON.parse(localStorage.getItem(ATTENDANCE_KEY) || '[]');
  return all.filter((r: AttendanceRecord) => r.userId === userId).sort((a: AttendanceRecord, b: AttendanceRecord) => b.timestamp - a.timestamp);
};

export const getAllAttendance = async (): Promise<AttendanceRecord[]> => {
  if (isSupabaseAvailable()) {
    try {
      const { data, error } = await supabase
        .from('attendance_records')
        .select('*')
        .order('timestamp', { ascending: false });

      if (error || !data) return [];

      return data.map(record => ({
        id: record.id,
        userId: record.user_id,
        timestamp: record.timestamp,
        type: record.type as AttendanceType,
        location: record.location as { lat: number; lng: number; address?: string },
        status: record.status as any,
        synced: record.synced,
        notes: record.notes || undefined,
        photoUrl: record.photo_url || undefined,
      }));
    } catch (error) {
      console.error('Error getting all attendance from Supabase:', error);
      return [];
    }
  }

  // Fallback to localStorage
  const all = JSON.parse(localStorage.getItem(ATTENDANCE_KEY) || '[]');
  return all.sort((a: AttendanceRecord, b: AttendanceRecord) => b.timestamp - a.timestamp);
};

export const deleteAttendance = async (id: string): Promise<void> => {
  if (isSupabaseAvailable()) {
    try {
      const { error } = await supabase
        .from('attendance_records')
        .delete()
        .eq('id', id);

      if (error) throw new Error(`Lỗi xóa attendance: ${error.message}`);
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
  const standardWorkHours = 8; // 8 hours per day
  
  Object.values(recordsByDate).forEach(dayRecords => {
    if (dayRecords.checkIn && dayRecords.checkOut) {
      // Valid work day (has both check-in and check-out)
      actualWorkDays++;
      
      // Calculate work hours
      const checkInTime = dayRecords.checkIn.timestamp;
      const checkOutTime = dayRecords.checkOut.timestamp;
      const workHours = (checkOutTime - checkInTime) / (1000 * 60 * 60); // Convert to hours
      
      // Calculate OT hours (hours beyond standard 8 hours)
      if (workHours > standardWorkHours) {
        totalOtHours += workHours - standardWorkHours;
      }
    }
  });
  
  return {
    actualWorkDays,
    otHours: Math.round(totalOtHours * 10) / 10 // Round to 1 decimal place
  };
};

export const saveAttendance = async (record: AttendanceRecord): Promise<void> => {
  if (isSupabaseAvailable()) {
    try {
      const { error } = await supabase
        .from('attendance_records')
        .insert({
          id: record.id,
          user_id: record.userId,
          timestamp: record.timestamp,
          type: record.type,
          location: record.location,
          status: record.status,
          synced: record.synced,
          notes: record.notes || null,
          photo_url: record.photoUrl || null,
        });

      if (error) throw new Error(`Lỗi lưu attendance: ${error.message}`);
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

export const createLeaveRequest = async (request: LeaveRequest): Promise<void> => {
  if (isSupabaseAvailable()) {
    try {
      const { error } = await supabase
        .from('leave_requests')
        .insert({
          id: request.id,
          user_id: request.userId,
          start_date: request.startDate,
          end_date: request.endDate,
          type: request.type,
          reason: request.reason,
          status: request.status,
          created_at: request.createdAt,
        });

      if (error) throw new Error(`Lỗi tạo leave request: ${error.message}`);
      return;
    } catch (error) {
      console.error('Error creating leave request in Supabase:', error);
      throw error;
    }
  }

  // Fallback to localStorage
  const all = JSON.parse(localStorage.getItem(REQUESTS_KEY) || '[]');
  all.push(request);
  localStorage.setItem(REQUESTS_KEY, JSON.stringify(all));
};

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

export const registerShift = async (shift: ShiftRegistration): Promise<void> => {
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
          status: shift.status,
          created_at: shift.createdAt,
        });

      if (error) throw new Error(`Lỗi đăng ký ca: ${error.message}`);
      return;
    } catch (error) {
      console.error('Error registering shift in Supabase:', error);
      throw error;
    }
  }

  // Fallback to localStorage
  const all = JSON.parse(localStorage.getItem(SHIFTS_KEY) || '[]');
  all.push(shift);
  localStorage.setItem(SHIFTS_KEY, JSON.stringify(all));
};

export const updateShiftStatus = async (id: string, status: RequestStatus): Promise<void> => {
  if (isSupabaseAvailable()) {
    try {
      const { error } = await supabase
        .from('shift_registrations')
        .update({ status })
        .eq('id', id);

      if (error) throw new Error(`Lỗi cập nhật ca: ${error.message}`);
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
    localStorage.setItem(SHIFTS_KEY, JSON.stringify(all));
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
    } catch (error) {
      console.error('Error saving payroll to Supabase:', error);
      throw error;
    }
  }

  // Fallback to localStorage
  const all: PayrollRecord[] = JSON.parse(localStorage.getItem(PAYROLL_KEY) || '[]');
  const existingIndex = all.findIndex((r: PayrollRecord) => r.id === record.id);
  
  if (existingIndex >= 0) {
    all[existingIndex] = record;
  } else {
    all.push(record);
  }
  
  localStorage.setItem(PAYROLL_KEY, JSON.stringify(all));
  return record;
};

export const calculatePayroll = async (
  employee: User, 
  month: string, 
  actualWorkDays?: number, 
  otHours?: number, 
  allowance: number = 0, 
  bonus: number = 0,
  useAttendance: boolean = true
): Promise<PayrollRecord> => {
  const baseSalary = employee.grossSalary || employee.traineeSalary || 0;
  const standardWorkDays = 27; // Số ngày chuẩn để tính lương
  
  // Auto-calculate from attendance if not provided and useAttendance is true
  let finalWorkDays = actualWorkDays;
  let finalOtHours = otHours || 0;
  
  if (useAttendance && (actualWorkDays === undefined || otHours === undefined)) {
    const attendanceStats = await calculateAttendanceStats(employee.id, month);
    if (actualWorkDays === undefined) {
      finalWorkDays = attendanceStats.actualWorkDays;
    }
    if (otHours === undefined) {
      finalOtHours = attendanceStats.otHours;
    }
  }
  
  // Fallback to default if still undefined
  finalWorkDays = finalWorkDays ?? standardWorkDays;
  finalOtHours = finalOtHours ?? 0;
  
  // Công thức: lương cơ bản / 27 * số ngày công thực tế
  const workDaySalary = (baseSalary / 27) * finalWorkDays;
  const dailySalary = baseSalary / 27; // Dùng để tính OT
  const otPay = (dailySalary / 8) * 1.5 * finalOtHours;
  // Công thức đúng: basicSalary (theo ngày công) + overtimePay + allowance + bonus - deductions
  const totalIncome = workDaySalary + otPay + allowance + bonus;
  const deductions = totalIncome * 0.105; // 10.5% BHXH, Thuế, etc.
  const netSalary = totalIncome - deductions;
  
  // Đảm bảo tính toán chính xác (fix lỗi underpay)
  const calculatedNetSalary = Math.round(totalIncome - deductions);

  return {
    id: `pr-${employee.id}-${month}`,
    userId: employee.id,
    month,
    baseSalary: Math.round(baseSalary),
    standardWorkDays,
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

      return {
        id: data.id,
        userId: data.user_id,
        title: data.title,
        message: data.message,
        read: data.read,
        timestamp: data.timestamp,
        type: data.type as 'info' | 'warning' | 'success' | 'error',
      };
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

// ============ SYSTEM CONFIGS ============

export const getSystemConfigs = async (): Promise<SystemConfig[]> => {
  if (isSupabaseAvailable()) {
    try {
      const { data, error } = await supabase
        .from('system_configs')
        .select('*')
        .order('category', { ascending: true });

      if (error || !data) return [];

      return data.map(config => ({
        id: config.id,
        key: config.key,
        value: config.value,
        description: config.description || undefined,
        category: config.category as 'ATTENDANCE' | 'PAYROLL' | 'GENERAL' | 'NOTIFICATION',
        updatedAt: config.updated_at,
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
          updated_at: Date.now(),
          updated_by: updatedBy || null,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw new Error(`Lỗi cập nhật config: ${error.message}`);
      if (!updatedConfig) throw new Error('Không tìm thấy config');

      return {
        id: updatedConfig.id,
        key: updatedConfig.key,
        value: updatedConfig.value,
        description: updatedConfig.description || undefined,
        category: updatedConfig.category as 'ATTENDANCE' | 'PAYROLL' | 'GENERAL' | 'NOTIFICATION',
        updatedAt: updatedConfig.updated_at,
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
  return all[idx];
};

export const createSystemConfig = async (data: Omit<SystemConfig, 'id' | 'updatedAt'>): Promise<SystemConfig> => {
  if (isSupabaseAvailable()) {
    try {
      const { data: newConfig, error } = await supabase
        .from('system_configs')
        .insert({
          key: data.key,
          value: data.value,
          description: data.description || null,
          category: data.category,
          updated_at: Date.now(),
          updated_by: data.updatedBy || null,
        })
        .select()
        .single();

      if (error) throw new Error(`Lỗi tạo config: ${error.message}`);
      if (!newConfig) throw new Error('Không thể tạo config');

      return {
        id: newConfig.id,
        key: newConfig.key,
        value: newConfig.value,
        description: newConfig.description || undefined,
        category: newConfig.category as 'ATTENDANCE' | 'PAYROLL' | 'GENERAL' | 'NOTIFICATION',
        updatedAt: newConfig.updated_at,
        updatedBy: newConfig.updated_by || undefined,
      };
    } catch (error) {
      console.error('Error creating system config in Supabase:', error);
      throw error;
    }
  }

  // Fallback to localStorage
  const all: SystemConfig[] = JSON.parse(localStorage.getItem('hr_connect_system_configs') || '[]');
  const newConfig: SystemConfig = {
    ...data,
    id: 'config-' + Date.now(),
    updatedAt: Date.now(),
  };
  all.push(newConfig);
  localStorage.setItem('hr_connect_system_configs', JSON.stringify(all));
  return newConfig;
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

/**
 * Xóa các mã OTP đã hết hạn
 */
export const cleanupExpiredOTPs = async (): Promise<void> => {
  if (isSupabaseAvailable()) {
    try {
      await supabase.rpc('cleanup_expired_otps');
    } catch (error) {
      console.error('Error cleaning up expired OTPs:', error);
    }
  } else {
    // Fallback to localStorage
    const otpCodes: OTPCode[] = JSON.parse(localStorage.getItem(OTP_CODES_KEY) || '[]');
    const validOTPs = otpCodes.filter(otp => otp.expiresAt > Date.now());
    localStorage.setItem(OTP_CODES_KEY, JSON.stringify(validOTPs));
  }
};

// Initialize database on module load
initializeDB();
