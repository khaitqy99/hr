-- Fix RLS policy for allowed_locations to allow admin updates
-- Drop all existing policies
DROP POLICY IF EXISTS "Admin full access to allowed_locations" ON allowed_locations;
DROP POLICY IF EXISTS "Employees can view active allowed_locations" ON allowed_locations;
DROP POLICY IF EXISTS "Anonymous can view active allowed_locations" ON allowed_locations;

-- Recreate admin policy with proper permissions
CREATE POLICY "Admin can manage allowed_locations"
  ON allowed_locations
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'ADMIN'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'ADMIN'
    )
  );

-- Recreate employee view policy
CREATE POLICY "Employees can view active locations"
  ON allowed_locations
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Recreate anonymous view policy
CREATE POLICY "Anonymous can view active locations"
  ON allowed_locations
  FOR SELECT
  TO anon
  USING (is_active = true);

