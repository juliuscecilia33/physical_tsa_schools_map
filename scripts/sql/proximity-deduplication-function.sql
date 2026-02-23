-- SQL Migration: Add proximity deduplication function
-- Purpose: Find facilities within a specified radius for duplicate detection
-- Usage: Run this in your Supabase SQL Editor before using the enhanced collection script

-- Create function to find nearby facilities
CREATE OR REPLACE FUNCTION find_nearby_facilities(
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  radius_meters INTEGER DEFAULT 50
)
RETURNS TABLE (
  place_id TEXT,
  name TEXT,
  distance_meters DOUBLE PRECISION
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sf.place_id,
    sf.name,
    ST_Distance(
      sf.location::geography,
      ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
    ) AS distance_meters
  FROM sports_facilities sf
  WHERE ST_DWithin(
    sf.location::geography,
    ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
    radius_meters
  )
  ORDER BY distance_meters
  LIMIT 5;
END;
$$;

-- Add comment
COMMENT ON FUNCTION find_nearby_facilities IS
'Find sports facilities within a specified radius (meters) of a given lat/lng coordinate. Used for duplicate detection during facility collection.';

-- Test the function (optional - uncomment to test)
-- SELECT * FROM find_nearby_facilities(32.7767, -96.7970, 50);
