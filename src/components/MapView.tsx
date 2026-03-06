"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { Facility } from "@/types/facility";
import ProgressBar from "@/components/ProgressBar";
import { useLoading } from "@/contexts/LoadingContext";
import { useFacilities } from "@/hooks/useFacilities";

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

// SerpAPI tag ID for default tag filter selection
const SERPAPI_TAG_ID = 'e326fe36-5536-4209-87ed-f99528e1d1ee';

export default function MapView({ isVisible }: { isVisible: boolean }) {
  const searchParams = useSearchParams();
  const focusPlaceId = searchParams.get('focus');

  const [filterOption, setFilterOption] = useState<FilterOption>('UNHIDDEN_ONLY');
  const [selectedSports, setSelectedSports] = useState<string[]>([]);
  // Pre-select SerpAPI tag by default
  const [selectedTags, setSelectedTags] = useState<string[]>([SERPAPI_TAG_ID]);
  const [progress, setProgress] = useState(0);
  const { setLoadingComplete, setPriorityLoadComplete } = useLoading();

  // Use shared facilities hook (two-phase loading)
  const {
    facilities,
    priorityFacilities,
    isPriorityLoading,
    backgroundLoadingComplete,
    priorityLoadingProgress,
    isError,
    error,
  } = useFacilities();

  // Update progress based on two-phase loading with batched priority
  useEffect(() => {
    if (isPriorityLoading) {
      // Phase 1: Priority loading with batching (0-90%)
      // Show incremental progress based on actual loaded facilities
      const estimatedTotal = 2200; // Approximate total priority facilities
      const progressPercent = Math.min(85, (priorityLoadingProgress / estimatedTotal) * 85);
      setProgress(progressPercent);
    } else if (!backgroundLoadingComplete) {
      // Phase 1 complete, jump to 90% and show UI
      setProgress(90);
      setPriorityLoadComplete();
    } else {
      // Phase 2 complete, jump to 100%
      setProgress(100);
      setLoadingComplete();
    }
  }, [isPriorityLoading, priorityLoadingProgress, backgroundLoadingComplete, setLoadingComplete, setPriorityLoadComplete]);

  // Optimistic update for facility hidden status
  // This will be handled by cache invalidation later
  const updateFacilityHidden = (place_id: string, hidden: boolean) => {
    // For now, do nothing - cache will be updated via mutation
    console.log(`Facility ${place_id} hidden status changed to ${hidden}`);
  };

  // Show loading state with progress bar until first batch loads
  // Show UI after first batch (500 facilities) for faster perceived load time
  const minFacilitiesForUI = 500;
  const shouldShowLoading = isPriorityLoading && priorityFacilities.length < minFacilitiesForUI;

  if (shouldShowLoading) {
    const loadedCount = priorityLoadingProgress;
    const estimatedTotal = 2200; // Approximate total priority facilities

    return (
      <div className={`fixed inset-0 flex items-center justify-center bg-gray-100 z-[100] ${!isVisible ? 'hidden' : ''}`}>
        <ProgressBar
          progress={progress}
          loadedCount={loadedCount}
          totalCount={estimatedTotal}
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
        focusPlaceId={focusPlaceId}
        isVisible={isVisible}
      />
    </main>
  );
}
