-- Drop existing policies
DROP POLICY IF EXISTS "Allow authenticated insert" ON sports_facilities;
DROP POLICY IF EXISTS "Allow authenticated update" ON sports_facilities;

-- Create new policies that allow anon (public) inserts for migration
CREATE POLICY "Allow anon insert for migration"
  ON sports_facilities
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anon update for migration"
  ON sports_facilities
  FOR UPDATE
  TO anon
  USING (true);
