"use client";

import { useQuery } from "@tanstack/react-query";
import { Facility } from "@/types/facility";

// SerpAPI tag ID for priority loading
const SERPAPI_TAG_ID = 'e326fe36-5536-4209-87ed-f99528e1d1ee';

// Fetch facilities by tag IDs
async function fetchFacilitiesByTags(tagIds: string[]): Promise<Facility[]> {
  const response = await fetch(`/api/facilities/by-tag?tagIds=${tagIds.join(',')}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch facilities by tags: ${response.statusText}`);
  }

  const data = await response.json();
  return data.facilities as Facility[];
}

// Fetch facilities excluding specific tag IDs (paginated)
async function fetchFacilitiesExcludingTags(
  excludeTagIds: string[],
  offset: number,
  limit: number
): Promise<{ facilities: Facility[]; hasMore: boolean }> {
  const response = await fetch(
    `/api/facilities/excluding-tags?excludeTagIds=${excludeTagIds.join(',')}&offset=${offset}&limit=${limit}`
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch facilities excluding tags: ${response.statusText}`);
  }

  const data = await response.json();
  return {
    facilities: data.facilities as Facility[],
    hasMore: data.hasMore || false,
  };
}

// Fetch all background facilities in batches (used by React Query)
async function fetchAllBackgroundFacilities(
  excludeTagIds: string[],
  signal?: AbortSignal
): Promise<Facility[]> {
  const batchSize = 1000;
  let offset = 0;
  let allFacilities: Facility[] = [];

  while (true) {
    if (signal?.aborted) {
      throw new Error('Background loading aborted');
    }

    const { facilities, hasMore } = await fetchFacilitiesExcludingTags(
      excludeTagIds,
      offset,
      batchSize
    );

    allFacilities = [...allFacilities, ...facilities];

    console.log(
      `Background batch loaded: ${facilities.length} facilities (offset: ${offset})`
    );

    if (!hasMore) {
      console.log(
        `Background loading complete. Total: ${allFacilities.length} facilities`
      );
      break;
    }

    offset += batchSize;
    // Add small delay between batches to not overwhelm the server
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return allFacilities;
}

export interface UseFacilitiesReturn {
  facilities: Facility[];
  priorityFacilities: Facility[];
  backgroundFacilities: Facility[];
  isPriorityLoading: boolean;
  isBackgroundLoading: boolean;
  backgroundLoadingComplete: boolean;
  isError: boolean;
  error: Error | null;
}

/**
 * Custom hook for fetching facilities with two-phase loading:
 * Phase 1: Priority loading (SerpAPI tag)
 * Phase 2: Background batch loading (excluding SerpAPI tag)
 */
export function useFacilities(): UseFacilitiesReturn {
  // Phase 1: Fetch SerpAPI-tagged facilities immediately (priority load)
  const {
    data: priorityFacilities = [],
    isLoading: isPriorityLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['facilities', 'serpapi'],
    queryFn: () => fetchFacilitiesByTags([SERPAPI_TAG_ID]),
    staleTime: Infinity,
    gcTime: Infinity,
  });

  // Phase 2: Background batch loading of remaining facilities (excluding SerpAPI tag)
  // React Query will automatically dedupe this across multiple component instances
  const {
    data: backgroundFacilities = [],
    isLoading: isBackgroundLoading,
    isSuccess: isBackgroundLoadingSuccess,
  } = useQuery({
    queryKey: ['facilities', 'background'],
    queryFn: ({ signal }) => fetchAllBackgroundFacilities([SERPAPI_TAG_ID], signal),
    enabled: !isPriorityLoading, // Only start after priority load completes
    staleTime: Infinity,
    gcTime: Infinity,
  });

  // Merge priority and background facilities
  const facilities = [...priorityFacilities, ...backgroundFacilities];

  // Derive backgroundLoadingComplete from query success state
  const backgroundLoadingComplete = isBackgroundLoadingSuccess;

  return {
    facilities,
    priorityFacilities,
    backgroundFacilities,
    isPriorityLoading,
    isBackgroundLoading,
    backgroundLoadingComplete,
    isError,
    error,
  };
}
