-- Migration: Create lightweight query for ALL facilities
-- Purpose: Fetch all facilities with lightweight payload (no heavy arrays)

-- Drop function if it exists
DROP FUNCTION IF EXISTS get_all_facilities_lightweight(INTEGER, BOOLEAN, BOOLEAN);

-- Create lightweight all-facilities query function
CREATE OR REPLACE FUNCTION get_all_facilities_lightweight(
  row_limit INTEGER DEFAULT 20000,
  include_hidden BOOLEAN DEFAULT true,
  include_cleaned_up BOOLEAN DEFAULT true
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
  additional_photos_count INTEGER,
  opening_hours JSONB,
  business_status TEXT,
  hidden BOOLEAN,
  cleaned_up BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  has_notes BOOLEAN,
  tags JSONB,
  serp_scraped BOOLEAN,
  serp_scraped_at TIMESTAMPTZ,
  total_photo_count INTEGER
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
    COALESCE(jsonb_array_length(f.additional_photos), 0) AS additional_photos_count,
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
    f.serp_scraped_at,
    (CASE
      WHEN f.serp_scraped = true THEN
        COALESCE(jsonb_array_length(f.additional_photos), 0) +
        COALESCE(
          (SELECT SUM(jsonb_array_length(review->'images'))::INTEGER
           FROM jsonb_array_elements(f.additional_reviews) AS review),
          0
        )
      ELSE
        COALESCE(array_length(f.photo_references, 1), 0) +
        COALESCE(jsonb_array_length(f.additional_photos), 0)
    END)::INTEGER AS total_photo_count
  FROM sports_facilities f
  WHERE
    (include_hidden OR f.hidden = false)
    AND (include_cleaned_up OR f.cleaned_up = false)
  ORDER BY f.rating DESC NULLS LAST, f.user_ratings_total DESC NULLS LAST
  LIMIT row_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- Add comment explaining the function
COMMENT ON FUNCTION get_all_facilities_lightweight IS
'Lightweight query for ALL facilities that excludes heavy arrays (reviews, additional_reviews, additional_photos, notes) to reduce egress while maintaining all filtering capabilities.';
