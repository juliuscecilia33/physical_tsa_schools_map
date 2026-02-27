-- Update email column to TEXT[] to support multiple emails per facility
-- This migration drops the existing email column and recreates it as an array

-- Drop the existing email column
ALTER TABLE sports_facilities
DROP COLUMN IF EXISTS email;

-- Add new email column as TEXT array
ALTER TABLE sports_facilities
ADD COLUMN email TEXT[];

-- Reset email_scrape_attempted to false for all facilities to re-scrape with new array format
UPDATE sports_facilities
SET email_scrape_attempted = false,
    email_scraped_at = NULL
WHERE email_scrape_attempted = true;

-- Update index for facilities with emails (drop old, create new)
DROP INDEX IF EXISTS idx_facilities_with_email;
CREATE INDEX IF NOT EXISTS idx_facilities_with_email
ON sports_facilities USING GIN (email)
WHERE email IS NOT NULL AND array_length(email, 1) > 0;

-- Update comment to reflect array storage
COMMENT ON COLUMN sports_facilities.email IS 'Array of contact email addresses scraped from facility website';
