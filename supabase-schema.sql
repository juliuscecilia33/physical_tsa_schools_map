-- Enable PostGIS extension for geographic queries
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create sports_facilities table
CREATE TABLE IF NOT EXISTS sports_facilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  sport_types TEXT[] DEFAULT '{}',
  address TEXT,
  location GEOGRAPHY(POINT, 4326),
  phone TEXT,
  website TEXT,
  rating NUMERIC(3,2),
  user_ratings_total INTEGER,
  reviews JSONB DEFAULT '[]',
  photo_references TEXT[] DEFAULT '{}',
  opening_hours JSONB,
  business_status TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_sports_facilities_location
  ON sports_facilities USING GIST (location);

CREATE INDEX IF NOT EXISTS idx_sports_facilities_sport_types
  ON sports_facilities USING GIN (sport_types);

CREATE INDEX IF NOT EXISTS idx_sports_facilities_place_id
  ON sports_facilities (place_id);

CREATE INDEX IF NOT EXISTS idx_sports_facilities_rating
  ON sports_facilities (rating);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_sports_facilities_updated_at
  BEFORE UPDATE ON sports_facilities
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE sports_facilities ENABLE ROW LEVEL SECURITY;

-- Create policy to allow public read access
CREATE POLICY "Allow public read access"
  ON sports_facilities
  FOR SELECT
  TO public
  USING (true);

-- Create policy to allow authenticated insert/update (for migration scripts)
CREATE POLICY "Allow authenticated insert"
  ON sports_facilities
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated update"
  ON sports_facilities
  FOR UPDATE
  TO authenticated
  USING (true);
