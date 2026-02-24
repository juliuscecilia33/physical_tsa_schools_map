-- Create facility_tags table for storing global tag definitions
CREATE TABLE IF NOT EXISTS facility_tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create facility_tag_assignments table for many-to-many relationship
CREATE TABLE IF NOT EXISTS facility_tag_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  place_id TEXT NOT NULL REFERENCES sports_facilities(place_id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES facility_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(place_id, tag_id)
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_facility_tags_name ON facility_tags(name);
CREATE INDEX IF NOT EXISTS idx_facility_tag_assignments_place_id ON facility_tag_assignments(place_id);
CREATE INDEX IF NOT EXISTS idx_facility_tag_assignments_tag_id ON facility_tag_assignments(tag_id);

-- Enable Row Level Security
ALTER TABLE facility_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE facility_tag_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for facility_tags
CREATE POLICY "Allow public read access to facility tags"
  ON facility_tags
  FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert access to facility tags"
  ON facility_tags
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update access to facility tags"
  ON facility_tags
  FOR UPDATE
  USING (true);

CREATE POLICY "Allow public delete access to facility tags"
  ON facility_tags
  FOR DELETE
  USING (true);

-- RLS Policies for facility_tag_assignments
CREATE POLICY "Allow public read access to facility tag assignments"
  ON facility_tag_assignments
  FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert access to facility tag assignments"
  ON facility_tag_assignments
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update access to facility tag assignments"
  ON facility_tag_assignments
  FOR UPDATE
  USING (true);

CREATE POLICY "Allow public delete access to facility tag assignments"
  ON facility_tag_assignments
  FOR DELETE
  USING (true);

-- Function to automatically update updated_at timestamp for facility_tags
CREATE OR REPLACE FUNCTION update_facility_tags_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to call the update function
CREATE TRIGGER trigger_update_facility_tags_updated_at
  BEFORE UPDATE ON facility_tags
  FOR EACH ROW
  EXECUTE FUNCTION update_facility_tags_updated_at();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON facility_tags TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON facility_tag_assignments TO anon, authenticated;
