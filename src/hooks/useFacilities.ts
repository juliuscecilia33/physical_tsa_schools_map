"use client";

import { useEffect, useMemo, useReducer } from "react";
import { useQuery } from "@tanstack/react-query";
import { Facility } from "@/types/facility";

// SerpAPI tag ID for priority loading
const SERPAPI_TAG_ID = 'e326fe36-5536-4209-87ed-f99528e1d1ee';

// Module-level progress state (shared across all component instances)
let priorityProgressState = 0;
let backgroundProgressState = 0;

// Fetch facilities by tag IDs (non-paginated - for backward compatibility)
async function fetchFacilitiesByTags(tagIds: string[]): Promise<Facility[]> {
  const response = await fetch(`/api/facilities/by-tag?tagIds=${tagIds.join(',')}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch facilities by tags: ${response.statusText}`);
  }

  const data = await response.json();
  return data.facilities as Facility[];
}

// Fetch facilities by tag IDs (paginated)
async function fetchFacilitiesByTagsPaginated(
  tagIds: string[],
  offset: number,
  limit: number,
  signal?: AbortSignal
): Promise<{ facilities: Facility[]; hasMore: boolean }> {
  // Create timeout controller (60 seconds per batch)
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), 60000);

  // Combine external signal with timeout signal
  const combinedSignal = signal || timeoutController.signal;

  try {
    const response = await fetch(
      `/api/facilities/by-tag?tagIds=${tagIds.join(',')}&offset=${offset}&limit=${limit}`,
      { signal: combinedSignal }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Failed to fetch facilities by tags: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      facilities: data.facilities as Facility[],
      hasMore: data.hasMore || false,
    };
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timeout after 60 seconds');
    }
    throw error;
  }
}

// Fetch facilities excluding specific tag IDs (paginated)
async function fetchFacilitiesExcludingTags(
  excludeTagIds: string[],
  offset: number,
  limit: number,
  signal?: AbortSignal
): Promise<{ facilities: Facility[]; hasMore: boolean }> {
  // Create timeout controller (60 seconds per batch)
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), 60000);

  // Combine external signal with timeout signal
  const combinedSignal = signal || timeoutController.signal;

  try {
    const response = await fetch(
      `/api/facilities/excluding-tags?excludeTagIds=${excludeTagIds.join(',')}&offset=${offset}&limit=${limit}`,
      { signal: combinedSignal }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Failed to fetch facilities excluding tags: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      facilities: data.facilities as Facility[],
      hasMore: data.hasMore || false,
    };
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timeout after 60 seconds');
    }
    throw error;
  }
}

