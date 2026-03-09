-- Add photo_analysis JSONB column to sports_facilities
-- Stores Gemini Vision analysis of facility images (usefulness scores, categories)
ALTER TABLE sports_facilities ADD COLUMN IF NOT EXISTS photo_analysis JSONB;
