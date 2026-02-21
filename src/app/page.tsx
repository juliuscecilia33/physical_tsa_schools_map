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

        // Query with PostGIS functions to extract lat/lng
        const { data, error } = await supabase.rpc("get_facilities_with_coords");

        if (error) throw error;

        // Transform data from Supabase format to Facility format
        const transformedFacilities: Facility[] = data.map((row: any) => ({
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

        setFacilities(transformedFacilities);
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
