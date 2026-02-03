/**
 * Service để upload và quản lý hình ảnh trên Supabase Storage
 */

import { supabase, isSupabaseConfigured } from './supabase';

const ATTENDANCE_PHOTOS_BUCKET = 'chamcong';

/**
 * Convert base64 data URL thành File object
 */
const dataURLtoFile = (dataurl: string, filename: string): File => {
  const arr = dataurl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
};

/**
 * Upload ảnh chấm công lên Supabase Storage
 * @param photoDataUrl Base64 data URL của ảnh
 * @param userId ID của user
 * @param timestamp Timestamp của lần chấm công
 * @param type Loại chấm công (CHECK_IN hoặc CHECK_OUT)
 * @returns Public URL của ảnh đã upload
 */
export const uploadAttendancePhoto = async (
  photoDataUrl: string,
  userId: string,
  timestamp: number,
  type: 'CHECK_IN' | 'CHECK_OUT'
): Promise<string> => {
  if (!isSupabaseConfigured()) {
    // Fallback: return data URL nếu Supabase chưa được cấu hình
    console.warn('⚠️ Supabase chưa được cấu hình, sử dụng base64 fallback');
    return photoDataUrl;
  }

  try {
    // Tạo tên file: userId_timestamp_type.jpg
    const date = new Date(timestamp);
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
    const timeStr = date.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS
    const filename = `${userId}/${dateStr}_${timeStr}_${type}.jpg`;
    
    // Convert base64 thành File
    const file = dataURLtoFile(photoDataUrl, filename);

    // Upload lên Supabase Storage
    console.log(`📤 Uploading photo: ${filename}`);
    const { data, error } = await supabase.storage
      .from(ATTENDANCE_PHOTOS_BUCKET)
      .upload(filename, file, {
        cacheControl: '3600',
        upsert: false, // Không ghi đè file cũ
      });

    if (error) {
      console.error('❌ Error uploading photo:', error);
      console.error('   Error details:', {
        message: error.message,
        statusCode: error.statusCode,
        error: error.error,
      });
      // Fallback về base64 nếu upload thất bại
      console.warn('⚠️ Falling back to base64 data URL');
      return photoDataUrl;
    }

    console.log('✅ Photo uploaded successfully:', data?.path);

    // Lấy public URL
    const { data: urlData } = supabase.storage
      .from(ATTENDANCE_PHOTOS_BUCKET)
      .getPublicUrl(filename);

    if (!urlData?.publicUrl) {
      console.error('❌ Error getting public URL');
      return photoDataUrl;
    }

    console.log('✅ Public URL generated:', urlData.publicUrl);
    return urlData.publicUrl;
  } catch (error) {
    console.error('Error in uploadAttendancePhoto:', error);
    // Fallback về base64 nếu có lỗi
    return photoDataUrl;
  }
};

/**
 * Xóa ảnh chấm công khỏi Storage
 * @param photoUrl URL của ảnh cần xóa
 */
export const deleteAttendancePhoto = async (photoUrl: string): Promise<void> => {
  if (!isSupabaseConfigured() || !photoUrl) return;
  
  // Nếu là base64 data URL, không cần xóa
  if (photoUrl.startsWith('data:')) return;

  try {
    // Extract filename từ URL
    const urlParts = photoUrl.split('/');
    const filename = urlParts.slice(urlParts.indexOf(ATTENDANCE_PHOTOS_BUCKET) + 1).join('/');
    
    if (!filename) return;

    const { error } = await supabase.storage
      .from(ATTENDANCE_PHOTOS_BUCKET)
      .remove([filename]);

    if (error) {
      console.error('Error deleting photo:', error);
    }
  } catch (error) {
    console.error('Error in deleteAttendancePhoto:', error);
  }
};

/**
 * Kiểm tra và tạo bucket nếu chưa tồn tại (chạy một lần)
 * Lưu ý: Function này cần quyền admin, nên chỉ chạy từ server-side hoặc migration
 */
export const ensureBucketExists = async (): Promise<boolean> => {
  if (!isSupabaseConfigured()) return false;

  try {
    // Kiểm tra bucket có tồn tại không
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error('Error listing buckets:', listError);
      return false;
    }

    const bucketExists = buckets?.some(b => b.name === ATTENDANCE_PHOTOS_BUCKET);
    
    if (bucketExists) {
      return true;
    }

    // Tạo bucket mới
    const { error: createError } = await supabase.storage.createBucket(ATTENDANCE_PHOTOS_BUCKET, {
      public: true, // Cho phép public access
      fileSizeLimit: 5242880, // 5MB max
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    });

    if (createError) {
      console.error('Error creating bucket:', createError);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in ensureBucketExists:', error);
    return false;
  }
};
