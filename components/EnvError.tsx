import React from 'react';

const EnvError: React.FC = () => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '20px',
      backgroundColor: '#fef2f2',
      color: '#991b1b'
    }}>
      <div style={{
        maxWidth: '600px',
        backgroundColor: 'white',
        padding: '32px',
        borderRadius: '12px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
      }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '16px' }}>
          ⚠️ Lỗi cấu hình Environment Variables
        </h1>
        
        <p style={{ marginBottom: '24px', lineHeight: '1.6' }}>
          Ứng dụng không thể khởi động vì thiếu cấu hình Supabase.
        </p>

        <div style={{
          backgroundColor: '#fef2f2',
          padding: '16px',
          borderRadius: '8px',
          marginBottom: '24px',
          fontFamily: 'monospace',
          fontSize: '14px'
        }}>
          <div style={{ marginBottom: '8px' }}>
            <strong>VITE_SUPABASE_URL:</strong>{' '}
            <span style={{ color: supabaseUrl ? '#059669' : '#dc2626' }}>
              {supabaseUrl ? '✅ Đã cấu hình' : '❌ Chưa cấu hình'}
            </span>
          </div>
          <div>
            <strong>VITE_SUPABASE_ANON_KEY:</strong>{' '}
            <span style={{ color: supabaseKey ? '#059669' : '#dc2626' }}>
              {supabaseKey ? '✅ Đã cấu hình' : '❌ Chưa cấu hình'}
            </span>
          </div>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '12px' }}>
            Cách khắc phục:
          </h2>
          <ol style={{ paddingLeft: '20px', lineHeight: '1.8' }}>
            <li>Vào <strong>Vercel Dashboard</strong></li>
            <li>Chọn project của bạn</li>
            <li>Vào <strong>Settings</strong> → <strong>Environment Variables</strong></li>
            <li>Thêm các biến sau:
              <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
                <li><code>VITE_SUPABASE_URL</code> = URL từ Supabase Dashboard</li>
                <li><code>VITE_SUPABASE_ANON_KEY</code> = Anon Key từ Supabase Dashboard</li>
              </ul>
            </li>
            <li>Chọn <strong>Production, Preview, và Development</strong></li>
            <li>Click <strong>Save</strong></li>
            <li><strong>Redeploy</strong> project</li>
          </ol>
        </div>

        <div style={{
          backgroundColor: '#eff6ff',
          padding: '12px',
          borderRadius: '6px',
          fontSize: '14px',
          color: '#1e40af'
        }}>
          <strong>💡 Lưu ý:</strong> Sau khi thêm Environment Variables, bạn cần redeploy để áp dụng thay đổi.
        </div>
      </div>
    </div>
  );
};

export default EnvError;
