/**
 * Service để upload và quản lý hình ảnh trên Supabase Storage
 */

import { supabase, isSupabaseConfigured } from './supabase';

const ATTENDANCE_PHOTOS_BUCKET = 'chamcong';

/**
 * Convert base64 data URL thành Blob (fallback khi cần)
 */
const dataURLtoBlob = (dataurl: string): Blob => {
  const arr = dataurl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bstr = atob(arr[1]);
  const u8arr = new Uint8Array(bstr.length);
  for (let i = 0; i < bstr.length; i++) u8arr[i] = bstr.charCodeAt(i);
  return new Blob([u8arr], { type: mime });
};

/**
 * Upload ảnh chấm công lên Supabase Storage (binary trực tiếp, không JSON)
 * @param photo Blob ảnh từ canvas hoặc base64 data URL (fallback)
 * @param userId ID của user
 * @param timestamp Timestamp của lần chấm công
 * @param type Loại chấm công (CHECK_IN hoặc CHECK_OUT)
 * @returns Public URL của ảnh đã upload
 */
export const uploadAttendancePhoto = async (
  photo: Blob | string,
  userId: string,
  timestamp: number,
  type: 'CHECK_IN' | 'CHECK_OUT'
): Promise<string> => {
  const blobToDataUrl = (b: Blob): Promise<string> =>
    new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.readAsDataURL(b);
    });

  if (!isSupabaseConfigured()) {
    console.warn('⚠️ Supabase chưa được cấu hình, sử dụng base64 fallback');
    return typeof photo === 'string' ? photo : blobToDataUrl(photo);
  }

  try {
    const date = new Date(timestamp);
    const dateStr = date.toISOString().split('T')[0];
    const timeStr = date.toTimeString().split(' ')[0].replace(/:/g, '-');
    const filename = `${userId}/${dateStr}_${timeStr}_${type}.jpg`;

    const blob: Blob = typeof photo === 'string' ? dataURLtoBlob(photo) : photo;
    const file = new File([blob], filename.split('/').pop() || 'photo.jpg', { type: 'image/jpeg' });

    // Upload ảnh chuẩn multipart (File có name + type đúng)
    console.log(`📤 Uploading photo: ${filename}`);
    const { data, error } = await supabase.storage
      .from(ATTENDANCE_PHOTOS_BUCKET)
      .upload(filename, file, {
        cacheControl: '3600',
        contentType: 'image/jpeg',
        upsert: false,
      });

    if (error) {
      console.error('❌ Error uploading photo:', error);
      console.error('   Error details:', {
        message: error.message,
        statusCode: error.statusCode,
        error: error.error,
      });
      console.warn('⚠️ Falling back to base64 data URL');
      return typeof photo === 'string' ? photo : blobToDataUrl(photo);
    }

    console.log('✅ Photo uploaded successfully:', data?.path);

    // Lấy public URL
    const { data: urlData } = supabase.storage
      .from(ATTENDANCE_PHOTOS_BUCKET)
      .getPublicUrl(filename);

    if (!urlData?.publicUrl) {
      console.error('❌ Error getting public URL');
      return typeof photo === 'string' ? photo : blobToDataUrl(photo);
    }

    console.log('✅ Public URL generated:', urlData.publicUrl);
    return urlData.publicUrl;
  } catch (error) {
    console.error('Error in uploadAttendancePhoto:', error);
    return typeof photo === 'string' ? photo : blobToDataUrl(photo);
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
