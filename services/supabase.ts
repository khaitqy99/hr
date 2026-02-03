import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';

// Lấy credentials từ environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Validate environment variables và log warning
if (!supabaseUrl || !supabaseAnonKey) {
  console.error(`
⚠️ LỖI CẤU HÌNH SUPABASE

Environment Variables chưa được cấu hình!

Vui lòng thêm các biến sau vào Vercel Dashboard:
- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY

Hiện tại:
- VITE_SUPABASE_URL: ${supabaseUrl ? '✅ Set' : '❌ Missing'}
- VITE_SUPABASE_ANON_KEY: ${supabaseAnonKey ? '✅ Set' : '❌ Missing'}
  `);
}

// Helper để check nếu Supabase đã được cấu hình
export const isSupabaseConfigured = (): boolean => {
  return !!(supabaseUrl && supabaseAnonKey);
};

// Tạo Supabase client
// Sử dụng fallback values để tránh crash khi import
// App component sẽ check và hiển thị error UI nếu env vars missing
export const supabase = createClient<Database>(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    },
    db: {
      schema: 'public'
    },
    global: {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    }
  }
);

// Helper function để kiểm tra kết nối
export const checkSupabaseConnection = async (): Promise<boolean> => {
  try {
    const { data, error } = await supabase.from('users').select('count').limit(1);
    if (error && error.code !== 'PGRST116') { // PGRST116 = table doesn't exist (expected if not migrated yet)
      console.error('❌ Lỗi kết nối Supabase:', error);
      return false;
    }
    console.log('✅ Kết nối Supabase thành công!');
    return true;
  } catch (err) {
    console.error('❌ Lỗi kết nối Supabase:', err);
    return false;
  }
};
