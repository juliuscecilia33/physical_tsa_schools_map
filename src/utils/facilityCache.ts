import { QueryClient } from "@tanstack/react-query";
import { FacilityLightweight } from "@/types/facility";

/**
 * Utility functions for updating facility data in React Query cache
 * These functions allow updating specific facilities without refetching all data
 */

/**
 * Update a single facility in the main facilities cache
 * Preserves the original dataUpdatedAt timestamp to maintain cache consistency
 */
export function updateFacilityInCache(
  queryClient: QueryClient,
  placeId: string,
  updates: Partial<FacilityLightweight>
) {
  const queryCache = queryClient.getQueryCache();
  const segments = ['serpapi', 'background'] as const;

  for (const segment of segments) {
    const query = queryCache.find({ queryKey: ['facilities', segment] });
    const currentData = query?.state.data as FacilityLightweight[] | undefined;

    if (currentData && query) {
      const updatedData = currentData.map((facility) =>
        facility.place_id === placeId
          ? { ...facility, ...updates }
          : facility
      );

      // Preserve the original dataUpdatedAt timestamp to prevent cache invalidation
      queryClient.setQueryData(['facilities', segment], updatedData, {
        updatedAt: query.state.dataUpdatedAt
      });
    }
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
  tags: Array<{ id: string; name: string; color: string; description: string | null }>
) {
  updateFacilityInCache(queryClient, placeId, { tags });
}

