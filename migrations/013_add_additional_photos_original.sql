-- Add column to store original external photo URLs as backup
-- The additional_photos column will store Supabase storage URLs
-- This additional_photos_original column will store the original SerpAPI URLs

ALTER TABLE sports_facilities
ADD COLUMN IF NOT EXISTS additional_photos_original JSONB;

COMMENT ON COLUMN sports_facilities.additional_photos_original IS 'Backup of original SerpAPI photo URLs before uploading to Supabase storage';
