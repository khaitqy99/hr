-- Migration: Tạo bucket và policies cho attendance photos
-- Bucket này lưu trữ hình ảnh chấm công của nhân viên

-- Lưu ý: Bucket 'chamcong' đã được tạo trong Supabase Dashboard
-- Migration này chỉ tạo policies cho bucket

-- Xóa policies cũ nếu đã tồn tại (để có thể chạy lại migration)
DROP POLICY IF EXISTS "Public can upload attendance photos" ON storage.objects;
DROP POLICY IF EXISTS "Public can read attendance photos" ON storage.objects;
DROP POLICY IF EXISTS "Public can delete attendance photos" ON storage.objects;

-- Policy: Cho phép public upload ảnh (vì app sử dụng anon key)
-- Lưu ý: Có thể thay đổi thành authenticated nếu muốn bảo mật hơn
CREATE POLICY "Public can upload attendance photos"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (bucket_id = 'chamcong');

-- Policy: Cho phép public đọc ảnh (để hiển thị trong UI)
CREATE POLICY "Public can read attendance photos"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'chamcong');

-- Policy: Cho phép public xóa ảnh (để admin có thể xóa khi cần)
-- Lưu ý: Có thể giới hạn chỉ admin nếu muốn bảo mật hơn
CREATE POLICY "Public can delete attendance photos"
ON storage.objects
FOR DELETE
TO public
USING (bucket_id = 'chamcong');
