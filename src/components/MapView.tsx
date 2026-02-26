"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
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

export default function MapView({ isVisible }: { isVisible: boolean }) {
  const [filterOption, setFilterOption] = useState<FilterOption>('UNHIDDEN_ONLY');
  const [selectedSports, setSelectedSports] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const { setLoadingComplete, setPriorityLoadComplete } = useLoading();

  // Use shared facilities hook (two-phase loading)
  const {
    facilities,
    priorityFacilities,
    isPriorityLoading,
    backgroundLoadingComplete,
    isError,
    error,
  } = useFacilities();

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
      // Phase 1 complete, jump to 90% and show UI
      setProgress(90);
      setPriorityLoadComplete();
    } else {
      // Phase 2 complete, jump to 100%
      setProgress(100);
      setLoadingComplete();
    }
  }, [isPriorityLoading, backgroundLoadingComplete, setLoadingComplete, setPriorityLoadComplete]);

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
