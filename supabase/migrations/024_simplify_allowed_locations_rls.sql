-- Simplify RLS for allowed_locations - make it work!

-- Drop all policies
DROP POLICY IF EXISTS "admin_all_allowed_locations" ON allowed_locations;
DROP POLICY IF EXISTS "authenticated_view_active_locations" ON allowed_locations;
DROP POLICY IF EXISTS "anon_view_active_locations" ON allowed_locations;

-- Create one simple policy for admin - ALL operations
CREATE POLICY "admin_full_access"
  ON allowed_locations
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'ADMIN'
  )
  WITH CHECK (
    (SELECT role FROM users WHERE id = auth.uid()) = 'ADMIN'
  );

-- Create policy for viewing active locations (all authenticated users)
CREATE POLICY "view_active_locations"
  ON allowed_locations
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (
    is_active = true
    OR (SELECT role FROM users WHERE id = auth.uid()) = 'ADMIN'
  );

-- Create policy for anonymous to view active locations
CREATE POLICY "anon_view_active"
  ON allowed_locations
  AS PERMISSIVE
  FOR SELECT
  TO anon
  USING (is_active = true);

-- Verify
SELECT 
  policyname, 
  cmd,
  roles,
  CASE WHEN qual IS NOT NULL THEN 'Has USING' ELSE 'No USING' END as using_clause,
  CASE WHEN with_check IS NOT NULL THEN 'Has WITH CHECK' ELSE 'No WITH CHECK' END as check_clause
FROM pg_policies 
WHERE tablename = 'allowed_locations'
ORDER BY policyname;
