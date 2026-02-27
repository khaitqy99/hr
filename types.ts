export enum UserRole {
  EMPLOYEE = 'EMPLOYEE',
  MANAGER = 'MANAGER',
  HR = 'HR',
  ADMIN = 'ADMIN'
}

/** Loại hợp đồng */
export enum ContractType {
  TRIAL = 'TRIAL',           // Thử việc
  OFFICIAL = 'OFFICIAL',     // Chính thức
  TEMPORARY = 'TEMPORARY'    // Thời vụ
}

/** Trạng thái nhân viên */
export enum EmployeeStatus {
  ACTIVE = 'ACTIVE',         // Đang làm
  LEFT = 'LEFT'              // Nghỉ việc
}

export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  [ContractType.TRIAL]: 'Thử việc',
  [ContractType.OFFICIAL]: 'Chính thức',
  [ContractType.TEMPORARY]: 'Thời vụ'
};

export const EMPLOYEE_STATUS_LABELS: Record<EmployeeStatus, string> = {
  [EmployeeStatus.ACTIVE]: 'Đang làm',
  [EmployeeStatus.LEFT]: 'Nghỉ việc'
};

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department: string;
  avatarUrl?: string;
  // Bổ sung thông tin nhân sự (admin tạo user)
  employeeCode?: string;           // Mã nhân viên
  jobTitle?: string;               // Chức danh
  contractType?: ContractType;     // Loại hợp đồng
  startDate?: number;              // Ngày vào làm (timestamp)
  status?: EmployeeStatus;         // Trạng thái
  grossSalary?: number;            // Lương thỏa thuận (gross)
  socialInsuranceSalary?: number;  // Lương BHXH
  traineeSalary?: number;         // Lương học việc (nếu có)
}

export enum AttendanceType {
  CHECK_IN = 'CHECK_IN',
  CHECK_OUT = 'CHECK_OUT'
}

export enum AttendanceStatus {
  ON_TIME = 'ON_TIME',
  LATE = 'LATE',
  EARLY_LEAVE = 'EARLY_LEAVE',
  OVERTIME = 'OVERTIME',
  PENDING = 'PENDING' // For offline sync
}

export interface AttendanceRecord {
  id: string;
  userId: string;
  timestamp: number;
  type: AttendanceType;
  location: {
    lat: number;
    lng: number;
    address?: string;
  };
  status: AttendanceStatus;
  synced: boolean;
  notes?: string;
  photoUrl?: string;
}

export enum LeaveType {
  SICK = 'SICK',
  VACATION = 'VACATION',
  PERSONAL = 'PERSONAL',
  OTHER = 'OTHER'
}

export enum RequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED'
}

export interface LeaveRequest {
  id: string;
  userId: string;
  startDate: number;
  endDate: number;
  type: LeaveType;
  reason: string;
  status: RequestStatus;
  createdAt: number;
}

/** Chỉ hỗ trợ ca CUSTOM (9 tiếng) và OFF. Ca cố định đã bỏ. */
export enum ShiftTime {
  CUSTOM = 'CUSTOM',  // Ca làm: giờ vào tùy chọn, bắt buộc 9 tiếng
  OFF = 'OFF'        // Ngày nghỉ / lịch off
}

// Các loại nghỉ và trạng thái
export enum OffType {
  OFF_DK = 'OFF_DK',    // Định kỳ - Không lương
  OFF_PN = 'OFF_PN',    // Phép năm - Có lương
  OFF_KL = 'OFF_KL',    // Không lương
  CT = 'CT',            // Công tác - Có lương
  LE = 'LE'             // Nghỉ lễ - Có lương
}

// Nhãn hiển thị cho các loại off
export const OFF_TYPE_LABELS: Record<OffType, string> = {
  [OffType.OFF_DK]: 'OFF DK - Định kỳ (Không lương)',
  [OffType.OFF_PN]: 'OFF PN - Phép năm (Có lương)',
  [OffType.OFF_KL]: 'OFF KL - Không lương',
  [OffType.CT]: 'CT - Công tác (Có lương)',
  [OffType.LE]: 'LỄ - Nghỉ lễ (Có lương)'
}

export interface ShiftRegistration {
  id: string;
  userId: string;
  date: number; // Timestamp of the shift date (start of day)
  shift: ShiftTime;
  startTime?: string; // Format "HH:mm" - chỉ dùng khi shift === CUSTOM
  endTime?: string;   // Format "HH:mm" - chỉ dùng khi shift === CUSTOM
  offType?: OffType;  // Loại off - chỉ dùng khi shift === OFF
  status: RequestStatus;
  rejectionReason?: string; // Lý do từ chối (khi status === REJECTED)
  createdAt: number;
}

export interface PayrollRecord {
  id: string;
  userId: string;
  month: string; // Format "MM-YYYY"
  baseSalary: number;
  standardWorkDays: number;
  actualWorkDays: number;
  otHours: number;
  otPay: number;
  allowance: number; // Phụ cấp
  bonus: number;
  deductions: number; // BHXH, Tax, Fine
  netSalary: number; // Thực nhận
  status: 'PAID' | 'PENDING';
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  read: boolean;
  timestamp: number;
  type: 'info' | 'warning' | 'success' | 'error';
}

// Office Location: 99B Nguyễn Trãi, Ninh Kiều, Cần Thơ
// Coordinates: 10.040675858019696, 105.78463187148355
export const OFFICE_LOCATION = {
  lat: 10.040675858019696,
  lng: 105.78463187148355,
  radiusMeters: 200
};

/** Phòng ban */
export interface Department {
  id: string;
  name: string;
  code?: string;
  description?: string;
  managerId?: string;
  createdAt: number;
  isActive: boolean;
}

/** Ngày lễ */
export interface Holiday {
  id: string;
  name: string;
  date: number; // Timestamp
  type: 'NATIONAL' | 'COMPANY' | 'REGIONAL';
  isRecurring: boolean; // Có lặp lại hàng năm không
  description?: string;
  createdAt: number;
}

/** Cấu hình hệ thống */
export interface SystemConfig {
  id: string;
  key: string;
  value: string;
  description?: string;
  category: 'ATTENDANCE' | 'PAYROLL' | 'GENERAL' | 'NOTIFICATION';
  updatedAt: number;
  updatedBy?: string;
}