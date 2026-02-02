import { User, UserRole, AttendanceRecord, LeaveRequest, Notification, RequestStatus, LeaveType, ShiftRegistration, PayrollRecord, ContractType, EmployeeStatus, AttendanceType } from '../types';
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
      const { data: existingAdmin } = await supabase
        .from('users')
        .select('id')
        .eq('email', ADMIN_USER.email)
        .single();

      if (!existingAdmin) {
        // Tạo admin user nếu chưa có
        await supabase.from('users').insert({
          id: ADMIN_USER.id,
          name: ADMIN_USER.name,
          email: ADMIN_USER.email,
          role: ADMIN_USER.role,
          department: ADMIN_USER.department,
          status: ADMIN_USER.status,
          contract_type: ADMIN_USER.contractType,
        });
      }
    } catch (error) {
      console.warn('⚠️ Không thể khởi tạo Supabase, fallback về localStorage:', error);
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
      if (existing) throw new Error('Email đã tồn tại');

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

      if (error) throw new Error(`Lỗi tạo user: ${error.message}`);
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

      // If not admin/HR/Manager, filter by userId
      if (userId && role !== UserRole.HR && role !== UserRole.ADMIN && role !== UserRole.MANAGER) {
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
  if (role === UserRole.HR || role === UserRole.ADMIN || role === UserRole.MANAGER) {
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

      // If not admin/HR/Manager, filter by userId
      if (userId && role !== UserRole.HR && role !== UserRole.ADMIN && role !== UserRole.MANAGER) {
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
  if (role === UserRole.HR || role === UserRole.ADMIN || role !== UserRole.MANAGER) {
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
          id: shift.id,
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

// Initialize database on module load
initializeDB();
