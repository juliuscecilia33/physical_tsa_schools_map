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

  // Convert facilities to GeoJSON format (no clustering, all individual)
  const geojsonData = useMemo(() => {
    return {
      type: "FeatureCollection" as const,
      features: facilities.map((facility) => ({
        type: "Feature" as const,
        properties: {
          place_id: facility.place_id,
          name: facility.name,
          // Store the full facility data
          facilityData: JSON.stringify(facility),
        },
        geometry: {
          type: "Point" as const,
          coordinates: [facility.location.lng, facility.location.lat],
        },
      })),
    };
  }, [facilities]);

  // Track current zoom level
  const [zoom, setZoom] = useState(INITIAL_VIEW_STATE.zoom);

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
        onZoom={(e) => setZoom(e.viewState.zoom)}
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
          {/* Small colored dots at low zoom (zoom < 10) */}
          <Layer
            id="facility-dots-low-zoom"
            type="circle"
            maxzoom={10}
            paint={{
              "circle-color": "#3b82f6",
              "circle-radius": 4,
              "circle-stroke-width": 1,
              "circle-stroke-color": "#1e40af",
            }}
          />

          {/* Larger detailed dots at high zoom (zoom >= 10) */}
          <Layer
            id="facility-dots-high-zoom"
            type="circle"
            minzoom={10}
            paint={{
              "circle-color": "#3b82f6",
              "circle-radius": 8,
              "circle-stroke-width": 2,
              "circle-stroke-color": "#1e40af",
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
      </div>

      {/* Sidebar */}
      <FacilitySidebar
        facility={selectedFacility}
        onClose={() => setSelectedFacility(null)}
      />
    </div>
  );
}
