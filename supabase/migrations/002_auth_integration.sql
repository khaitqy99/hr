-- Migration: Integrate Supabase Auth with users table
-- Tích hợp Supabase Auth với bảng users để hỗ trợ OTP authentication

-- Thêm cột auth_user_id để liên kết với auth.users
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Tạo index cho auth_user_id
CREATE INDEX IF NOT EXISTS idx_users_auth_user_id ON users(auth_user_id);

-- Function để tự động tạo user trong bảng users khi có user mới trong auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Kiểm tra xem user đã tồn tại trong bảng users chưa (qua email)
  IF NOT EXISTS (
    SELECT 1 FROM public.users WHERE email = NEW.email
  ) THEN
    -- Tạo user mới trong bảng users nếu chưa có
    INSERT INTO public.users (
      id,
      auth_user_id,
      name,
      email,
      role,
      department,
      status,
      contract_type
    )
    VALUES (
      uuid_generate_v4(),
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
      NEW.email,
      COALESCE((NEW.raw_user_meta_data->>'role')::VARCHAR(50), 'EMPLOYEE'),
      COALESCE(NEW.raw_user_meta_data->>'department', 'General'),
      'ACTIVE',
      'OFFICIAL'
    );
  ELSE
    -- Cập nhật auth_user_id cho user đã tồn tại
    UPDATE public.users
    SET auth_user_id = NEW.id
    WHERE email = NEW.email AND auth_user_id IS NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger để tự động tạo/cập nhật user khi có user mới trong auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function để đồng bộ email khi email trong auth.users thay đổi
CREATE OR REPLACE FUNCTION public.handle_user_email_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Cập nhật email trong bảng users nếu email trong auth.users thay đổi
  UPDATE public.users
  SET email = NEW.email
  WHERE auth_user_id = NEW.id AND email != NEW.email;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger để đồng bộ email
DROP TRIGGER IF EXISTS on_auth_user_email_updated ON auth.users;
CREATE TRIGGER on_auth_user_email_updated
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  WHEN (OLD.email IS DISTINCT FROM NEW.email)
  EXECUTE FUNCTION public.handle_user_email_update();

-- Policy để user có thể đọc thông tin của chính mình qua auth_user_id
CREATE POLICY "Users can read own profile via auth" ON users
  FOR SELECT USING (
    auth_user_id = auth.uid() OR
    -- Cho phép đọc nếu không có auth (backward compatibility)
    auth_user_id IS NULL
  );

-- Policy để user có thể cập nhật thông tin của chính mình
CREATE POLICY "Users can update own profile via auth" ON users
  FOR UPDATE USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());
