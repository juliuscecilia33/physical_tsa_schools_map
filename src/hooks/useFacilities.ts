"use client";

import { useState, useEffect, useRef } from "react";
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
  const [backgroundFacilities, setBackgroundFacilities] = useState<Facility[]>([]);
  const [isBackgroundLoading, setIsBackgroundLoading] = useState(false);
  const [backgroundLoadingComplete, setBackgroundLoadingComplete] = useState(false);
  const backgroundAbortController = useRef<AbortController | null>(null);

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
  useEffect(() => {
    // Only start background loading after priority facilities are loaded
    if (!isPriorityLoading && !backgroundLoadingComplete) {
      setIsBackgroundLoading(true);
      backgroundAbortController.current = new AbortController();

      const batchSize = 1000;
      let offset = 0;
      let allBackgroundFacilities: Facility[] = [];

      const fetchNextBatch = async () => {
        try {
          if (backgroundAbortController.current?.signal.aborted) {
            return;
          }

          const { facilities, hasMore } = await fetchFacilitiesExcludingTags(
            [SERPAPI_TAG_ID],
            offset,
            batchSize
          );

          allBackgroundFacilities = [...allBackgroundFacilities, ...facilities];
          setBackgroundFacilities(allBackgroundFacilities);

          console.log(
            `Background batch loaded: ${facilities.length} facilities (offset: ${offset})`
          );

          if (hasMore && !backgroundAbortController.current?.signal.aborted) {
            offset += batchSize;
            // Add small delay between batches to not overwhelm the server
            setTimeout(fetchNextBatch, 100);
          } else {
            setIsBackgroundLoading(false);
            setBackgroundLoadingComplete(true);
            console.log(
              `Background loading complete. Total: ${allBackgroundFacilities.length} facilities`
            );
          }
        } catch (error) {
          console.error('Background loading error:', error);
          setIsBackgroundLoading(false);
          // Don't set backgroundLoadingComplete, so user still has priority facilities
        }
      };

      fetchNextBatch();

      // Cleanup on unmount
      return () => {
        backgroundAbortController.current?.abort();
      };
    }
  }, [isPriorityLoading, backgroundLoadingComplete]);

  // Merge priority and background facilities
  const facilities = [...priorityFacilities, ...backgroundFacilities];

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
