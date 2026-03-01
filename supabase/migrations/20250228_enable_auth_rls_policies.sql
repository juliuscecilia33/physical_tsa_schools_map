-- Drop existing public RLS policies that allow unrestricted access
-- This migration updates the database to require authentication for all operations

-- ============================================================================
-- SPORTS_FACILITIES TABLE
-- ============================================================================

-- Drop old public policies
DROP POLICY IF EXISTS "Allow public read access" ON sports_facilities;
DROP POLICY IF EXISTS "Allow public insert access" ON sports_facilities;
DROP POLICY IF EXISTS "Allow public update access" ON sports_facilities;
DROP POLICY IF EXISTS "Allow public delete access" ON sports_facilities;

-- Create new authenticated-only policies
CREATE POLICY "Allow authenticated read access"
  ON sports_facilities
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated insert access"
  ON sports_facilities
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated update access"
  ON sports_facilities
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated delete access"
  ON sports_facilities
  FOR DELETE
  TO authenticated
  USING (true);

-- ============================================================================
-- FACILITY_NOTES TABLE
-- ============================================================================

-- Drop old public policies
DROP POLICY IF EXISTS "Allow public read access" ON facility_notes;
DROP POLICY IF EXISTS "Allow public insert access" ON facility_notes;
DROP POLICY IF EXISTS "Allow public update access" ON facility_notes;
DROP POLICY IF EXISTS "Allow public delete access" ON facility_notes;

-- Create new authenticated-only policies
CREATE POLICY "Allow authenticated read access"
  ON facility_notes
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated insert access"
  ON facility_notes
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated update access"
  ON facility_notes
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated delete access"
  ON facility_notes
  FOR DELETE
  TO authenticated
  USING (true);

-- ============================================================================
-- FACILITY_TAGS TABLE
-- ============================================================================

-- Drop old public policies
DROP POLICY IF EXISTS "Allow public read access" ON facility_tags;
DROP POLICY IF EXISTS "Allow public insert access" ON facility_tags;
DROP POLICY IF EXISTS "Allow public update access" ON facility_tags;
DROP POLICY IF EXISTS "Allow public delete access" ON facility_tags;

-- Create new authenticated-only policies
CREATE POLICY "Allow authenticated read access"
  ON facility_tags
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated insert access"
  ON facility_tags
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated update access"
  ON facility_tags
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated delete access"
  ON facility_tags
  FOR DELETE
  TO authenticated
  USING (true);

-- ============================================================================
-- FACILITY_TAG_ASSIGNMENTS TABLE
-- ============================================================================

-- Drop old public policies
DROP POLICY IF EXISTS "Allow public read access" ON facility_tag_assignments;
DROP POLICY IF EXISTS "Allow public insert access" ON facility_tag_assignments;
DROP POLICY IF EXISTS "Allow public update access" ON facility_tag_assignments;
DROP POLICY IF EXISTS "Allow public delete access" ON facility_tag_assignments;

-- Create new authenticated-only policies
CREATE POLICY "Allow authenticated read access"
  ON facility_tag_assignments
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated insert access"
  ON facility_tag_assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated update access"
  ON facility_tag_assignments
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated delete access"
  ON facility_tag_assignments
  FOR DELETE
  TO authenticated
  USING (true);

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- After running this migration, all tables will require authentication
-- for read, write, update, and delete operations.
-- Anonymous (public) access will be denied.
