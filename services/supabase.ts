import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';

// Lấy credentials từ environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase credentials chưa được cấu hình. Vui lòng thêm VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY vào file .env.local');
}

// Tạo Supabase client
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

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
