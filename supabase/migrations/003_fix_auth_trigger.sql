-- Migration: Fix auth trigger to only update existing users
-- Sửa trigger để chỉ cập nhật auth_user_id cho user đã tồn tại, không tạo user mới
-- Điều này đảm bảo hệ thống chỉ cho phép đăng nhập, không cho phép đăng ký tự động

-- Function để chỉ cập nhật auth_user_id cho user đã tồn tại
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Chỉ cập nhật auth_user_id cho user đã tồn tại trong bảng users
  -- KHÔNG tạo user mới để đảm bảo chỉ cho phép đăng nhập
  UPDATE public.users
  SET auth_user_id = NEW.id
  WHERE email = NEW.email AND auth_user_id IS NULL;
  
  -- Nếu user không tồn tại trong bảng users, không làm gì cả
  -- User sẽ không thể đăng nhập vì không có trong bảng users
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
