-- Migration: Add identified_sports column to sports_facilities table
-- Created: 2026-02-22
-- Description: Adds a new TEXT[] column to store identified sports for each facility

-- Add the identified_sports column
ALTER TABLE sports_facilities
ADD COLUMN IF NOT EXISTS identified_sports TEXT[] DEFAULT '{}';

-- Create GIN index for efficient array queries
CREATE INDEX IF NOT EXISTS idx_sports_facilities_identified_sports
  ON sports_facilities USING GIN (identified_sports);

-- Add comment to document the column
COMMENT ON COLUMN sports_facilities.identified_sports IS 'Array of identified sports offered at this facility (e.g., Basketball, Soccer, Tennis)';
