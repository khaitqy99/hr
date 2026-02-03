-- Migration: Fix RLS policies for users table
-- Đảm bảo users table có thể được truy cập cả khi chưa đăng nhập (cho OTP flow)

-- Drop các policies từ migration 002 có thể gây conflict với OTP flow
DROP POLICY IF EXISTS "Users can read own profile via auth" ON users;
DROP POLICY IF EXISTS "Users can update own profile via auth" ON users;

-- Đảm bảo policy SELECT cho phép đọc tất cả users (cần cho OTP flow khi chưa đăng nhập)
-- Policy này từ migration 001 nhưng cần đảm bảo nó vẫn hoạt động
-- Nếu policy đã tồn tại, DROP và CREATE lại để đảm bảo nó có priority cao nhất
DROP POLICY IF EXISTS "Users are viewable by everyone" ON users;
CREATE POLICY "Users are viewable by everyone" ON users
  FOR SELECT USING (true);

-- Đảm bảo các policies khác vẫn tồn tại
DROP POLICY IF EXISTS "Users can be inserted by authenticated users" ON users;
CREATE POLICY "Users can be inserted by authenticated users" ON users
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can be updated by authenticated users" ON users;
CREATE POLICY "Users can be updated by authenticated users" ON users
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Users can be deleted by authenticated users" ON users;
CREATE POLICY "Users can be deleted by authenticated users" ON users
  FOR DELETE USING (true);
