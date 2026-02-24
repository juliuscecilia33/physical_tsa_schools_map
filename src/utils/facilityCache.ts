import { QueryClient } from "@tanstack/react-query";
import { FacilityLightweight, MapBounds } from "@/types/facility";

/**
 * Utility functions for updating facility data in React Query cache
 * These functions allow updating specific facilities without refetching all data
 */

/**
 * Update a single facility in all relevant viewport caches
 */
export function updateFacilityInCache(
  queryClient: QueryClient,
  placeId: string,
  updates: Partial<FacilityLightweight>
) {
  // Get all queries that match the viewport pattern
  const queries = queryClient.getQueryCache().findAll({
    predicate: (query) => {
      const queryKey = query.queryKey;
      return (
        Array.isArray(queryKey) &&
        queryKey[0] === "facilities" &&
        queryKey[1] === "viewport"
      );
    },
  });

  // Update each matching query
  queries.forEach((query) => {
    const currentData = query.state.data as FacilityLightweight[] | undefined;
    if (currentData) {
      const updatedData = currentData.map((facility) =>
        facility.place_id === placeId
          ? { ...facility, ...updates }
          : facility
      );

      queryClient.setQueryData(query.queryKey, updatedData);
    }
  });
}

/**
 * Add a facility to all viewport caches that contain its location
 */
export function addFacilityToCache(
  queryClient: QueryClient,
  facility: FacilityLightweight
) {
  const queries = queryClient.getQueryCache().findAll({
    predicate: (query) => {
      const queryKey = query.queryKey;
      if (
        !Array.isArray(queryKey) ||
        queryKey[0] !== "facilities" ||
        queryKey[1] !== "viewport"
      ) {
        return false;
      }

      // Extract bounds from query key (format: facilities_viewport_{boundsKey})
      const boundsKey = queryKey[2] as string;
      if (!boundsKey || boundsKey === "null") return false;

      // Parse bounds from key (format: minLat_maxLat_minLng_maxLng_zoom)
      const parts = boundsKey.split("_");
      if (parts.length !== 5) return false;

      const [minLat, maxLat, minLng, maxLng] = parts.map(Number);

      // Check if facility location is within these bounds
      return (
        facility.location.lat >= minLat &&
        facility.location.lat <= maxLat &&
        facility.location.lng >= minLng &&
        facility.location.lng <= maxLng
      );
    },
  });

  queries.forEach((query) => {
    const currentData = query.state.data as FacilityLightweight[] | undefined;
    if (currentData) {
      // Check if facility already exists
      const exists = currentData.some(
        (f) => f.place_id === facility.place_id
      );
      if (!exists) {
        queryClient.setQueryData(query.queryKey, [...currentData, facility]);
      }
    }
  });
}

/**
 * Remove a facility from all viewport caches
 */
export function removeFacilityFromCache(
  queryClient: QueryClient,
  placeId: string
) {
  const queries = queryClient.getQueryCache().findAll({
    predicate: (query) => {
      const queryKey = query.queryKey;
      return (
        Array.isArray(queryKey) &&
        queryKey[0] === "facilities" &&
        queryKey[1] === "viewport"
      );
    },
  });

  queries.forEach((query) => {
    const currentData = query.state.data as FacilityLightweight[] | undefined;
    if (currentData) {
      const updatedData = currentData.filter(
        (facility) => facility.place_id !== placeId
      );
      queryClient.setQueryData(query.queryKey, updatedData);
    }
  });
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

/**
 * Invalidate all viewport queries (force refetch)
 * Use sparingly - prefer updating cache directly
 */
export function invalidateAllViewportQueries(queryClient: QueryClient) {
  queryClient.invalidateQueries({
    predicate: (query) => {
      const queryKey = query.queryKey;
      return (
        Array.isArray(queryKey) &&
        queryKey[0] === "facilities" &&
        queryKey[1] === "viewport"
      );
    },
  });
}

/**
 * Invalidate specific facility in all viewport queries
 * This will cause a background refetch of affected queries
 */
export function invalidateFacilityInCache(
  queryClient: QueryClient,
  placeId: string
) {
  // Find all queries that contain this facility
  const queries = queryClient.getQueryCache().findAll({
    predicate: (query) => {
      const queryKey = query.queryKey;
      if (
        !Array.isArray(queryKey) ||
        queryKey[0] !== "facilities" ||
        queryKey[1] !== "viewport"
      ) {
        return false;
      }

      const data = query.state.data as FacilityLightweight[] | undefined;
      return data?.some((f) => f.place_id === placeId) || false;
    },
  });

  // Invalidate each matching query
  queries.forEach((query) => {
    queryClient.invalidateQueries({ queryKey: query.queryKey });
  });
}
