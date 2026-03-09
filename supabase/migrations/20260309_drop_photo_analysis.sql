ALTER TABLE sports_facilities DROP COLUMN IF EXISTS photo_analysis;
ALTER TABLE sports_facilities ADD COLUMN IF NOT EXISTS review_images_analysis JSONB;
