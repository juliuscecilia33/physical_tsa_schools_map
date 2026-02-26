"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { Facility } from "@/types/facility";
import { useQuery } from "@tanstack/react-query";
import ProgressBar from "@/components/ProgressBar";
import { useLoading } from "@/contexts/LoadingContext";

const FacilityMap = dynamic(() => import("@/components/FacilityMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading map...</p>
      </div>
    </div>
  ),
});

export type FilterOption = 'UNHIDDEN_ONLY' | 'ALL' | 'HIDDEN_ONLY' | 'WITH_NOTES_ONLY' | 'CLEANED_UP_ONLY';

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

export default function MapView({ isVisible }: { isVisible: boolean }) {
  const [filterOption, setFilterOption] = useState<FilterOption>('UNHIDDEN_ONLY');
  const [selectedSports, setSelectedSports] = useState<string[]>([]);
  // Pre-select SerpAPI tag for priority loading
  const [selectedTags, setSelectedTags] = useState<string[]>([SERPAPI_TAG_ID]);
  const [progress, setProgress] = useState(0);
  const [backgroundFacilities, setBackgroundFacilities] = useState<Facility[]>([]);
  const [isBackgroundLoading, setIsBackgroundLoading] = useState(false);
  const [backgroundLoadingComplete, setBackgroundLoadingComplete] = useState(false);
  const backgroundAbortController = useRef<AbortController | null>(null);
  const { setLoadingComplete } = useLoading();

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
    // Start even if priorityFacilities.length is 0 (edge case: no SerpAPI facilities exist)
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
  }, [isPriorityLoading, priorityFacilities.length, backgroundLoadingComplete]);

  // Merge priority and background facilities
  const facilities = [...priorityFacilities, ...backgroundFacilities];

  // Update progress based on two-phase loading
  useEffect(() => {
    if (isPriorityLoading) {
      // Phase 1: Priority loading (0-90%)
      setProgress(0);
      const interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 85) {
            clearInterval(interval);
            return 85;
          }
          return prev + 3;
        });
      }, 50);
      return () => clearInterval(interval);
    } else if (!backgroundLoadingComplete) {
      // Phase 1 complete, jump to 90%
      setProgress(90);
    } else {
      // Phase 2 complete, jump to 100%
      setProgress(100);
      setLoadingComplete();
    }
  }, [isPriorityLoading, backgroundLoadingComplete, setLoadingComplete]);

  // Optimistic update for facility hidden status
  // This will be handled by cache invalidation later
  const updateFacilityHidden = (place_id: string, hidden: boolean) => {
    // For now, do nothing - cache will be updated via mutation
    console.log(`Facility ${place_id} hidden status changed to ${hidden}`);
  };

  // Show loading state with progress bar (only for priority loading phase)
  if (isPriorityLoading || progress < 90) {
    const totalCount = priorityFacilities.length > 0 ? priorityFacilities.length : null;
    const loadedCount = totalCount ? Math.floor(totalCount * (progress / 100)) : 0;

    return (
      <div className={`fixed inset-0 flex items-center justify-center bg-gray-100 z-[100] ${!isVisible ? 'hidden' : ''}`}>
        <ProgressBar
          progress={progress}
          loadedCount={loadedCount}
          totalCount={totalCount}
        />
      </div>
    );
  }

  // Show error state if there's an error
  if (isError) {
    return (
      <div className={`fixed inset-0 flex items-center justify-center bg-gray-100 z-[100] ${!isVisible ? 'hidden' : ''}`}>
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">❌ Error loading facilities</div>
          <p className="text-gray-600">{error?.message || 'Unknown error'}</p>
          <p className="text-sm text-gray-500 mt-4">
            Make sure the database migration has been run and the API is accessible.
          </p>
        </div>
      </div>
    );
  }

  return (
    <main className={`w-full h-screen ${!isVisible ? 'hidden' : ''}`}>
      <FacilityMap
        facilities={facilities}
        filterOption={filterOption}
        onFilterOptionChange={setFilterOption}
        selectedSports={selectedSports}
        onSelectedSportsChange={setSelectedSports}
        selectedTags={selectedTags}
        onSelectedTagsChange={setSelectedTags}
        onUpdateFacility={updateFacilityHidden}
      />
    </main>
  );
}
