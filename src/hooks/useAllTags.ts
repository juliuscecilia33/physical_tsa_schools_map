import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { FacilityTag } from '@/types/facility';

/**
 * Fetches all tags from the facility_tags table
 * Returns all tags regardless of whether they're assigned to any facilities
 */
async function fetchAllTags(): Promise<FacilityTag[]> {
  const { data, error } = await supabase
    .from('facility_tags')
    .select('id, name, color, description, created_at, updated_at')
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching all tags:', error);
    throw error;
  }

  return data || [];
}

/**
 * React Query hook to fetch all available tags
 * Used for displaying all tags in filter dropdowns and tag management UI
 */
export function useAllTags() {
  return useQuery<FacilityTag[], Error>({
    queryKey: ['facility_tags', 'all'],
    queryFn: fetchAllTags,
    staleTime: 5 * 60 * 1000, // 5 minutes - tags don't change frequently
    gcTime: 10 * 60 * 1000, // 10 minutes garbage collection
  });
}
