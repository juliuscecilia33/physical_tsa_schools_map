-- Migration: Create lightweight viewport-based facility query function
-- Purpose: Reduce egress by fetching only facilities within map bounds without heavy arrays

-- Drop function if it exists
DROP FUNCTION IF EXISTS get_facilities_lightweight_by_bounds(
  DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, BOOLEAN, BOOLEAN
);

-- Create lightweight viewport-based query function
CREATE OR REPLACE FUNCTION get_facilities_lightweight_by_bounds(
  min_lat DOUBLE PRECISION,
  max_lat DOUBLE PRECISION,
  min_lng DOUBLE PRECISION,
  max_lng DOUBLE PRECISION,
  zoom_level INTEGER DEFAULT 10,
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
  photo_references TEXT[],
  opening_hours JSONB,
  business_status TEXT,
  hidden BOOLEAN,
  cleaned_up BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  has_notes BOOLEAN,
  tags JSONB,
  serp_scraped BOOLEAN,
  serp_scraped_at TIMESTAMPTZ
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
    f.photo_references,
    f.opening_hours,
    f.business_status,
    f.hidden,
    f.cleaned_up,
    f.created_at,
    f.updated_at,
    EXISTS(SELECT 1 FROM facility_notes n WHERE n.place_id = f.place_id) AS has_notes,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', t.id,
            'name', t.name,
            'color', t.color,
            'description', t.description
          )
          ORDER BY t.name
        )
        FROM facility_tag_assignments ta
        JOIN facility_tags t ON ta.tag_id = t.id
        WHERE ta.place_id = f.place_id
      ),
      '[]'::jsonb
    ) AS tags,
    f.serp_scraped,
    f.serp_scraped_at
  FROM sports_facilities f
  WHERE
    -- Filter by viewport bounds using spatial index
    ST_Y(f.location::geometry) BETWEEN min_lat AND max_lat
    AND ST_X(f.location::geometry) BETWEEN min_lng AND max_lng
    -- Filter by visibility
    AND (include_hidden OR f.hidden = false)
    AND (include_cleaned_up OR f.cleaned_up = false)
  ORDER BY f.rating DESC NULLS LAST, f.user_ratings_total DESC NULLS LAST
  -- Limit results based on zoom level to prevent over-fetching
  LIMIT CASE
    WHEN zoom_level < 8 THEN 500   -- Very zoomed out: show fewer facilities
    WHEN zoom_level < 12 THEN 1000 -- Medium zoom: moderate number
    ELSE 2000                      -- Zoomed in: show more detail
  END;
END;
$$ LANGUAGE plpgsql STABLE;

-- Add comment explaining the function
COMMENT ON FUNCTION get_facilities_lightweight_by_bounds IS
'Lightweight viewport-based facility query that excludes heavy arrays (reviews, additional_reviews, additional_photos, notes) to reduce egress. Returns only facilities within the specified lat/lng bounds with adaptive limits based on zoom level.';
