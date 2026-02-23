-- Complete cleanup and recreation of facility_notes table with correct RLS policies
-- Run this file to fix the 401 Unauthorized error

-- Step 1: Drop all existing policies (if they exist)
DROP POLICY IF EXISTS "Allow public read access to facility notes" ON facility_notes;
DROP POLICY IF EXISTS "Allow authenticated users to insert notes" ON facility_notes;
DROP POLICY IF EXISTS "Allow authenticated users to update notes" ON facility_notes;
DROP POLICY IF EXISTS "Allow authenticated users to delete notes" ON facility_notes;
DROP POLICY IF EXISTS "Allow public insert access to facility notes" ON facility_notes;
DROP POLICY IF EXISTS "Allow public update access to facility notes" ON facility_notes;
DROP POLICY IF EXISTS "Allow public delete access to facility notes" ON facility_notes;

-- Step 2: Create the correct RLS policies with public access
CREATE POLICY "Allow public read access to facility notes"
  ON facility_notes
  FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert access to facility notes"
  ON facility_notes
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update access to facility notes"
  ON facility_notes
  FOR UPDATE
  USING (true);

CREATE POLICY "Allow public delete access to facility notes"
  ON facility_notes
  FOR DELETE
  USING (true);

-- Step 3: Grant permissions to anon role
GRANT SELECT, INSERT, UPDATE, DELETE ON facility_notes TO anon, authenticated;

-- Verification query - run this to check policies are correct
-- SELECT * FROM pg_policies WHERE tablename = 'facility_notes';
