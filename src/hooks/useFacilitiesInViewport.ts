import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FacilityLightweight, MapBounds } from "@/types/facility";
import { useCallback, useEffect, useRef } from "react";

interface UseFacilitiesInViewportOptions {
  bounds: MapBounds | null;
  enabled?: boolean;
  includeHidden?: boolean;
  includeCleanedUp?: boolean;
}

interface FacilitiesResponse {
  facilities: FacilityLightweight[];
  bounds: MapBounds;
}

// Helper to create a stable cache key from bounds
function getBoundsKey(bounds: MapBounds): string {
  // Round to 4 decimal places (~11m precision) to group nearby viewport queries
  return `${bounds.minLat.toFixed(4)}_${bounds.maxLat.toFixed(4)}_${bounds.minLng.toFixed(4)}_${bounds.maxLng.toFixed(4)}_${bounds.zoom}`;
}

// Fetch facilities for a given viewport
async function fetchFacilitiesInViewport(
  bounds: MapBounds,
  includeHidden: boolean = false,
  includeCleanedUp: boolean = false
): Promise<FacilityLightweight[]> {
  const params = new URLSearchParams({
    minLat: bounds.minLat.toString(),
    maxLat: bounds.maxLat.toString(),
    minLng: bounds.minLng.toString(),
    maxLng: bounds.maxLng.toString(),
    zoom: bounds.zoom.toString(),
    includeHidden: includeHidden.toString(),
    includeCleanedUp: includeCleanedUp.toString(),
  });

  const response = await fetch(`/api/facilities/viewport?${params}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch facilities: ${response.statusText}`);
  }

  const data = await response.json();
  return data.facilities;
}

export function useFacilitiesInViewport({
  bounds,
  enabled = true,
  includeHidden = false,
  includeCleanedUp = false,
}: UseFacilitiesInViewportOptions) {
  const queryClient = useQueryClient();
  const previousBoundsRef = useRef<MapBounds | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced bounds for actual fetching
  const [debouncedBounds, setDebouncedBounds] =
    React.useState<MapBounds | null>(bounds);

  // Debounce bounds changes to prevent excessive requests during map pan
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      setDebouncedBounds(bounds);
    }, 300);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [bounds]);

  // Prefetch adjacent viewport areas for smooth panning
  const prefetchAdjacentAreas = useCallback(
    (currentBounds: MapBounds) => {
      const latDiff = currentBounds.maxLat - currentBounds.minLat;
      const lngDiff = currentBounds.maxLng - currentBounds.minLng;

      // Define adjacent areas (north, south, east, west)
      const adjacentAreas = [
        // North
        {
          minLat: currentBounds.maxLat,
          maxLat: currentBounds.maxLat + latDiff,
          minLng: currentBounds.minLng,
          maxLng: currentBounds.maxLng,
          zoom: currentBounds.zoom,
        },
        // South
        {
          minLat: currentBounds.minLat - latDiff,
          maxLat: currentBounds.minLat,
          minLng: currentBounds.minLng,
          maxLng: currentBounds.maxLng,
          zoom: currentBounds.zoom,
        },
        // East
        {
          minLat: currentBounds.minLat,
          maxLat: currentBounds.maxLat,
          minLng: currentBounds.maxLng,
          maxLng: currentBounds.maxLng + lngDiff,
          zoom: currentBounds.zoom,
        },
        // West
        {
          minLat: currentBounds.minLat,
          maxLat: currentBounds.maxLat,
          minLng: currentBounds.minLng - lngDiff,
          maxLng: currentBounds.minLng,
          zoom: currentBounds.zoom,
        },
      ];

      // Prefetch each adjacent area
      adjacentAreas.forEach((area) => {
        queryClient.prefetchQuery({
          queryKey: ["facilities", "viewport", getBoundsKey(area), includeHidden, includeCleanedUp],
          queryFn: () => fetchFacilitiesInViewport(area, includeHidden, includeCleanedUp),
        });
      });
    },
    [queryClient, includeHidden, includeCleanedUp]
  );

  // Main query for current viewport
  const query = useQuery({
    queryKey: debouncedBounds
      ? ["facilities", "viewport", getBoundsKey(debouncedBounds), includeHidden, includeCleanedUp]
      : ["facilities", "viewport", "null"],
    queryFn: () => {
      if (!debouncedBounds) {
        throw new Error("Bounds not available");
      }
      return fetchFacilitiesInViewport(debouncedBounds, includeHidden, includeCleanedUp);
    },
    enabled: enabled && debouncedBounds !== null,
    staleTime: Infinity, // Session-based caching
    gcTime: Infinity,
  });

  // Prefetch adjacent areas when bounds stabilize
  useEffect(() => {
    if (debouncedBounds && query.isSuccess) {
      // Only prefetch if bounds have actually changed (not initial load)
      if (previousBoundsRef.current) {
        prefetchAdjacentAreas(debouncedBounds);
      }
      previousBoundsRef.current = debouncedBounds;
    }
  }, [debouncedBounds, query.isSuccess, prefetchAdjacentAreas]);

  return {
    facilities: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    isFetching: query.isFetching,
  };
}

// Add missing React import
import React from "react";
