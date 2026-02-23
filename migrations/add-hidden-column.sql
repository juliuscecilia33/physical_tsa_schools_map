-- Migration: Add hidden column to sports_facilities table
-- This allows facilities to be hidden from the map by default

-- Add hidden column with default value of FALSE
ALTER TABLE sports_facilities
ADD COLUMN IF NOT EXISTS hidden BOOLEAN DEFAULT FALSE;

-- Add index for better query performance when filtering by hidden status
CREATE INDEX IF NOT EXISTS idx_sports_facilities_hidden
ON sports_facilities(hidden);

-- Add comment to explain the column's purpose
COMMENT ON COLUMN sports_facilities.hidden IS 'When true, facility is hidden from map by default unless user enables "Show Hidden Facilities" toggle';
