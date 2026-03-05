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

/**
 * Atomically move a facility from one cache segment to another.
 * Adds to destination before removing from source to avoid a gap where the
 * facility exists in neither segment.
 */
export function moveFacilityToSegment(
  queryClient: QueryClient,
  placeId: string,
  from: 'serpapi' | 'background',
  to: 'serpapi' | 'background',
  updates?: Partial<FacilityLightweight>
) {
  const queryCache = queryClient.getQueryCache();

  // 1. Get facility from source segment
  const fromQuery = queryCache.find({ queryKey: ['facilities', from] });
  const fromData = fromQuery?.state.data as FacilityLightweight[] | undefined;
  const facility = fromData?.find((f) => f.place_id === placeId);

  // 2. Add to destination segment
  const toQuery = queryCache.find({ queryKey: ['facilities', to] });
  const toData = toQuery?.state.data as FacilityLightweight[] | undefined;

  if (toQuery && toData && facility) {
    const updatedFacility = updates ? { ...facility, ...updates } : facility;
    const filtered = toData.filter((f) => f.place_id !== placeId);
    queryClient.setQueryData(
      ['facilities', to],
      [...filtered, updatedFacility],
      { updatedAt: toQuery.state.dataUpdatedAt }
    );
  }

  // 3. Remove from source segment
  if (fromQuery && fromData) {
    queryClient.setQueryData(
      ['facilities', from],
      fromData.filter((f) => f.place_id !== placeId),
      { updatedAt: fromQuery.state.dataUpdatedAt }
    );
  }
}

/**
 * Remove a facility from a specific cache segment
 * Used when a facility moves between segments (e.g., after SerpAPI enrichment)
 */
export function removeFacilityFromSegment(
  queryClient: QueryClient,
  placeId: string,
  segment: 'serpapi' | 'background'
) {
  const queryCache = queryClient.getQueryCache();
  const query = queryCache.find({ queryKey: ['facilities', segment] });
  const currentData = query?.state.data as FacilityLightweight[] | undefined;

  if (currentData && query) {
    queryClient.setQueryData(
      ['facilities', segment],
      currentData.filter((f) => f.place_id !== placeId),
      { updatedAt: query.state.dataUpdatedAt }
    );
  }
}

