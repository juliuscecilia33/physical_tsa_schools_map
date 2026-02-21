-- Create facility_notes table for storing multiple notes per facility
CREATE TABLE IF NOT EXISTS facility_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  place_id TEXT NOT NULL REFERENCES sports_facilities(place_id) ON DELETE CASCADE,
  note_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create index on place_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_facility_notes_place_id ON facility_notes(place_id);

-- Create index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_facility_notes_created_at ON facility_notes(created_at DESC);

-- Enable Row Level Security
ALTER TABLE facility_notes ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow public read access to all notes
CREATE POLICY "Allow public read access to facility notes"
  ON facility_notes
  FOR SELECT
  USING (true);

-- RLS Policy: Allow public insert access to notes
CREATE POLICY "Allow public insert access to facility notes"
  ON facility_notes
  FOR INSERT
  WITH CHECK (true);

-- RLS Policy: Allow public update access to notes
CREATE POLICY "Allow public update access to facility notes"
  ON facility_notes
  FOR UPDATE
  USING (true);

-- RLS Policy: Allow public delete access to notes
CREATE POLICY "Allow public delete access to facility notes"
  ON facility_notes
  FOR DELETE
  USING (true);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_facility_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to call the update function
CREATE TRIGGER trigger_update_facility_notes_updated_at
  BEFORE UPDATE ON facility_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_facility_notes_updated_at();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON facility_notes TO anon, authenticated;
