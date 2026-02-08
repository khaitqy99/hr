-- Migration: Đảm bảo bucket chamcong tồn tại và là public
-- Nếu bucket chưa tồn tại, tạo mới với public = true
-- Nếu bucket đã tồn tại, đảm bảo public = true

-- Tạo bucket nếu chưa tồn tại
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('chamcong', 'chamcong', true, 52428800, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE
SET public = true;

-- Đảm bảo bucket là public (nếu đã tồn tại)
UPDATE storage.buckets
SET public = true
WHERE id = 'chamcong';

-- Xóa và tạo lại policies để đảm bảo chúng tồn tại
DROP POLICY IF EXISTS "Public can upload attendance photos" ON storage.objects;
DROP POLICY IF EXISTS "Public can read attendance photos" ON storage.objects;
DROP POLICY IF EXISTS "Public can delete attendance photos" ON storage.objects;
DROP POLICY IF EXISTS "Anon can upload attendance photos" ON storage.objects;
DROP POLICY IF EXISTS "Anon can read attendance photos" ON storage.objects;
DROP POLICY IF EXISTS "Anon can delete attendance photos" ON storage.objects;

-- Policies cho public
CREATE POLICY "Public can upload attendance photos"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (bucket_id = 'chamcong');

CREATE POLICY "Public can read attendance photos"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'chamcong');

CREATE POLICY "Public can delete attendance photos"
ON storage.objects
FOR DELETE
TO public
USING (bucket_id = 'chamcong');

-- Policies cho anon (quan trọng khi dùng anon key)
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
