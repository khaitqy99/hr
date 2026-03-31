-- Fix data types for allowed_locations coordinates
-- Change from DECIMAL to DOUBLE PRECISION for better compatibility

ALTER TABLE allowed_locations 
  ALTER COLUMN latitude TYPE DOUBLE PRECISION,
  ALTER COLUMN longitude TYPE DOUBLE PRECISION;

-- Verify the change
COMMENT ON COLUMN allowed_locations.latitude IS 'Latitude coordinate (DOUBLE PRECISION for better compatibility)';
COMMENT ON COLUMN allowed_locations.longitude IS 'Longitude coordinate (DOUBLE PRECISION for better compatibility)';
