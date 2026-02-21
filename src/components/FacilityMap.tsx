"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import Map, { Source, Layer, NavigationControl } from "react-map-gl";
import type { MapRef, MapLayerMouseEvent } from "react-map-gl";
import { Facility } from "@/types/facility";
import FacilitySidebar from "./FacilitySidebar";
import "mapbox-gl/dist/mapbox-gl.css";

interface FacilityMapProps {
  facilities: Facility[];
}

// Activity categories and their colors
const ACTIVITY_CATEGORIES = {
  fitness: { color: '#10b981', label: 'Fitness & Wellness' }, // green
  sports: { color: '#f97316', label: 'Sports Venues' },       // orange
  education: { color: '#3b82f6', label: 'Educational' },      // blue
  other: { color: '#6b7280', label: 'Other' }                 // gray
};

// Categorize facility based on sport types
function getFacilityCategory(sportTypes: string[]): keyof typeof ACTIVITY_CATEGORIES {
  const fitnessTypes = ['gym', 'spa'];
  const sportsTypes = ['stadium', 'bowling_alley'];
  const educationTypes = ['school'];

  if (sportTypes.some(type => fitnessTypes.includes(type))) return 'fitness';
  if (sportTypes.some(type => sportsTypes.includes(type))) return 'sports';
  if (sportTypes.some(type => educationTypes.includes(type))) return 'education';
  return 'other';
}

export default function FacilityMap({ facilities }: FacilityMapProps) {
  const [selectedFacility, setSelectedFacility] = useState<Facility | null>(null);
  const mapRef = useRef<MapRef>(null);

  const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

  // Texas center coordinates
  const INITIAL_VIEW_STATE = {
    longitude: -99.9018,
    latitude: 31.9686,
    zoom: 5.5,
  };

  // Convert facilities to GeoJSON format with color coding
  const geojsonData = useMemo(() => {
    return {
      type: "FeatureCollection" as const,
      features: facilities.map((facility) => {
        const category = getFacilityCategory(facility.sport_types);
        const color = ACTIVITY_CATEGORIES[category].color;

        return {
          type: "Feature" as const,
          properties: {
            place_id: facility.place_id,
            name: facility.name,
            category,
            color,
            // Store the full facility data
            facilityData: JSON.stringify(facility),
          },
          geometry: {
            type: "Point" as const,
            coordinates: [facility.location.lng, facility.location.lat],
          },
        };
      }),
    };
  }, [facilities]);

  // Handle click on individual markers
  const onMarkerClick = (event: MapLayerMouseEvent) => {
    const feature = event.features?.[0];
    if (!feature) return;

    const facilityData = feature.properties?.facilityData;
    if (facilityData) {
      const facility: Facility = JSON.parse(facilityData);
      setSelectedFacility(facility);
    }
  };

  return (
    <div className="relative w-full h-screen">
      <Map
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={INITIAL_VIEW_STATE}
        style={{ width: "100%", height: "100%" }}
        mapStyle="mapbox://styles/mapbox/streets-v12"
        interactiveLayerIds={["facility-dots-low-zoom", "facility-dots-high-zoom"]}
        onClick={(e) => {
          if (e.features && e.features.length > 0) {
            onMarkerClick(e);
          }
        }}
      >
        <NavigationControl position="top-left" />

        <Source
          id="facilities"
          type="geojson"
          data={geojsonData}
        >
          {/* Modern flat colored dots at low zoom (zoom < 10) */}
          <Layer
            id="facility-dots-low-zoom"
            type="circle"
            maxzoom={10}
            paint={{
              "circle-color": ["get", "color"],
              "circle-radius": 5,
              "circle-opacity": 0.7,
              "circle-stroke-width": 1,
              "circle-stroke-color": ["get", "color"],
              "circle-stroke-opacity": 0.9,
            }}
          />

          {/* Larger modern dots at high zoom (zoom >= 10) */}
          <Layer
            id="facility-dots-high-zoom"
            type="circle"
            minzoom={10}
            paint={{
              "circle-color": ["get", "color"],
              "circle-radius": 10,
              "circle-opacity": 0.7,
              "circle-stroke-width": 1,
              "circle-stroke-color": ["get", "color"],
              "circle-stroke-opacity": 0.9,
            }}
          />
        </Source>
      </Map>

      {/* Info Panel */}
      <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-4 max-w-xs z-10">
        <h2 className="text-lg font-bold text-gray-900 mb-2">
          Sports Facilities in Texas
        </h2>
        <p className="text-sm text-gray-600">
          Showing {facilities.length.toLocaleString()} facilities
        </p>
        <p className="text-xs text-gray-500 mt-2">
          Click on a marker to view details
        </p>

        {/* Color Legend */}
        <div className="mt-4 pt-3 border-t border-gray-200">
          <h3 className="text-xs font-semibold text-gray-700 mb-2">Categories</h3>
          <div className="space-y-1.5">
            {Object.entries(ACTIVITY_CATEGORIES).map(([key, { color, label }]) => (
              <div key={key} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full opacity-70"
                  style={{ backgroundColor: color }}
                />
                <span className="text-xs text-gray-600">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <FacilitySidebar
        facility={selectedFacility}
        onClose={() => setSelectedFacility(null)}
      />
    </div>
  );
}
