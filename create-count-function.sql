-- Create a function to get the total count of facilities
-- This will be used for progress bar calculation

CREATE OR REPLACE FUNCTION get_facilities_count()
RETURNS bigint
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(*)
  FROM sports_facilities
  WHERE location IS NOT NULL;
$$;
