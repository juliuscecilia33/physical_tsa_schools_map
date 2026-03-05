-- ============================================
-- Table 1: lead_activities
-- Stores Close CRM activities (calls, emails, notes) in our DB.
-- Upserted when "Generate Email" is clicked so the AI always has full context.
-- ============================================
CREATE TABLE lead_activities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  close_activity_id TEXT NOT NULL UNIQUE,  -- Close CRM activity ID (dedup key)
  close_lead_id TEXT NOT NULL,
  activity_type TEXT NOT NULL,             -- 'call', 'email', 'note'
  direction TEXT,                          -- 'inbound'/'outbound' or 'incoming'/'outgoing'
  date_created TIMESTAMPTZ NOT NULL,
  user_name TEXT,
  -- Email fields
  subject TEXT,
  body_text TEXT,
  -- Call fields
  call_duration INTEGER,                   -- seconds
  call_disposition TEXT,                   -- answered, no-answer, vm-left, etc.
  call_summary TEXT,                       -- Close AI-generated summary
  call_transcript TEXT,                    -- Full utterances as formatted text
  voicemail_transcript TEXT,
  -- Note fields
  note_text TEXT,
  -- Metadata
  raw_data JSONB,                          -- full Close activity JSON for reference
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_lead_activities_lead_id ON lead_activities(close_lead_id);
CREATE INDEX idx_lead_activities_date ON lead_activities(date_created);
CREATE UNIQUE INDEX idx_lead_activities_close_id ON lead_activities(close_activity_id);

ALTER TABLE lead_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated read" ON lead_activities FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert" ON lead_activities FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update" ON lead_activities FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- Table 2: generated_emails
-- Stores AI-generated email drafts for tracking.
-- ============================================
CREATE TABLE generated_emails (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  close_lead_id TEXT NOT NULL,
  recipient_email TEXT,
  recipient_name TEXT,
  subject TEXT NOT NULL,
  body_text TEXT NOT NULL,
  email_type TEXT NOT NULL CHECK (email_type IN ('intro', 'follow_up', 'reply')),
  reasoning TEXT,                   -- Claude's explanation of its approach
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'discarded')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_generated_emails_lead_id ON generated_emails(close_lead_id);
CREATE INDEX idx_generated_emails_created_at ON generated_emails(created_at DESC);

ALTER TABLE generated_emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated read" ON generated_emails FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert" ON generated_emails FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update" ON generated_emails FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated delete" ON generated_emails FOR DELETE TO authenticated USING (true);
