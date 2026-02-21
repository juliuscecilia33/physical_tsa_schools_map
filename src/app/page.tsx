"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabase";
import { Facility } from "@/types/facility";

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

export default function Home() {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadFacilities() {
      try {
        setLoading(true);

        // Fetch all facilities using pagination to bypass 1000 row limit
        const allFacilities: any[] = [];
        let from = 0;
        const pageSize = 1000;
        let hasMore = true;

        while (hasMore) {
          const { data, error } = await supabase
            .rpc("get_facilities_with_coords", { row_limit: 10000 })
            .range(from, from + pageSize - 1);

          if (error) throw error;

          if (data && data.length > 0) {
            allFacilities.push(...data);
            from += pageSize;

            console.log(`Loaded ${allFacilities.length} facilities so far...`);

            // If we got less than pageSize, we're done
            if (data.length < pageSize) {
              hasMore = false;
            }
          } else {
            hasMore = false;
          }
        }

        console.log(`Total loaded: ${allFacilities.length} facilities from database`);

        // Transform data from Supabase format to Facility format
        const transformedFacilities: Facility[] = allFacilities.map((row: any) => ({
          place_id: row.place_id,
          name: row.name,
          sport_types: row.sport_types || [],
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
        }));

        // Filter out non-sport facilities
        const NON_SPORT_TYPES = [
          'food', 'restaurant', 'cafe', 'bar', 'lodging', 'store',
          'clothing_store', 'shopping_mall', 'amusement_park',
          'movie_theater', 'aquarium', 'night_club', 'tourist_attraction'
        ];

        const sportFacilities = transformedFacilities.filter((facility) => {
          // Keep facility if it has at least one sport type that isn't in the exclusion list
          return facility.sport_types.some(type => !NON_SPORT_TYPES.includes(type));
        });

        console.log(`Filtered to ${sportFacilities.length} sport facilities (removed ${transformedFacilities.length - sportFacilities.length} non-sport facilities)`);

        setFacilities(sportFacilities);
      } catch (err: any) {
        console.error("Error loading facilities:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadFacilities();
  }, []);

  if (loading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading facilities from database...</p>
        </div>
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
      <FacilityMap facilities={facilities} />
    </main>
  );
}
