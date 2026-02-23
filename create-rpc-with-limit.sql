-- Drop the old function with full signature (including parameter types)
DROP FUNCTION IF EXISTS get_facilities_with_coords(INT, BOOLEAN);

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
  identified_sports TEXT[],
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
  has_notes BOOLEAN,
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
    sf.identified_sports,
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
    CASE WHEN COUNT(fn.id) > 0 THEN TRUE ELSE FALSE END AS has_notes,
    sf.created_at,
    sf.updated_at
  FROM sports_facilities sf
  LEFT JOIN facility_notes fn ON sf.place_id = fn.place_id
  WHERE include_hidden = TRUE OR sf.hidden = FALSE
  GROUP BY sf.id, sf.place_id, sf.name, sf.sport_types, sf.identified_sports, sf.address, sf.location,
           sf.phone, sf.website, sf.rating, sf.user_ratings_total, sf.reviews,
           sf.photo_references, sf.opening_hours, sf.business_status, sf.hidden,
           sf.created_at, sf.updated_at
  LIMIT row_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
