-- Đảm bảo bucket chamcong là public để ảnh có thể hiển thị qua URL public
-- Nếu bucket private, getPublicUrl() trả về URL nhưng truy cập sẽ lỗi (403/JSON)

UPDATE storage.buckets
SET public = true
WHERE id = 'chamcong';
