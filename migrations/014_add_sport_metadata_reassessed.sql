-- Add sport_metadata_reassessed column to track facilities that have been re-assessed
-- with additional_reviews from SerpAPI

ALTER TABLE sports_facilities
ADD COLUMN IF NOT EXISTS sport_metadata_reassessed BOOLEAN DEFAULT FALSE;

-- Create index for efficient querying of facilities that need reassessment
CREATE INDEX IF NOT EXISTS idx_sport_metadata_reassessed
ON sports_facilities(sport_metadata_reassessed)
WHERE serp_scraped = TRUE;
