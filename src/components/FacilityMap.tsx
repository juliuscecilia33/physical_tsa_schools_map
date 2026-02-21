"use client";

import { useEffect, useRef, useState } from "react";
import Map, { Marker, NavigationControl } from "react-map-gl";
import { Facility } from "@/types/facility";
import FacilitySidebar from "./FacilitySidebar";
import "mapbox-gl/dist/mapbox-gl.css";

interface FacilityMapProps {
  facilities: Facility[];
}

export default function FacilityMap({ facilities }: FacilityMapProps) {
  const [selectedFacility, setSelectedFacility] = useState<Facility | null>(null);
  const mapRef = useRef(null);

  const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

  // Houston center coordinates
  const INITIAL_VIEW_STATE = {
    longitude: -95.3698,
    latitude: 29.7604,
    zoom: 11,
  };

  return (
    <div className="relative w-full h-screen">
      <Map
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={INITIAL_VIEW_STATE}
        style={{ width: "100%", height: "100%" }}
        mapStyle="mapbox://styles/mapbox/streets-v12"
      >
        <NavigationControl position="top-left" />

        {facilities.map((facility) => (
          <Marker
            key={facility.place_id}
            longitude={facility.location.lng}
            latitude={facility.location.lat}
            anchor="bottom"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              setSelectedFacility(facility);
            }}
          >
            <div className="cursor-pointer hover:scale-110 transition-transform">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
                  fill="#3b82f6"
                  stroke="#1e40af"
                  strokeWidth="1"
                />
                <circle cx="12" cy="9" r="2.5" fill="white" />
              </svg>
            </div>
          </Marker>
        ))}
      </Map>

      {/* Info Panel */}
      <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-4 max-w-xs z-10">
        <h2 className="text-lg font-bold text-gray-900 mb-2">
          Houston Sports Facilities
        </h2>
        <p className="text-sm text-gray-600">
          Showing {facilities.length} facilities
        </p>
        <p className="text-xs text-gray-500 mt-2">
          Click on a marker to view details
        </p>
      </div>

      {/* Sidebar */}
      <FacilitySidebar
        facility={selectedFacility}
        onClose={() => setSelectedFacility(null)}
      />
    </div>
  );
}