// Fetch all priority facilities in batches (used by React Query)
async function fetchAllPriorityFacilities(
  tagIds: string[],
  signal?: AbortSignal
): Promise<Facility[]> {
  const batchSize = 500;
  let offset = 0;
  let allFacilities: Facility[] = [];

  while (true) {
    if (signal?.aborted) {
      throw new Error('Priority loading aborted');
    }

    // Retry logic with exponential backoff
    let retries = 0;
    const maxRetries = 3;
    let batchResult: { facilities: Facility[]; hasMore: boolean } | null = null;

    while (retries < maxRetries) {
      try {
        batchResult = await fetchFacilitiesByTagsPaginated(
          tagIds,
          offset,
          batchSize,
          signal
        );
        break; // Success, exit retry loop
      } catch (error: any) {
        retries++;
        if (retries >= maxRetries) {
          console.error(`Failed to fetch priority batch at offset ${offset} after ${maxRetries} retries:`, error);
          throw error; // Give up after max retries
        }
        // Exponential backoff: 1s, 2s, 4s
        const backoffMs = Math.pow(2, retries) * 1000;
        console.warn(`Priority batch fetch failed at offset ${offset}, retry ${retries}/${maxRetries} in ${backoffMs}ms:`, error.message);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }

    if (!batchResult) {
      throw new Error('Failed to fetch priority batch after retries');
    }

    const { facilities, hasMore } = batchResult;

    allFacilities = [...allFacilities, ...facilities];

    // Update module-level progress state
    priorityProgressState = allFacilities.length;

    console.log(
      `Priority batch loaded: ${facilities.length} facilities (offset: ${offset})`
    );

    if (!hasMore) {
      console.log(
        `Priority loading complete. Total: ${allFacilities.length} facilities`
      );
      break;
    }

    offset += batchSize;
    // Add small delay between batches to not overwhelm the server
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return allFacilities;
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

    // Retry logic with exponential backoff
    let retries = 0;
    const maxRetries = 3;
    let batchResult: { facilities: Facility[]; hasMore: boolean } | null = null;

    while (retries < maxRetries) {
      try {
        batchResult = await fetchFacilitiesExcludingTags(
          excludeTagIds,
          offset,
          batchSize,
          signal
        );
        break; // Success, exit retry loop
      } catch (error: any) {
        retries++;
        if (retries >= maxRetries) {
          console.error(`Failed to fetch batch at offset ${offset} after ${maxRetries} retries:`, error);
          throw error; // Give up after max retries
        }
        // Exponential backoff: 1s, 2s, 4s
        const backoffMs = Math.pow(2, retries) * 1000;
        console.warn(`Batch fetch failed at offset ${offset}, retry ${retries}/${maxRetries} in ${backoffMs}ms:`, error.message);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }

    if (!batchResult) {
      throw new Error('Failed to fetch batch after retries');
    }

    const { facilities, hasMore } = batchResult;

    allFacilities = [...allFacilities, ...facilities];

    // Update module-level progress state
    backgroundProgressState = allFacilities.length;

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
  priorityLoadingProgress: number;
  backgroundLoadingProgress: number;
  isError: boolean;
  error: Error | null;
}

/**
 * Custom hook for fetching facilities with two-phase loading:
 * Phase 1: Priority loading (SerpAPI tag)
 * Phase 2: Background batch loading (excluding SerpAPI tag)
 */
export function useFacilities(): UseFacilitiesReturn {
  // Force re-render when module-level state changes
  const [, forceUpdate] = useReducer((x) => x + 1, 0);

  // Phase 1: Fetch SerpAPI-tagged facilities in batches (priority load)
  const {
    data: priorityFacilities = [],
    isLoading: isPriorityLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['facilities', 'serpapi'],
    queryFn: ({ signal }) => fetchAllPriorityFacilities([SERPAPI_TAG_ID], signal),
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

  // Poll module-level state to sync with component during loading
  useEffect(() => {
    if (isPriorityLoading || isBackgroundLoading) {
      const interval = setInterval(() => {
        forceUpdate(); // Trigger re-render to pick up latest module state
      }, 500); // Check every 500ms
      return () => clearInterval(interval);
    }
  }, [isPriorityLoading, isBackgroundLoading]);

  // Reset module state when priority loading starts
  useEffect(() => {
    if (isPriorityLoading) {
      priorityProgressState = 0;
    }
  }, [isPriorityLoading]);

  // Reset module state when background loading starts
  useEffect(() => {
    if (isBackgroundLoading) {
      backgroundProgressState = 0;
    }
  }, [isBackgroundLoading]);

  // Read progress from module-level state
  const priorityLoadingProgress = priorityProgressState;
  const backgroundLoadingProgress = backgroundProgressState;

  // Merge priority and background facilities (memoized to avoid new array on every render)
  const facilities = useMemo(
    () => [...priorityFacilities, ...backgroundFacilities],
    [priorityFacilities, backgroundFacilities]
  );

  // Derive backgroundLoadingComplete from query success state
  const backgroundLoadingComplete = isBackgroundLoadingSuccess;

  return {
    facilities,
    priorityFacilities,
    backgroundFacilities,
    isPriorityLoading,
    isBackgroundLoading,
    backgroundLoadingComplete,
    priorityLoadingProgress,
    backgroundLoadingProgress,
    isError,
    error,
  };
}
