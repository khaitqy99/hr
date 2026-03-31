-- Migration: Add Branches Support
-- Thêm hỗ trợ quản lý chi nhánh

-- Bảng Branches (Chi nhánh)
CREATE TABLE IF NOT EXISTS branches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) UNIQUE NOT NULL,
  address TEXT,
  phone VARCHAR(20),
  manager_id UUID REFERENCES users(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Thêm cột branch_id vào bảng users
ALTER TABLE users ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;

-- Tạo index cho branch_id
CREATE INDEX IF NOT EXISTS idx_users_branch_id ON users(branch_id);

-- Enable RLS cho branches
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;

-- Policy cho branches
CREATE POLICY "Branches are viewable by everyone" ON branches
  FOR SELECT USING (true);

CREATE POLICY "Branches can be inserted by authenticated users" ON branches
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Branches can be updated by authenticated users" ON branches
  FOR UPDATE USING (true);

CREATE POLICY "Branches can be deleted by authenticated users" ON branches
  FOR DELETE USING (true);

-- Trigger để tự động cập nhật updated_at
CREATE TRIGGER update_branches_updated_at BEFORE UPDATE ON branches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert chi nhánh mặc định
INSERT INTO branches (name, code, address, is_active)
VALUES 
  ('Chi nhánh 1', 'CN1', '99B Nguyễn Trãi, Ninh Kiều, Cần Thơ', true),
  ('Chi nhánh 2', 'CN2', '', true)
ON CONFLICT (code) DO NOTHING;
