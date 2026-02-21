-- Drop the old function
DROP FUNCTION IF EXISTS get_facilities_with_coords();

-- Create new function that accepts a limit parameter and optional hidden filter
CREATE OR REPLACE FUNCTION get_facilities_with_coords(
  row_limit INT DEFAULT 10000,
  include_hidden BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  id UUID,
  place_id TEXT,
  name TEXT,
  sport_types TEXT[],
  address TEXT,
  lat FLOAT,
  lng FLOAT,
  phone TEXT,
  website TEXT,
  rating NUMERIC,
  user_ratings_total INTEGER,
  reviews JSONB,
  photo_references TEXT[],
  opening_hours JSONB,
  business_status TEXT,
  hidden BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sf.id,
    sf.place_id,
    sf.name,
    sf.sport_types,
    sf.address,
    ST_Y(sf.location::geometry) AS lat,
    ST_X(sf.location::geometry) AS lng,
    sf.phone,
    sf.website,
    sf.rating,
    sf.user_ratings_total,
    sf.reviews,
    sf.photo_references,
    sf.opening_hours,
    sf.business_status,
    sf.hidden,
    sf.created_at,
    sf.updated_at
  FROM sports_facilities sf
  WHERE include_hidden = TRUE OR sf.hidden = FALSE
  LIMIT row_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
