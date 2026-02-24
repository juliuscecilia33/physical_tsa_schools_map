import { QueryClient } from "@tanstack/react-query";
import { FacilityLightweight } from "@/types/facility";

/**
 * Utility functions for updating facility data in React Query cache
 * These functions allow updating specific facilities without refetching all data
 */

/**
 * Update a single facility in the main facilities cache
 */
export function updateFacilityInCache(
  queryClient: QueryClient,
  placeId: string,
  updates: Partial<FacilityLightweight>
) {
  // Get the main "all facilities" query
  const currentData = queryClient.getQueryData(['facilities', 'all']) as FacilityLightweight[] | undefined;

  if (currentData) {
    const updatedData = currentData.map((facility) =>
      facility.place_id === placeId
        ? { ...facility, ...updates }
        : facility
    );

    queryClient.setQueryData(['facilities', 'all'], updatedData);
  }
}


/**
 * Update facility's hidden status in cache
 */
export function updateFacilityHiddenStatus(
  queryClient: QueryClient,
  placeId: string,
  hidden: boolean
) {
  updateFacilityInCache(queryClient, placeId, { hidden });
}

/**
 * Update facility's cleaned_up status in cache
 */
export function updateFacilityCleanedUpStatus(
  queryClient: QueryClient,
  placeId: string,
  cleanedUp: boolean
) {
  updateFacilityInCache(queryClient, placeId, { cleaned_up: cleanedUp });
}

/**
 * Update facility's has_notes flag in cache
 */
export function updateFacilityNotesFlag(
  queryClient: QueryClient,
  placeId: string,
  hasNotes: boolean
) {
  updateFacilityInCache(queryClient, placeId, { has_notes: hasNotes });
}

/**
 * Update facility's tags in cache
 */
export function updateFacilityTags(
  queryClient: QueryClient,
  placeId: string,
  tags: Array<{ id: string; name: string; color: string; description?: string }>
) {
  updateFacilityInCache(queryClient, placeId, { tags });
}

