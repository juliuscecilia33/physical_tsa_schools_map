-- Add email fields to track contact information for sports facilities
-- Email addresses will be collected by scraping facility websites

ALTER TABLE sports_facilities
ADD COLUMN IF NOT EXISTS email TEXT;

ALTER TABLE sports_facilities
ADD COLUMN IF NOT EXISTS email_scraped_at TIMESTAMPTZ;

ALTER TABLE sports_facilities
ADD COLUMN IF NOT EXISTS email_scrape_attempted BOOLEAN DEFAULT FALSE;

-- Create index for efficient querying of facilities that need email scraping
CREATE INDEX IF NOT EXISTS idx_email_scrape_attempted
ON sports_facilities(email_scrape_attempted)
WHERE serp_scraped = TRUE AND website IS NOT NULL;

-- Create index for facilities with emails
CREATE INDEX IF NOT EXISTS idx_facilities_with_email
ON sports_facilities(email)
WHERE email IS NOT NULL;

-- Add comment to email column
COMMENT ON COLUMN sports_facilities.email IS 'Contact email address scraped from facility website';
COMMENT ON COLUMN sports_facilities.email_scraped_at IS 'Timestamp when email was successfully scraped';
COMMENT ON COLUMN sports_facilities.email_scrape_attempted IS 'Whether an attempt was made to scrape email (even if unsuccessful)';
