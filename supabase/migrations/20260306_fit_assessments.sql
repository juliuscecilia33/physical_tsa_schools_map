-- ============================================
-- Table: fit_assessments
-- Stores AI-generated facility fit assessments.
-- Scores whether a facility is a good fit for a recurring off-peak lease.
-- ============================================
CREATE TABLE fit_assessments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  close_lead_id TEXT NOT NULL,
  place_id TEXT,
  facility_name TEXT,
  overall_score INTEGER NOT NULL CHECK (overall_score BETWEEN 0 AND 100),
  availability_score INTEGER NOT NULL CHECK (availability_score BETWEEN 0 AND 100),
  review_signals_score INTEGER NOT NULL CHECK (review_signals_score BETWEEN 0 AND 100),
  facility_quality_score INTEGER NOT NULL CHECK (facility_quality_score BETWEEN 0 AND 100),
  engagement_score INTEGER NOT NULL CHECK (engagement_score BETWEEN 0 AND 100),
  lease_fit_score INTEGER NOT NULL CHECK (lease_fit_score BETWEEN 0 AND 100),
  verdict TEXT NOT NULL CHECK (verdict IN ('strong_fit', 'moderate_fit', 'weak_fit', 'poor_fit')),
  summary TEXT NOT NULL,
  reasoning JSONB,
  had_facility_data BOOLEAN DEFAULT false,
  had_reviews BOOLEAN DEFAULT false,
  had_opening_hours BOOLEAN DEFAULT false,
  activity_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_fit_assessments_lead_id ON fit_assessments(close_lead_id);
CREATE INDEX idx_fit_assessments_place_id ON fit_assessments(place_id);

ALTER TABLE fit_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated read" ON fit_assessments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert" ON fit_assessments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update" ON fit_assessments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated delete" ON fit_assessments FOR DELETE TO authenticated USING (true);
