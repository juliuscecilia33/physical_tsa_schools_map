-- Migration: Update get_facilities_with_coords to include SerpAPI enriched data
-- Purpose: Add additional_photos, additional_reviews, and serp_scraped fields to facility query results

-- Drop old version of the function
DROP FUNCTION IF EXISTS get_facilities_with_coords(INTEGER, BOOLEAN, BOOLEAN);

-- Create updated version with SerpAPI enriched data
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
  updated_at TIMESTAMPTZ,
  has_notes BOOLEAN,
  tags JSONB,
  additional_photos JSONB,
  additional_reviews JSONB,
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
    f.reviews,
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
    f.additional_photos,
    f.additional_reviews,
    f.serp_scraped,
    f.serp_scraped_at
  FROM sports_facilities f
  WHERE
    (include_hidden = true OR f.hidden = false)
    AND (include_cleaned_up = true OR f.cleaned_up = false)
  LIMIT row_limit;
END;
$$ LANGUAGE plpgsql;
