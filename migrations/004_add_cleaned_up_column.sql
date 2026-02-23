-- Migration: Add cleaned_up column for programmatic filtering
-- Purpose: Separate automatic cleanup filtering from manual hidden column

-- Add cleaned_up column to sports_facilities table
ALTER TABLE sports_facilities
ADD COLUMN IF NOT EXISTS cleaned_up BOOLEAN DEFAULT false;

-- Create index on cleaned_up for faster filtering
CREATE INDEX IF NOT EXISTS idx_sports_facilities_cleaned_up
ON sports_facilities(cleaned_up);

-- Create composite index for common queries (hidden + cleaned_up)
CREATE INDEX IF NOT EXISTS idx_sports_facilities_hidden_cleaned_up
ON sports_facilities(hidden, cleaned_up)
WHERE hidden = false AND cleaned_up = false;

-- Add comment explaining the column
COMMENT ON COLUMN sports_facilities.cleaned_up IS
'Programmatic filter for low-quality/non-sport facilities. Separate from manual "hidden" column.';

-- Drop old versions of the function to avoid signature conflicts
DROP FUNCTION IF EXISTS get_facilities_with_coords(INTEGER, BOOLEAN);
DROP FUNCTION IF EXISTS get_facilities_with_coords(INTEGER, BOOLEAN, BOOLEAN);

-- Create new version of get_facilities_with_coords function to exclude cleaned_up facilities by default
CREATE OR REPLACE FUNCTION get_facilities_with_coords(
  row_limit INTEGER DEFAULT 20000,
  include_hidden BOOLEAN DEFAULT false,
  include_cleaned_up BOOLEAN DEFAULT false
)
RETURNS TABLE (
  id UUID,
  place_id TEXT,
  name TEXT,
  sport_types TEXT[],
  identified_sports TEXT[],
  sport_metadata JSONB,
  address TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  phone TEXT,
  website TEXT,
  rating NUMERIC,
  user_ratings_total INTEGER,
  reviews JSONB,
  photo_references TEXT[],
  opening_hours JSONB,
  business_status TEXT,
  hidden BOOLEAN,
  cleaned_up BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    f.id,
    f.place_id,
    f.name,
    f.sport_types,
    f.identified_sports,
    f.sport_metadata,
    f.address,
    ST_Y(f.location::geometry) AS lat,
    ST_X(f.location::geometry) AS lng,
    f.phone,
    f.website,
    f.rating,
    f.user_ratings_total,
    f.reviews,
    f.photo_references,
    f.opening_hours,
    f.business_status,
    f.hidden,
    f.cleaned_up,
    f.created_at,
    f.updated_at
  FROM sports_facilities f
  WHERE
    (include_hidden = true OR f.hidden = false)
    AND (include_cleaned_up = true OR f.cleaned_up = false)
  LIMIT row_limit;
END;
$$ LANGUAGE plpgsql;
