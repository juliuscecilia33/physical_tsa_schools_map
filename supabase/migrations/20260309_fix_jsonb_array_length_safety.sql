-- Migration: Fix jsonb_array_length scalar error
-- After compress-remaining-photos.ts ran, some additional_photos values were stored
-- as JSONB strings (double-encoded) instead of JSONB arrays. This causes
-- jsonb_array_length() to throw "cannot get array length of a scalar".
--
-- Fix: Add jsonb_typeof guards around every jsonb_array_length/jsonb_array_elements call.
-- Also removes sport_metadata (already removed from live functions per 20260305 migration).
--
-- IMPORTANT: Run this migration in the Supabase SQL editor.

-- ============================================================
-- 1. get_all_facilities_lightweight
-- ============================================================
DROP FUNCTION IF EXISTS get_all_facilities_lightweight(INTEGER, BOOLEAN, BOOLEAN);

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
    f.address,
    ST_Y(f.location::geometry) AS lat,
    ST_X(f.location::geometry) AS lng,
    f.phone,
    f.website,
    f.rating,
    f.user_ratings_total,
    f.photo_references,
    (CASE WHEN jsonb_typeof(f.additional_photos) = 'array' THEN jsonb_array_length(f.additional_photos) ELSE 0 END) AS additional_photos_count,
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
        (CASE WHEN jsonb_typeof(f.additional_photos) = 'array' THEN jsonb_array_length(f.additional_photos) ELSE 0 END) +
        COALESCE(
          (SELECT SUM(CASE WHEN jsonb_typeof(review->'images') = 'array' THEN jsonb_array_length(review->'images') ELSE 0 END)::INTEGER
           FROM jsonb_array_elements(CASE WHEN jsonb_typeof(f.additional_reviews) = 'array' THEN f.additional_reviews ELSE '[]'::jsonb END) AS review),
          0
        )
      ELSE
        COALESCE(array_length(f.photo_references, 1), 0) +
        (CASE WHEN jsonb_typeof(f.additional_photos) = 'array' THEN jsonb_array_length(f.additional_photos) ELSE 0 END)
    END)::INTEGER AS total_photo_count
  FROM sports_facilities f
  WHERE
    (include_hidden OR f.hidden = false)
    AND (include_cleaned_up OR f.cleaned_up = false)
  ORDER BY f.rating DESC NULLS LAST, f.user_ratings_total DESC NULLS LAST
  LIMIT row_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================
-- 2. get_facilities_by_tags
-- ============================================================
DROP FUNCTION IF EXISTS get_facilities_by_tags(UUID[], INTEGER, BOOLEAN, BOOLEAN);

CREATE OR REPLACE FUNCTION get_facilities_by_tags(
  tag_ids UUID[],
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
  SELECT DISTINCT ON (f.place_id)
    f.id,
    f.place_id,
    f.name,
    f.sport_types,
    f.identified_sports,
    f.address,
    ST_Y(f.location::geometry) AS lat,
    ST_X(f.location::geometry) AS lng,
    f.phone,
    f.website,
    f.rating,
    f.user_ratings_total,
    f.photo_references,
    (CASE WHEN jsonb_typeof(f.additional_photos) = 'array' THEN jsonb_array_length(f.additional_photos) ELSE 0 END) AS additional_photos_count,
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
        (CASE WHEN jsonb_typeof(f.additional_photos) = 'array' THEN jsonb_array_length(f.additional_photos) ELSE 0 END) +
        COALESCE(
          (SELECT SUM(CASE WHEN jsonb_typeof(review->'images') = 'array' THEN jsonb_array_length(review->'images') ELSE 0 END)::INTEGER
           FROM jsonb_array_elements(CASE WHEN jsonb_typeof(f.additional_reviews) = 'array' THEN f.additional_reviews ELSE '[]'::jsonb END) AS review),
          0
        )
      ELSE
        COALESCE(array_length(f.photo_references, 1), 0) +
        (CASE WHEN jsonb_typeof(f.additional_photos) = 'array' THEN jsonb_array_length(f.additional_photos) ELSE 0 END)
    END)::INTEGER AS total_photo_count
  FROM sports_facilities f
  INNER JOIN facility_tag_assignments ta ON ta.place_id = f.place_id
  WHERE
    ta.tag_id = ANY(tag_ids)
    AND (include_hidden OR f.hidden = false)
    AND (include_cleaned_up OR f.cleaned_up = false)
  ORDER BY f.place_id, f.rating DESC NULLS LAST, f.user_ratings_total DESC NULLS LAST
  LIMIT row_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================
-- 3. get_facilities_excluding_tags_paginated
-- ============================================================
DROP FUNCTION IF EXISTS get_facilities_excluding_tags_paginated(UUID[], INTEGER, INTEGER, BOOLEAN, BOOLEAN);

