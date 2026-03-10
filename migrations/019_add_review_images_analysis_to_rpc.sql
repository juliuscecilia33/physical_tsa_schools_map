-- Migration: Add review_images_analysis to get_facility_full_by_place_id
-- Purpose: The RPC function was missing the review_images_analysis column,
-- so review image usefulness scores were never returned to the frontend.

DROP FUNCTION IF EXISTS get_facility_full_by_place_id(TEXT);

CREATE OR REPLACE FUNCTION get_facility_full_by_place_id(
  p_place_id TEXT
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
  email TEXT[],
  email_scraped_at TIMESTAMPTZ,
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
  serp_scraped_at TIMESTAMPTZ,
  review_images_analysis JSONB
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
    f.email,
    f.email_scraped_at,
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
    f.serp_scraped_at,
    f.review_images_analysis
  FROM sports_facilities f
  WHERE f.place_id = p_place_id
  LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_facility_full_by_place_id IS
'Full facility query by place_id that includes ALL data including heavy arrays (reviews, additional_reviews, additional_photos), email fields, and review_images_analysis. Use for facility detail views only.';
