"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Facility } from "@/types/facility";
import { useQuery } from "@tanstack/react-query";
import ProgressBar from "@/components/ProgressBar";

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

// Fetch all facilities
async function fetchAllFacilities(): Promise<Facility[]> {
  const response = await fetch('/api/facilities/all');

  if (!response.ok) {
    throw new Error(`Failed to fetch facilities: ${response.statusText}`);
  }

  const data = await response.json();
  return data.facilities as Facility[];
}

export default function Home() {
  const [filterOption, setFilterOption] = useState<FilterOption>('UNHIDDEN_ONLY');
  const [selectedSports, setSelectedSports] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);

  // Fetch all facilities with React Query
  const { data: facilities = [], isLoading, isError, error } = useQuery({
    queryKey: ['facilities', 'all'],
    queryFn: fetchAllFacilities,
    staleTime: Infinity, // Session-based caching
    gcTime: Infinity,
  });

  // Simulate progress while loading
  useEffect(() => {
    if (isLoading) {
      setProgress(0);
      const interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) {
            clearInterval(interval);
            return 90;
          }
          return prev + 2;
        });
      }, 50);
      return () => clearInterval(interval);
    } else {
      // When loading completes, jump to 100%
      setProgress(100);
    }
  }, [isLoading]);

  // Optimistic update for facility hidden status
  // This will be handled by cache invalidation later
  const updateFacilityHidden = (place_id: string, hidden: boolean) => {
    // For now, do nothing - cache will be updated via mutation
    console.log(`Facility ${place_id} hidden status changed to ${hidden}`);
  };

  // Show loading state with progress bar
  if (isLoading || progress < 100) {
    const totalCount = facilities.length > 0 ? facilities.length : null;
    const loadedCount = totalCount ? Math.floor(totalCount * (progress / 100)) : 0;

    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gray-100 z-[100]">
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
      <div className="fixed inset-0 flex items-center justify-center bg-gray-100 z-[100]">
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
    <main className="w-full h-screen">
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
