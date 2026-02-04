import { supabase } from './supabase';
import { User } from '../types';
import { getCurrentUser, createOTPCode, verifyOTPCode } from './db';
import { sendOTPEmail } from './email';

/**
 * Gửi OTP đến email
 * 
 * LUỒNG HOẠT ĐỘNG:
 * 1. Admin tạo user nhân viên trong bảng users (qua UsersManagement)
 * 2. Nhân viên nhập email đã được tạo để đăng nhập
 * 3. Hệ thống kiểm tra email có tồn tại trong bảng users không
 * 4. Nếu có, tự tạo mã OTP 6 chữ số và lưu vào database (bảng otp_codes)
 * 5. Gửi email chứa mã OTP qua Resend API
 * 6. Nhân viên nhập mã OTP đúng để đăng nhập
 * 
 * CHỈ cho phép đăng nhập, KHÔNG cho phép đăng ký tự động
 * KHÔNG sử dụng Supabase Auth OTP, tự quản lý OTP
 */
export const sendOTP = async (email: string): Promise<{ success: boolean; error?: string; rateLimited?: boolean }> => {
  try {
    const normalizedEmail = email.trim().toLowerCase();
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return { success: false, error: 'Email không hợp lệ' };
    }

    // BƯỚC 1: Kiểm tra email có tồn tại trong bảng users không
    // Chỉ cho phép đăng nhập nếu admin đã tạo user trước đó
    const user = await getCurrentUser(normalizedEmail);
    if (!user) {
      return { 
        success: false, 
        error: 'Email này chưa được đăng ký trong hệ thống. Vui lòng liên hệ quản trị viên.' 
      };
    }

    // BƯỚC 2: Tạo mã OTP và lưu vào database
    const otpResult = await createOTPCode(normalizedEmail, 5); // OTP có hiệu lực 5 phút
    if (!otpResult) {
      return { 
        success: false, 
        error: 'Không thể tạo mã OTP. Vui lòng thử lại.' 
      };
    }

    // BƯỚC 3: Gửi email chứa mã OTP qua Resend API (async - không đợi)
    // Trả về success ngay để user không phải đợi lâu
    // Email sẽ được gửi ở background
    sendOTPEmail(normalizedEmail, otpResult.code, user.name)
      .then((emailResult) => {
        if (!emailResult.success) {
          console.error('Failed to send OTP email:', emailResult.error);
          // Có thể log vào database hoặc gửi notification cho admin
        }
      })
      .catch((error) => {
        console.error('Error sending OTP email:', error);
      });

    // Trả về success ngay sau khi tạo OTP thành công
    // User sẽ nhận được email trong vài giây
    return { success: true };
  } catch (error: any) {
    console.error('Error sending OTP:', error);
    const errorMessage = error?.message || error?.toString() || 'Không thể gửi OTP';
    
    // Xử lý lỗi rate limit từ Resend API
    if (errorMessage.includes('rate limit') || 
        errorMessage.includes('too many') || 
        errorMessage.includes('429') ||
        errorMessage.includes('rate limit exceeded')) {
      return { 
        success: false, 
        error: 'Bạn đã gửi quá nhiều yêu cầu OTP. Vui lòng đợi vài phút rồi thử lại.',
        rateLimited: true
      };
    }
    
    return { success: false, error: errorMessage };
  }
};

/**
 * Xác thực OTP và đăng nhập
 * 
 * LUỒNG HOẠT ĐỘNG:
 * 1. Nhân viên nhập mã OTP đã nhận được từ email
 * 2. Hệ thống kiểm tra email có tồn tại trong bảng users không
 * 3. Xác thực OTP từ database (bảng otp_codes)
 * 4. Nếu OTP đúng và chưa hết hạn, đánh dấu đã sử dụng
 * 5. Lấy thông tin user từ bảng users và đăng nhập thành công
 * 
 * CHỈ cho phép đăng nhập khi OTP khớp và email tồn tại trong hệ thống
 * KHÔNG sử dụng Supabase Auth OTP, tự quản lý OTP
 */
export const verifyOTP = async (
  email: string,
  token: string
): Promise<{ success: boolean; user?: User; error?: string }> => {
  try {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedToken = token.trim();

    // Validate OTP format (phải là 6 chữ số)
    if (!/^\d{6}$/.test(normalizedToken)) {
      return { success: false, error: 'Mã OTP phải là 6 chữ số' };
    }

    // BƯỚC 1: Kiểm tra email có tồn tại trong bảng users không
    const user = await getCurrentUser(normalizedEmail);
    if (!user) {
      return { 
        success: false, 
        error: 'Email này chưa được đăng ký trong hệ thống. Vui lòng liên hệ quản trị viên.' 
      };
    }

    // BƯỚC 2: Xác thực OTP từ database
    const isValidOTP = await verifyOTPCode(normalizedEmail, normalizedToken);
    
    if (!isValidOTP) {
      return { 
        success: false, 
        error: 'Mã OTP không đúng hoặc đã hết hạn. Vui lòng yêu cầu mã mới.' 
      };
    }

    // BƯỚC 3: Đăng nhập thành công - OTP đã được xác thực và user tồn tại
    // OTP đã được đánh dấu là đã sử dụng trong hàm verifyOTPCode
    return { success: true, user };
  } catch (error: any) {
    console.error('Error verifying OTP:', error);
    return { success: false, error: error.message || 'Không thể xác thực OTP' };
  }
};

/**
 * Đăng xuất
 */
export const signOut = async (): Promise<void> => {
  try {
    await supabase.auth.signOut();
  } catch (error) {
    console.error('Error signing out:', error);
  }
};
