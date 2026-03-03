import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const APP_URL = Deno.env.get('APP_URL') || 'http://localhost:3000'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ShiftChangeNotification {
  employeeName: string
  employeeEmail: string
  date: string
  oldShift: string
  newShift: string
  reason: string
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { employeeName, employeeEmail, date, oldShift, newShift, reason }: ShiftChangeNotification = await req.json()

    if (!RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not configured')
    }

    // Khởi tạo Supabase client với service role key để lấy danh sách admin
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Lấy danh sách admin
    const { data: admins, error: adminError } = await supabase
      .from('users')
      .select('email, name')
      .eq('role', 'ADMIN')

    if (adminError) {
      console.error('Error fetching admins:', adminError)
      throw new Error('Failed to fetch admin list')
    }

    if (!admins || admins.length === 0) {
      console.log('No admins found to notify')
      return new Response(
        JSON.stringify({ success: true, message: 'No admins to notify' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Link đến trang duyệt ca
    const approvalLink = `${APP_URL}/#/admin/shift`

    // Gửi email đến từng admin (tuần tự để tránh rate limit)
    const results = [];
    for (const admin of admins) {
      try {
        const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #2563eb 0%, #06b6d4 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
            .header h1 { margin: 0 0 5px 0; font-size: 24px; }
            .header p { margin: 0; font-size: 14px; opacity: 0.9; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
            .greeting { margin-bottom: 20px; }
            .info-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b; }
            .info-row { margin: 10px 0; display: flex; }
            .label { font-weight: bold; color: #64748b; min-width: 120px; }
            .value { color: #1e293b; flex: 1; }
            .reason-box { background: #fef3c7; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #f59e0b; }
            .reason-title { font-weight: bold; margin-bottom: 8px; color: #92400e; }
            .button { display: inline-block; background: #2563eb; color: white !important; padding: 12px 30px; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: bold; }
            .note { background: #e0f2fe; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0284c7; }
            .footer { text-align: center; color: #64748b; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; }
            .divider { height: 1px; background: #e2e8f0; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>⚠️ Yêu cầu đổi ca đã duyệt</h1>
              <p>Approved Shift Change Request</p>
            </div>
            <div class="content">
              <div class="greeting">
                <p><strong>Xin chào / Hello ${admin.name},</strong></p>
                <p style="margin-top: 10px;">
                  Nhân viên <strong>${employeeName}</strong> đã yêu cầu đổi lịch ca đã được duyệt. Vui lòng xem xét và phê duyệt.<br>
                  <span style="color: #64748b; font-size: 14px;">
                    Employee <strong>${employeeName}</strong> has requested to change an approved shift. Please review and approve.
                  </span>
                </p>
              </div>
              
              <div class="info-box">
                <div class="info-row">
                  <span class="label">Nhân viên / Employee:</span>
                  <span class="value">${employeeName} (${employeeEmail})</span>
                </div>
                <div class="info-row">
                  <span class="label">Ngày / Date:</span>
                  <span class="value">${date}</span>
                </div>
                <div class="info-row">
                  <span class="label">Ca cũ / Old Shift:</span>
                  <span class="value">${oldShift}</span>
                </div>
                <div class="info-row">
                  <span class="label">Ca mới / New Shift:</span>
                  <span class="value">${newShift}</span>
                </div>
              </div>

              <div class="reason-box">
                <div class="reason-title">Lý do đổi ca / Reason for Change:</div>
                <p style="margin: 0; color: #78350f;">${reason}</p>
              </div>

              <div style="text-align: center;">
                <a href="${approvalLink}" class="button" style="color: white !important;">
                  Xem và duyệt ca / View & Approve →
                </a>
              </div>

              <div class="note">
                <p style="margin: 0; font-size: 14px;">
                  <strong>💡 Lưu ý / Note:</strong><br>
                  Ca này đã được duyệt trước đó. Sau khi nhân viên đổi lịch, ca sẽ chuyển về trạng thái "Chờ duyệt" và cần được phê duyệt lại.<br>
                  <span style="color: #64748b; font-size: 13px;">
                    This shift was previously approved. After the employee changed the schedule, the shift status will be reset to "Pending" and requires re-approval.
                  </span>
                </p>
              </div>
            </div>
            <div class="footer">
              <p>Email này được gửi tự động từ hệ thống Y99 HR</p>
              <p style="color: #94a3b8;">This email was sent automatically from Y99 HR system</p>
              <p style="margin-top: 10px;">Vui lòng không trả lời email này / Please do not reply to this email</p>
            </div>
          </div>
        </body>
        </html>
      `

        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: 'Y99 HR <noreply@hr.y99.info>',
            to: [admin.email],
            subject: `⚠️ Yêu cầu đổi ca đã duyệt - ${employeeName}`,
            html: emailHtml,
          }),
        })

        if (!res.ok) {
          const error = await res.text()
          console.error(`Failed to send email to ${admin.email}:`, error)
          results.push({ admin: admin.email, success: false, error })
        } else {
          const data = await res.json()
          console.log(`Email sent successfully to ${admin.email}:`, data.id)
          results.push({ admin: admin.email, success: true, messageId: data.id })
        }

        // Delay 600ms giữa các email để tránh rate limit (2 requests/second)
        if (admins.indexOf(admin) < admins.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 600))
        }
      } catch (error) {
        console.error(`Error sending email to ${admin.email}:`, error)
        results.push({ admin: admin.email, success: false, error: error.message })
      }
    }

    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length

    return new Response(
      JSON.stringify({ 
        success: successCount > 0, 
        message: `Sent to ${successCount}/${admins.length} admin(s)`,
        details: results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
