"use client";

import dynamic from "next/dynamic";
import facilitiesData from "../../test-facilities-houston.json";

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
  return (
    <main className="w-full h-screen">
      <FacilityMap facilities={facilitiesData} />
    </main>
  );
}
