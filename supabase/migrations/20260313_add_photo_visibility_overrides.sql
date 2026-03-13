-- Add photo_visibility_overrides JSONB column to sports_facilities
-- Keyed by photo URL: { [url]: "show" | "hide" }
-- Applied as a post-processing layer on top of the usefulness_score filter.
-- DEFAULT '{}' means no backfill needed.
ALTER TABLE sports_facilities
  ADD COLUMN IF NOT EXISTS photo_visibility_overrides JSONB DEFAULT '{}'::jsonb;
