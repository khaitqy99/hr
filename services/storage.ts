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
 * Detect MIME type từ blob bằng cách đọc magic bytes
 * @param blob Blob cần detect
 * @returns MIME type (image/jpeg, image/png, image/webp, etc.)
 */
const detectImageMimeType = async (blob: Blob): Promise<string> => {
  // Nếu blob đã có type hợp lệ, dùng nó
  if (blob.type && blob.type.startsWith('image/')) {
    return blob.type;
  }

  // Đọc magic bytes để detect format
  const arrayBuffer = await blob.slice(0, 12).arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (uint8Array[0] === 0x89 && uint8Array[1] === 0x50 && uint8Array[2] === 0x4E && uint8Array[3] === 0x47) {
    return 'image/png';
  }

  // JPEG: FF D8 FF
  if (uint8Array[0] === 0xFF && uint8Array[1] === 0xD8 && uint8Array[2] === 0xFF) {
    return 'image/jpeg';
  }

  // WebP: RIFF...WEBP
  if (
    uint8Array[0] === 0x52 && uint8Array[1] === 0x49 && uint8Array[2] === 0x46 && uint8Array[3] === 0x46 &&
    uint8Array[8] === 0x57 && uint8Array[9] === 0x45 && uint8Array[10] === 0x42 && uint8Array[11] === 0x50
  ) {
    return 'image/webp';
  }

  // GIF: GIF87a hoặc GIF89a
  if (
    (uint8Array[0] === 0x47 && uint8Array[1] === 0x49 && uint8Array[2] === 0x46 && uint8Array[3] === 0x38) &&
    (uint8Array[5] === 0x61 || uint8Array[5] === 0x61)
  ) {
    return 'image/gif';
  }

  // Default to JPEG nếu không detect được
  return 'image/jpeg';
};

/**
 * Lấy extension từ MIME type
 */
const getExtensionFromMimeType = (mimeType: string): string => {
  const mimeToExt: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
  };
  return mimeToExt[mimeType] || 'jpg';
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
    return typeof photo === 'string' ? photo : await blobToDataUrl(photo);
  }

  try {
    const date = new Date(timestamp);
    const dateStr = date.toISOString().split('T')[0];
    const timeStr = date.toTimeString().split(' ')[0].replace(/:/g, '-');
    
    const blob: Blob = typeof photo === 'string' ? dataURLtoBlob(photo) : photo;
    
    // Detect MIME type thực tế từ blob
    const mimeType = await detectImageMimeType(blob);
    const extension = getExtensionFromMimeType(mimeType);
    const filename = `${userId}/${dateStr}_${timeStr}_${type}.${extension}`;

    // Tạo File với MIME type đúng
    const file = new File([blob], filename.split('/').pop() || `photo.${extension}`, { type: mimeType });

    // Upload ảnh với content-type đúng
    const { data, error } = await supabase.storage
      .from(ATTENDANCE_PHOTOS_BUCKET)
      .upload(filename, file, {
        cacheControl: '3600',
        contentType: mimeType, // Dùng MIME type thực tế
        upsert: false,
      });

    if (error) {
      console.error('❌ Error uploading photo:', error);
      console.error('   Error details:', {
        message: error.message,
        statusCode: error.statusCode,
        error: error.error,
        filename,
      });
      console.warn('⚠️ Falling back to base64 data URL');
      return typeof photo === 'string' ? photo : await blobToDataUrl(photo);
    }

    // Verify file was actually uploaded by checking if it exists
    // (Sometimes upload returns success but file doesn't exist due to race conditions)
    const { data: verifyData, error: verifyError } = await supabase.storage
      .from(ATTENDANCE_PHOTOS_BUCKET)
      .list(filename.split('/')[0], {
        limit: 1000,
        search: filename.split('/').pop(),
      });

    if (verifyError || !verifyData?.some(file => file.name === filename.split('/').pop())) {
      console.warn('⚠️ Upload reported success but file not found, falling back to base64');
      console.warn('   Filename:', filename);
      console.warn('   Verify error:', verifyError);
      return typeof photo === 'string' ? photo : await blobToDataUrl(photo);
    }

    // Lấy public URL
    const { data: urlData } = supabase.storage
      .from(ATTENDANCE_PHOTOS_BUCKET)
      .getPublicUrl(filename);

    if (!urlData?.publicUrl) {
      console.error('❌ Error getting public URL');
      return typeof photo === 'string' ? photo : await blobToDataUrl(photo);
    }

    // Đảm bảo URL đầy đủ - đôi khi getPublicUrl() có thể trả về URL không đầy đủ
    const fullPublicUrl = urlData.publicUrl;
    
    // Verify URL có chứa đầy đủ filename
    if (!fullPublicUrl.includes(filename)) {
      console.error('❌ Public URL does not contain full filename:', {
        publicUrl: fullPublicUrl,
        filename,
        urlLength: fullPublicUrl.length,
        filenameLength: filename.length,
      });
      // Fallback: construct URL manually nếu cần
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (supabaseUrl) {
        const manualUrl = `${supabaseUrl}/storage/v1/object/public/${ATTENDANCE_PHOTOS_BUCKET}/${filename}`;
        console.warn('⚠️ Using manually constructed URL:', manualUrl);
        
        console.log('✅ Photo uploaded successfully:', {
          filename,
          publicUrl: manualUrl,
          userId,
          type,
          urlSource: 'manual',
        });
        
        return manualUrl;
      }
    }

    console.log('✅ Photo uploaded successfully:', {
      filename,
      publicUrl: fullPublicUrl,
      publicUrlLength: fullPublicUrl.length,
      filenameInUrl: fullPublicUrl.includes(filename),
      userId,
      type,
      urlSource: 'getPublicUrl',
    });

    return fullPublicUrl;
  } catch (error) {
    console.error('Error in uploadAttendancePhoto:', error);
    return typeof photo === 'string' ? photo : await blobToDataUrl(photo);
  }
};

