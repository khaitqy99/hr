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

    // Create email HTML template (tối ưu - inline styles để giảm kích thước)
    const emailHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mã OTP đăng nhập</title></head><body style="font-family:Arial,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px"><div style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:30px;text-align:center;border-radius:10px 10px 0 0"><h1 style="color:#fff;margin:0">HR Connect</h1><p style="color:rgba(255,255,255,0.9);margin:5px 0 0">Hệ thống quản lý nhân sự 4.0</p></div><div style="background:#f9f9f9;padding:30px;border-radius:0 0 10px 10px"><h2 style="color:#333;margin-top:0">Mã OTP đăng nhập</h2>${userName ? `<p>Xin chào <strong>${userName}</strong>,</p>` : '<p>Xin chào,</p>'}<p>Bạn đã yêu cầu mã OTP để đăng nhập vào hệ thống HR Connect.</p><div style="background:#fff;border:2px dashed #667eea;border-radius:10px;padding:20px;text-align:center;margin:30px 0"><p style="margin:0 0 10px;color:#666;font-size:14px">Mã OTP của bạn:</p><div style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#667eea;font-family:'Courier New',monospace">${otpCode}</div></div><p style="color:#666;font-size:14px"><strong>Lưu ý:</strong></p><ul style="color:#666;font-size:14px;padding-left:20px"><li>Mã OTP có hiệu lực trong <strong>5 phút</strong></li><li>Mỗi mã OTP chỉ sử dụng được một lần</li><li>Không chia sẻ mã OTP với bất kỳ ai</li></ul><p style="color:#999;font-size:12px;margin-top:30px;border-top:1px solid #eee;padding-top:20px">Nếu bạn không yêu cầu mã OTP này, vui lòng bỏ qua email này.<br>Email này được gửi tự động từ hệ thống HR Connect.</p></div></body></html>`;

    // Send email via Resend API (tối ưu - không đợi response body nếu không cần)
    const emailPayload = {
      from: 'HR Connect <noreply@hr.y99.info>',
      to: [email],
      subject: 'Mã OTP đăng nhập - HR Connect',
      html: emailHtml,
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