CREATE OR REPLACE FUNCTION get_facilities_excluding_tags_paginated(
  exclude_tag_ids UUID[],
  offset_val INTEGER DEFAULT 0,
  limit_val INTEGER DEFAULT 1000,
  include_hidden BOOLEAN DEFAULT true,
  include_cleaned_up BOOLEAN DEFAULT true
)
RETURNS TABLE (
  id UUID,
  place_id TEXT,
  name TEXT,
  sport_types TEXT[],
  identified_sports TEXT[],
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
    f.address,
    ST_Y(f.location::geometry) AS lat,
    ST_X(f.location::geometry) AS lng,
    f.phone,
    f.website,
    f.rating,
    f.user_ratings_total,
    f.photo_references,
    (CASE WHEN jsonb_typeof(f.additional_photos) = 'array' THEN jsonb_array_length(f.additional_photos) ELSE 0 END) AS additional_photos_count,
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
        (CASE WHEN jsonb_typeof(f.additional_photos) = 'array' THEN jsonb_array_length(f.additional_photos) ELSE 0 END) +
        COALESCE(
          (SELECT SUM(CASE WHEN jsonb_typeof(review->'images') = 'array' THEN jsonb_array_length(review->'images') ELSE 0 END)::INTEGER
           FROM jsonb_array_elements(CASE WHEN jsonb_typeof(f.additional_reviews) = 'array' THEN f.additional_reviews ELSE '[]'::jsonb END) AS review),
          0
        )
      ELSE
        COALESCE(array_length(f.photo_references, 1), 0) +
        (CASE WHEN jsonb_typeof(f.additional_photos) = 'array' THEN jsonb_array_length(f.additional_photos) ELSE 0 END)
    END)::INTEGER AS total_photo_count
  FROM sports_facilities f
  WHERE
    NOT EXISTS (
      SELECT 1
      FROM facility_tag_assignments ta
      WHERE ta.place_id = f.place_id
        AND ta.tag_id = ANY(exclude_tag_ids)
    )
    AND (include_hidden OR f.hidden = false)
    AND (include_cleaned_up OR f.cleaned_up = false)
  ORDER BY f.rating DESC NULLS LAST, f.user_ratings_total DESC NULLS LAST
  OFFSET offset_val
  LIMIT limit_val;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================
-- 4. get_facilities_by_tags_paginated
-- ============================================================
DROP FUNCTION IF EXISTS get_facilities_by_tags_paginated(UUID[], INTEGER, INTEGER, BOOLEAN, BOOLEAN);

CREATE OR REPLACE FUNCTION get_facilities_by_tags_paginated(
  tag_ids UUID[],
  offset_val INTEGER DEFAULT 0,
  limit_val INTEGER DEFAULT 500,
  include_hidden BOOLEAN DEFAULT true,
  include_cleaned_up BOOLEAN DEFAULT true
)
RETURNS TABLE (
  id UUID,
  place_id TEXT,
  name TEXT,
  sport_types TEXT[],
  identified_sports TEXT[],
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
  SELECT DISTINCT ON (f.place_id)
    f.id,
    f.place_id,
    f.name,
    f.sport_types,
    f.identified_sports,
    f.address,
    ST_Y(f.location::geometry) AS lat,
    ST_X(f.location::geometry) AS lng,
    f.phone,
    f.website,
    f.rating,
    f.user_ratings_total,
    f.photo_references,
    (CASE WHEN jsonb_typeof(f.additional_photos) = 'array' THEN jsonb_array_length(f.additional_photos) ELSE 0 END) AS additional_photos_count,
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
        (CASE WHEN jsonb_typeof(f.additional_photos) = 'array' THEN jsonb_array_length(f.additional_photos) ELSE 0 END) +
        COALESCE(
          (SELECT SUM(CASE WHEN jsonb_typeof(review->'images') = 'array' THEN jsonb_array_length(review->'images') ELSE 0 END)::INTEGER
           FROM jsonb_array_elements(CASE WHEN jsonb_typeof(f.additional_reviews) = 'array' THEN f.additional_reviews ELSE '[]'::jsonb END) AS review),
          0
        )
      ELSE
        COALESCE(array_length(f.photo_references, 1), 0) +
        (CASE WHEN jsonb_typeof(f.additional_photos) = 'array' THEN jsonb_array_length(f.additional_photos) ELSE 0 END)
    END)::INTEGER AS total_photo_count
  FROM sports_facilities f
  INNER JOIN facility_tag_assignments ta ON ta.place_id = f.place_id
  WHERE
    ta.tag_id = ANY(tag_ids)
    AND (include_hidden OR f.hidden = false)
    AND (include_cleaned_up OR f.cleaned_up = false)
  ORDER BY f.place_id, f.rating DESC NULLS LAST, f.user_ratings_total DESC NULLS LAST
  OFFSET offset_val
  LIMIT limit_val;
END;
$$ LANGUAGE plpgsql STABLE;
