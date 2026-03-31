-- Completely recreate RLS policies for allowed_locations
-- This should fix the 406 error

-- First, disable RLS temporarily
ALTER TABLE allowed_locations DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "Admin full access to allowed_locations" ON allowed_locations;
DROP POLICY IF EXISTS "Admin can manage allowed_locations" ON allowed_locations;
DROP POLICY IF EXISTS "Employees can view active allowed_locations" ON allowed_locations;
DROP POLICY IF EXISTS "Employees can view active locations" ON allowed_locations;
DROP POLICY IF EXISTS "Anonymous can view active allowed_locations" ON allowed_locations;
DROP POLICY IF EXISTS "Anonymous can view active locations" ON allowed_locations;

-- Re-enable RLS
ALTER TABLE allowed_locations ENABLE ROW LEVEL SECURITY;

-- Create simple, permissive policies
-- Admin can do everything
CREATE POLICY "admin_all_allowed_locations"
  ON allowed_locations
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'ADMIN'
    )
  );

-- Authenticated users can view active locations
CREATE POLICY "authenticated_view_active_locations"
  ON allowed_locations
  FOR SELECT
  USING (
    is_active = true
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'ADMIN'
    )
  );

-- Anonymous users can view active locations (for check-in)
CREATE POLICY "anon_view_active_locations"
  ON allowed_locations
  FOR SELECT
  TO anon
  USING (is_active = true);

-- Verify policies were created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'allowed_locations';
