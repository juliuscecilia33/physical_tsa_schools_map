"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Facility } from "@/types/facility";
import { useQuery } from "@tanstack/react-query";

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

  // Fetch all facilities with React Query
  const { data: facilities = [], isLoading, isError, error } = useQuery({
    queryKey: ['facilities', 'all'],
    queryFn: fetchAllFacilities,
    staleTime: Infinity, // Session-based caching
    gcTime: Infinity,
  });

  // Optimistic update for facility hidden status
  // This will be handled by cache invalidation later
  const updateFacilityHidden = (place_id: string, hidden: boolean) => {
    // For now, do nothing - cache will be updated via mutation
    console.log(`Facility ${place_id} hidden status changed to ${hidden}`);
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-[#004aad] mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading facilities...</p>
        </div>
      </div>
    );
  }

  // Show error state if there's an error
  if (isError) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-gray-100">
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
