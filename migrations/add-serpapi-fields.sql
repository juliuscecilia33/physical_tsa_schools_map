-- Migration: Add SerpAPI enrichment fields to sports_facilities table
-- Purpose: Store additional photos and reviews fetched from SerpAPI
-- Created: 2026-02-24

-- Add columns for SerpAPI enriched data
ALTER TABLE sports_facilities
  ADD COLUMN IF NOT EXISTS additional_photos JSONB,
  ADD COLUMN IF NOT EXISTS additional_reviews JSONB,
  ADD COLUMN IF NOT EXISTS serp_scraped BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS serp_scraped_at TIMESTAMPTZ;

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_sports_facilities_serp_scraped
  ON sports_facilities(serp_scraped);

CREATE INDEX IF NOT EXISTS idx_sports_facilities_serp_scraped_at
  ON sports_facilities(serp_scraped_at);

-- Add comments for documentation
COMMENT ON COLUMN sports_facilities.additional_photos IS
  'Full photo data from SerpAPI Google Maps API - includes all photos beyond the 10 from Google Places API';

COMMENT ON COLUMN sports_facilities.additional_reviews IS
  'Full review data from SerpAPI Google Maps API - includes all reviews beyond the 5 from Google Places API';

COMMENT ON COLUMN sports_facilities.serp_scraped IS
  'Boolean flag indicating if SerpAPI enrichment has been completed for this facility';

COMMENT ON COLUMN sports_facilities.serp_scraped_at IS
  'Timestamp of when SerpAPI enrichment was last performed for this facility';
