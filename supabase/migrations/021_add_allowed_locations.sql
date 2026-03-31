-- Migration: Add allowed_locations table for multi-branch check-in locations
-- Created: 2024
-- Description: Allows multiple check-in locations, each linked to a branch

-- Create allowed_locations table
CREATE TABLE IF NOT EXISTS allowed_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  radius_meters INTEGER NOT NULL DEFAULT 200,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_allowed_locations_branch_id ON allowed_locations(branch_id);
CREATE INDEX IF NOT EXISTS idx_allowed_locations_is_active ON allowed_locations(is_active);

-- Enable RLS
ALTER TABLE allowed_locations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Admin can do everything
CREATE POLICY "Admin full access to allowed_locations"
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

-- Employees can view active locations
CREATE POLICY "Employees can view active allowed_locations"
  ON allowed_locations
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Anonymous users can view active locations (for check-in before login)
CREATE POLICY "Anonymous can view active allowed_locations"
  ON allowed_locations
  FOR SELECT
  TO anon
  USING (is_active = true);

-- Add trigger to update updated_at
CREATE OR REPLACE FUNCTION update_allowed_locations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_allowed_locations_updated_at
  BEFORE UPDATE ON allowed_locations
  FOR EACH ROW
  EXECUTE FUNCTION update_allowed_locations_updated_at();

-- Insert default location (existing office location)
INSERT INTO allowed_locations (name, latitude, longitude, radius_meters, is_active)
VALUES ('Văn phòng chính', 10.040675858019696, 105.78463187148355, 200, true)
ON CONFLICT DO NOTHING;

-- Comment
COMMENT ON TABLE allowed_locations IS 'Stores allowed check-in locations for multi-branch support';
COMMENT ON COLUMN allowed_locations.branch_id IS 'Optional: Link location to a specific branch';
COMMENT ON COLUMN allowed_locations.radius_meters IS 'Allowed radius in meters for check-in';
