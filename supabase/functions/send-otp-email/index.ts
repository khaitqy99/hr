// Supabase Edge Function để gửi email OTP qua Resend API
// Chạy trên server-side nên không có vấn đề CORS và API key được bảo mật

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';
const RESEND_API_URL = 'https://api.resend.com/emails';

interface EmailRequest {
  email: string;
  otpCode: string;
  userName?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Kiểm tra authorization header (cần có để tránh spam)
    // Nhưng không verify JWT chi tiết vì đây là public endpoint cho OTP
    const authHeader = req.headers.get('Authorization');
    const apiKey = req.headers.get('apikey');
    
    // Chấp nhận nếu có authorization header hoặc apikey (từ Supabase client)
    // Điều này giúp tránh spam nhưng vẫn cho phép gọi từ client-side
    if (!authHeader && !apiKey) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Parse request body
    const { email, otpCode, userName }: EmailRequest = await req.json();

    // Validate input
    if (!email || !otpCode) {
      return new Response(
        JSON.stringify({ error: 'Email và mã OTP là bắt buộc' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!RESEND_API_KEY) {
      console.error('RESEND_API_KEY is not configured');
      return new Response(
        JSON.stringify({ error: 'Email service chưa được cấu hình' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: 'Email không hợp lệ' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate OTP format (6 digits)
    if (!/^\d{6}$/.test(otpCode)) {
      return new Response(
        JSON.stringify({ error: 'Mã OTP phải là 6 chữ số' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Create simple text email
    const emailText = `${userName ? `Xin chào ${userName},\n\n` : 'Xin chào,\n\n'}Bạn đã yêu cầu mã OTP để đăng nhập vào hệ thống Y99 HR.\n\nMã OTP của bạn: ${otpCode}\n\nLưu ý:\n- Mã OTP có hiệu lực trong 5 phút\n- Mỗi mã OTP chỉ sử dụng được một lần\n- Không chia sẻ mã OTP với bất kỳ ai\n\nNếu bạn không yêu cầu mã OTP này, vui lòng bỏ qua email này.\nEmail này được gửi tự động từ hệ thống Y99 HR.`;

    // Send email via Resend API
    const emailPayload = {
      from: 'Y99 HR <noreply@hr.y99.info>',
      to: [email],
      subject: 'Mã OTP đăng nhập - Y99 HR',
      text: emailText,
    };

    const response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify(emailPayload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Resend API error:', errorData);
      return new Response(
        JSON.stringify({
          error: errorData.message || `Không thể gửi email. Status: ${response.status}`,
        }),
        {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const data = await response.json();
    console.log('Email sent successfully:', data.id);

    return new Response(
      JSON.stringify({ success: true, messageId: data.id }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in send-otp-email function:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Lỗi không xác định khi gửi email',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
