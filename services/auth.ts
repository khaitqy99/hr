import { supabase } from './supabase';
import { User } from '../types';
import { getCurrentUser } from './db';

/**
 * Kiểm tra email có tồn tại trong hệ thống không
 */
const checkEmailExists = async (email: string): Promise<boolean> => {
  try {
    const user = await getCurrentUser(email.trim().toLowerCase());
    return !!user;
  } catch (error) {
    console.error('Error checking email:', error);
    return false;
  }
};

/**
 * Gửi OTP đến email
 * Chỉ gửi OTP nếu email tồn tại trong hệ thống
 */
export const sendOTP = async (email: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const normalizedEmail = email.trim().toLowerCase();
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return { success: false, error: 'Email không hợp lệ' };
    }

    // Kiểm tra email có tồn tại trong hệ thống không
    const emailExists = await checkEmailExists(normalizedEmail);
    if (!emailExists) {
      return { 
        success: false, 
        error: 'Email này chưa được đăng ký trong hệ thống. Vui lòng liên hệ quản trị viên.' 
      };
    }

    // Kiểm tra email có tồn tại trong bảng users không
    const user = await getCurrentUser(normalizedEmail);
    if (!user) {
      return { 
        success: false, 
        error: 'Email này chưa được đăng ký trong hệ thống. Vui lòng liên hệ quản trị viên.' 
      };
    }

    // Gửi OTP qua Supabase Auth
    // Cho phép Supabase tạo user trong auth.users nếu chưa có
    // Sau đó trigger sẽ tự động liên kết với user trong bảng users
    const { error } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        // Email template sẽ được gửi với OTP
        emailRedirectTo: undefined,
        // Cho phép tạo user trong auth.users nếu chưa có
        // Trigger sẽ tự động liên kết với user trong bảng users
        shouldCreateUser: true,
        // Metadata để trigger có thể tạo user đúng trong bảng users
        data: {
          name: user.name,
          role: user.role,
          department: user.department,
        },
      },
    });

    if (error) {
      console.error('Error sending OTP:', error);
      // Xử lý các lỗi cụ thể
      if (error.message.includes('rate limit') || error.message.includes('too many')) {
        return { success: false, error: 'Đã gửi quá nhiều yêu cầu. Vui lòng đợi vài phút rồi thử lại.' };
      }
      return { success: false, error: error.message || 'Không thể gửi OTP. Vui lòng thử lại.' };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error sending OTP:', error);
    return { success: false, error: error.message || 'Không thể gửi OTP' };
  }
};

/**
 * Xác thực OTP và đăng nhập
 * CHỈ đăng nhập khi OTP khớp và email tồn tại trong hệ thống
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

    // Kiểm tra email có tồn tại trong hệ thống không (double check)
    const emailExists = await checkEmailExists(normalizedEmail);
    if (!emailExists) {
      return { 
        success: false, 
        error: 'Email này chưa được đăng ký trong hệ thống. Vui lòng liên hệ quản trị viên.' 
      };
    }

    // Xác thực OTP với Supabase Auth
    // Supabase sẽ kiểm tra OTP có khớp với email đã gửi không
    const { data, error } = await supabase.auth.verifyOtp({
      email: normalizedEmail,
      token: normalizedToken,
      type: 'email',
    });

    if (error) {
      console.error('Error verifying OTP:', error);
      
      // Xử lý các lỗi cụ thể
      if (error.message.includes('expired') || error.message.includes('invalid')) {
        return { success: false, error: 'Mã OTP không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu mã mới.' };
      }
      if (error.message.includes('token')) {
        return { success: false, error: 'Mã OTP không đúng. Vui lòng kiểm tra lại.' };
      }
      
      return { success: false, error: error.message || 'Không thể xác thực OTP' };
    }

    // Kiểm tra Supabase đã xác thực OTP thành công
    if (!data.user) {
      return { success: false, error: 'Không thể xác thực người dùng. OTP có thể không hợp lệ.' };
    }

    // Kiểm tra session đã được tạo chưa
    if (!data.session) {
      return { success: false, error: 'Không thể tạo session. Vui lòng thử lại.' };
    }

    // Lấy thông tin user từ bảng users (đảm bảo user tồn tại)
    const user = await getCurrentUser(normalizedEmail);
    
    if (!user) {
      // Nếu user không tồn tại trong bảng users, đăng xuất khỏi Supabase Auth
      await supabase.auth.signOut();
      return { 
        success: false, 
        error: 'Người dùng không tồn tại trong hệ thống. Vui lòng liên hệ quản trị viên.' 
      };
    }

    // Đăng nhập thành công - OTP đã được xác thực và user tồn tại
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

/**
 * Lấy session hiện tại
 */
export const getSession = async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  } catch (error) {
    console.error('Error getting session:', error);
    return null;
  }
};

/**
 * Lắng nghe thay đổi auth state
 */
export const onAuthStateChange = (callback: (session: any) => void) => {
  return supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
};
