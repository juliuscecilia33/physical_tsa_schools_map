ALTER TABLE generated_emails ADD COLUMN feedback_rating TEXT CHECK (feedback_rating IN ('used', 'helpful', 'bad'));
ALTER TABLE generated_emails ADD COLUMN feedback_note TEXT;
ALTER TABLE generated_emails ADD COLUMN feedback_at TIMESTAMPTZ;
