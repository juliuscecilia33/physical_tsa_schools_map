-- Migration: Add serp_data_id column to sports_facilities table
-- This column stores the Google Maps data_id needed for SerpAPI Photos API
-- Format: 0x89c25998e556791b:0xbdcd67f46e37b16d

-- Add serp_data_id column
ALTER TABLE sports_facilities
ADD COLUMN IF NOT EXISTS serp_data_id TEXT;

-- Add comment explaining the column
COMMENT ON COLUMN sports_facilities.serp_data_id IS 'Google Maps data_id used for SerpAPI Photos API. Format: 0x...:0x...';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_sports_facilities_serp_data_id
ON sports_facilities(serp_data_id)
WHERE serp_data_id IS NOT NULL;
