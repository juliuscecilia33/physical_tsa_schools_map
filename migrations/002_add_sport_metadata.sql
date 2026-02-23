-- Migration: Add sport_metadata column to sports_facilities table
-- Created: 2026-02-22
-- Description: Adds a JSONB column to store confidence scores and reasoning for each identified sport

-- Add the sport_metadata column
ALTER TABLE sports_facilities
ADD COLUMN IF NOT EXISTS sport_metadata JSONB DEFAULT '{}';

-- Create GIN index for efficient JSONB queries
CREATE INDEX IF NOT EXISTS idx_sports_facilities_sport_metadata
  ON sports_facilities USING GIN (sport_metadata);

-- Add comment to document the column
COMMENT ON COLUMN sports_facilities.sport_metadata IS 'JSONB object containing confidence scores, sources, and reasoning for each identified sport. Format: {"SportName": {"score": 0-100, "sources": ["name"|"review"|"api"], "keywords_matched": [...], "confidence": "high"|"medium"|"low", "matched_text": "..."}}';
