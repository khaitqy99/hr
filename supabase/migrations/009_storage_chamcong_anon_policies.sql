-- Cho phép anon (app dùng OTP, không dùng Supabase Auth) upload/đọc/xóa ảnh chấm công
-- Policy "TO public" đôi khi không đủ với Storage; thêm policy cho role anon rõ ràng

DROP POLICY IF EXISTS "Anon can upload attendance photos" ON storage.objects;
DROP POLICY IF EXISTS "Anon can read attendance photos" ON storage.objects;
DROP POLICY IF EXISTS "Anon can delete attendance photos" ON storage.objects;

CREATE POLICY "Anon can upload attendance photos"
ON storage.objects
FOR INSERT
TO anon
WITH CHECK (bucket_id = 'chamcong');

CREATE POLICY "Anon can read attendance photos"
ON storage.objects
FOR SELECT
TO anon
USING (bucket_id = 'chamcong');

CREATE POLICY "Anon can delete attendance photos"
ON storage.objects
FOR DELETE
TO anon
USING (bucket_id = 'chamcong');
