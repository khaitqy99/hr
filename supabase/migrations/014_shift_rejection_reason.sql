-- Add rejection_reason to shift_registrations (when admin rejects a shift request)
ALTER TABLE shift_registrations
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
