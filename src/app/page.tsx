"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabase";
import { Facility } from "@/types/facility";
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

export default function Home() {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [totalFacilityCount, setTotalFacilityCount] = useState<number | null>(null);
  const [loadedFacilityCount, setLoadedFacilityCount] = useState(0);
  const [filterOption, setFilterOption] = useState<FilterOption>('UNHIDDEN_ONLY');
  const [selectedSports, setSelectedSports] = useState<string[]>([]);

  const loadFacilities = async () => {
      try {
        setLoading(true);
        setLoadingProgress(0);

        // First, get the total count of facilities
        const { data: countData, error: countError } = await supabase
          .rpc("get_facilities_count");

        let totalCount = 0;
        if (countError) {
          console.error("Error getting facility count:", countError);
          // Continue without count if error
        } else {
          totalCount = Number(countData);
          setTotalFacilityCount(totalCount);
          console.log(`Total facilities in database: ${totalCount}`);
        }

        // Fetch all facilities using pagination to bypass 1000 row limit
        const allFacilities: any[] = [];
        let from = 0;
        const pageSize = 1000;
        let hasMore = true;

        while (hasMore) {
          const { data, error } = await supabase
            .rpc("get_facilities_with_coords", {
              row_limit: 20000,
              include_hidden: true,
              include_cleaned_up: true
            })
            .range(from, from + pageSize - 1);

          if (error) throw error;

          if (data && data.length > 0) {
            allFacilities.push(...data);
            from += pageSize;

            // Update progress
            const loaded = allFacilities.length;
            setLoadedFacilityCount(loaded);

            if (totalCount > 0) {
              const progress = (loaded / totalCount) * 100;
              setLoadingProgress(Math.min(progress, 100));
            }

            console.log(`Loaded ${loaded} facilities so far...`);

            // If we got less than pageSize, we're done
            if (data.length < pageSize) {
              hasMore = false;
            }
          } else {
            hasMore = false;
          }
        }

        console.log(`Total loaded: ${allFacilities.length} facilities from database`);
        setLoadingProgress(100);

        // Transform data from Supabase format to Facility format
        const transformedFacilities: Facility[] = allFacilities.map((row: any) => ({
          place_id: row.place_id,
          name: row.name,
          sport_types: row.sport_types || [],
          identified_sports: row.identified_sports || [],
          sport_metadata: row.sport_metadata || {},
          address: row.address,
          location: {
            lat: row.lat ? parseFloat(row.lat) : 0,
            lng: row.lng ? parseFloat(row.lng) : 0,
          },
          phone: row.phone,
          website: row.website,
          rating: row.rating ? parseFloat(row.rating) : undefined,
          user_ratings_total: row.user_ratings_total,
          reviews: row.reviews || [],
          photo_references: row.photo_references || [],
          opening_hours: row.opening_hours,
          business_status: row.business_status,
          hidden: row.hidden || false,
          cleaned_up: row.cleaned_up || false,
          has_notes: row.has_notes || false,
        }));

        console.log(`Loaded ${transformedFacilities.length} athletic facilities`);

        setFacilities(transformedFacilities);
      } catch (err: any) {
        console.error("Error loading facilities:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

  useEffect(() => {
    loadFacilities();
  }, []);

  // Optimistic update for facility hidden status
  const updateFacilityHidden = (place_id: string, hidden: boolean) => {
    setFacilities(prevFacilities =>
      prevFacilities.map(facility =>
        facility.place_id === place_id
          ? { ...facility, hidden }
          : facility
      )
    );
  };

  if (loading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-gray-100">
        <ProgressBar
          progress={loadingProgress}
          loadedCount={loadedFacilityCount}
          totalCount={totalFacilityCount}
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">❌ Error loading facilities</div>
          <p className="text-gray-600">{error}</p>
          <p className="text-sm text-gray-500 mt-4">
            Make sure the database table has been created and populated.
          </p>
        </div>
      </div>
    );
  }

  if (facilities.length === 0) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="text-yellow-600 text-xl mb-4">⚠️ No facilities found</div>
          <p className="text-gray-600">
            Run the migration script to import Houston facilities:
          </p>
          <code className="block mt-4 p-4 bg-gray-800 text-white rounded">
            npx tsx scripts/migrate-to-supabase.ts
          </code>
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
        onUpdateFacility={updateFacilityHidden}
      />
    </main>
  );
}