/**
 * Extract filename từ public URL
 * @param photoUrl Public URL của ảnh
 * @returns filename path hoặc null nếu không extract được
 */
export const extractFilenameFromUrl = (photoUrl: string): string | null => {
  if (!photoUrl || photoUrl.startsWith('data:')) return null;
  
  try {
    const urlParts = photoUrl.split('/');
    const bucketIndex = urlParts.indexOf(ATTENDANCE_PHOTOS_BUCKET);
    if (bucketIndex === -1) {
      // Thử tìm bằng pattern khác: storage/v1/object/public/chamcong/...
      const publicIndex = urlParts.indexOf('public');
      if (publicIndex !== -1 && publicIndex + 1 < urlParts.length) {
        return urlParts.slice(publicIndex + 1).join('/');
      }
      return null;
    }
    
    return urlParts.slice(bucketIndex + 1).join('/');
  } catch (error) {
    console.warn('Error extracting filename from URL:', error);
    return null;
  }
};

/**
 * Kiểm tra xem file có tồn tại trên Storage không
 * @param photoUrl URL của ảnh cần kiểm tra
 * @returns true nếu file tồn tại, false nếu không
 */
export const checkPhotoExists = async (photoUrl: string): Promise<boolean> => {
  if (!isSupabaseConfigured() || !photoUrl) return false;
  
  // Nếu là base64 data URL, luôn tồn tại
  if (photoUrl.startsWith('data:')) return true;

  try {
    const filename = extractFilenameFromUrl(photoUrl);
    if (!filename) {
      console.warn('Could not extract filename from URL:', photoUrl);
      return false;
    }

    // Kiểm tra file có tồn tại không bằng cách list files trong folder
    const pathParts = filename.split('/');
    const folder = pathParts.slice(0, -1).join('/');
    const fileName = pathParts[pathParts.length - 1];
    
    const { data, error } = await supabase.storage
      .from(ATTENDANCE_PHOTOS_BUCKET)
      .list(folder || '', {
        limit: 1000,
        search: fileName,
      });

    if (error) {
      console.warn('Error checking photo existence:', error);
      return false;
    }

    const exists = data?.some(file => file.name === fileName) ?? false;
    if (!exists) {
      console.warn(`File not found: ${filename}`, {
        folder,
        fileName,
        listedFiles: data?.map(f => f.name),
      });
    }
    return exists;
  } catch (error) {
    console.warn('Error in checkPhotoExists:', error);
    return false;
  }
};

/**
 * Test URL bằng cách fetch trực tiếp và kiểm tra content-type
 * @param photoUrl URL cần test
 * @returns Promise với status code, content-type và error
 */
export const testPhotoUrl = async (photoUrl: string): Promise<{ 
  success: boolean; 
  status?: number; 
  contentType?: string;
  isImage?: boolean;
  error?: string 
}> => {
  if (!photoUrl || photoUrl.startsWith('data:')) {
    return { success: true, isImage: true }; // Base64 URLs are always valid
  }

  try {
    const response = await fetch(photoUrl, { method: 'HEAD', mode: 'cors' });
    const contentType = response.headers.get('content-type') || '';
    const isImage = contentType.startsWith('image/');
    
    return {
      success: response.ok,
      status: response.status,
      contentType,
      isImage,
      error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Network error',
    };
  }
};

/**
 * Kiểm tra xem ảnh có được serve đúng content-type không
 * Nếu content-type sai (ví dụ: multipart/form-data thay vì image/jpeg), 
 * file có thể bị corrupt hoặc upload sai cách
 * @param photoUrl URL của ảnh cần kiểm tra
 * @returns true nếu content-type đúng, false nếu sai
 */
export const verifyPhotoContentType = async (photoUrl: string): Promise<boolean> => {
  if (!photoUrl || photoUrl.startsWith('data:')) {
    return true; // Base64 URLs are always valid
  }

  try {
    const testResult = await testPhotoUrl(photoUrl);
    if (!testResult.success || !testResult.isImage) {
      console.warn('⚠️ Photo has invalid content-type:', {
        photoUrl,
        contentType: testResult.contentType,
        status: testResult.status,
      });
      return false;
    }
    return true;
  } catch (error) {
    console.warn('Error verifying photo content-type:', error);
    return false;
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
