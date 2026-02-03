/**
 * Email service sử dụng Supabase Edge Function để gửi email OTP qua Resend API
 * Edge Function chạy trên server-side nên không có vấn đề CORS và API key được bảo mật
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

/**
 * Gửi email OTP qua Supabase Edge Function
 * Sử dụng fetch trực tiếp với đầy đủ headers để tránh lỗi 403
 */
export const sendOTPEmail = async (
  email: string,
  otpCode: string,
  userName?: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return { success: false, error: 'Supabase chưa được cấu hình' };
    }

    // Gọi Supabase Edge Function trực tiếp với fetch
    // Cần đầy đủ headers: Authorization (Bearer token) và apikey
    const functionUrl = `${SUPABASE_URL}/functions/v1/send-otp-email`;
    
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        otpCode: otpCode,
        userName: userName,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: errorText || `HTTP ${response.status}` };
      }
      
      console.error('Edge Function error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData,
      });
      
      return {
        success: false,
        error: errorData.error || `Không thể gửi email OTP. Status: ${response.status}`,
      };
    }

    const data = await response.json();
    
    if (!data || !data.success) {
      return {
        success: false,
        error: data?.error || 'Không thể gửi email OTP',
      };
    }

    console.log('Email sent successfully via Edge Function');
    return { success: true };
  } catch (error: any) {
    console.error('Error calling Edge Function:', error);
    return {
      success: false,
      error: error.message || 'Không thể gửi email OTP',
    };
  }
};
