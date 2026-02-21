"use client";

import { useRef, useState, useMemo } from "react";
import Map, { Source, Layer, NavigationControl } from "react-map-gl";
import type { MapRef, MapLayerMouseEvent } from "react-map-gl";
import { Facility } from "@/types/facility";
import { FilterOption } from "@/app/page";
import FacilitySidebar from "./FacilitySidebar";
import { motion } from "framer-motion";
import { Filter, Layers, Check } from "lucide-react";
import "mapbox-gl/dist/mapbox-gl.css";

interface FacilityMapProps {
  facilities: Facility[];
  filterOption: FilterOption;
  onFilterOptionChange: (option: FilterOption) => void;
  onUpdateFacility: (place_id: string, hidden: boolean) => void;
}

// Activity categories and their colors
const ACTIVITY_CATEGORIES = {
  parks: { color: '#22c55e', label: 'Parks & Fields' },       // bright green
  fitness: { color: '#06b6d4', label: 'Fitness & Wellness' }, // cyan
  sports: { color: '#f97316', label: 'Sports Venues' },       // orange
  education: { color: '#3b82f6', label: 'Educational' },      // blue
  other: { color: '#6b7280', label: 'Other' }                 // gray
};

// Categorize facility based on sport types
function getFacilityCategory(sportTypes: string[]): keyof typeof ACTIVITY_CATEGORIES {
  const parkTypes = ['park', 'athletic_field', 'sports_complex'];
  const fitnessTypes = ['gym', 'fitness_center', 'spa'];
  const sportsTypes = ['stadium', 'recreation_center', 'community_center'];
  const educationTypes = ['school'];

  if (sportTypes.some(type => parkTypes.includes(type))) return 'parks';
  if (sportTypes.some(type => fitnessTypes.includes(type))) return 'fitness';
  if (sportTypes.some(type => sportsTypes.includes(type))) return 'sports';
  if (sportTypes.some(type => educationTypes.includes(type))) return 'education';
  return 'other';
}

export default function FacilityMap({
  facilities,
  filterOption,
  onFilterOptionChange,
  onUpdateFacility,
}: FacilityMapProps) {
  const [selectedFacility, setSelectedFacility] = useState<Facility | null>(null);
  const mapRef = useRef<MapRef>(null);

  const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

  // Texas center coordinates
  const INITIAL_VIEW_STATE = {
    longitude: -99.9018,
    latitude: 31.9686,
    zoom: 5.5,
  };

  // Client-side filtering based on filterOption
  const filteredFacilities = useMemo(() => {
    switch (filterOption) {
      case 'ALL':
        return facilities;
      case 'HIDDEN_ONLY':
        return facilities.filter(f => f.hidden === true);
      case 'UNHIDDEN_ONLY':
      default:
        return facilities.filter(f => !f.hidden);
    }
  }, [facilities, filterOption]);

  // Calculate category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<keyof typeof ACTIVITY_CATEGORIES, number> = {
      parks: 0,
      fitness: 0,
      sports: 0,
      education: 0,
      other: 0,
    };
    filteredFacilities.forEach(facility => {
      const category = getFacilityCategory(facility.sport_types);
      counts[category]++;
    });
    return counts;
  }, [filteredFacilities]);

  // Convert filtered facilities to GeoJSON format with color coding
  const geojsonData = useMemo(() => {
    return {
      type: "FeatureCollection" as const,
      features: filteredFacilities.map((facility) => {
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
  }, [filteredFacilities]);

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

      {/* Modern Info Panel */}
      <div className="absolute top-4 right-4 bg-white rounded-xl shadow-2xl p-4 max-w-xs z-10 border border-gray-100">
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1.5 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg">
            <Layers className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-900">
              Texas Sports Facilities
            </h2>
            <p className="text-xs text-gray-500">
              {filteredFacilities.length.toLocaleString()} of {facilities.length.toLocaleString()} shown
            </p>
          </div>
        </div>

        <p className="text-xs text-gray-500 mb-3 flex items-center gap-1">
          <span className="inline-block w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
          Click any marker for details
        </p>

        {/* Modern Filter Options */}
        <div className="mb-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Filter className="w-3 h-3 text-gray-600" />
            <h3 className="text-xs font-semibold text-gray-700 tracking-wide uppercase">Display Filter</h3>
          </div>
          <div className="space-y-1.5">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onFilterOptionChange('UNHIDDEN_ONLY')}
              className={`w-full px-3 py-2 rounded-lg text-xs font-medium transition-all duration-300 flex items-center justify-between ${
                filterOption === 'UNHIDDEN_ONLY'
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md'
                  : 'bg-gradient-to-r from-gray-50 to-gray-100 text-gray-700 hover:from-gray-100 hover:to-gray-200 border border-gray-200'
              }`}
            >
              <span>Unhidden Only</span>
              {filterOption === 'UNHIDDEN_ONLY' && <Check className="w-3.5 h-3.5" />}
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onFilterOptionChange('ALL')}
              className={`w-full px-3 py-2 rounded-lg text-xs font-medium transition-all duration-300 flex items-center justify-between ${
                filterOption === 'ALL'
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md'
                  : 'bg-gradient-to-r from-gray-50 to-gray-100 text-gray-700 hover:from-gray-100 hover:to-gray-200 border border-gray-200'
              }`}
            >
              <span>All Facilities</span>
              {filterOption === 'ALL' && <Check className="w-3.5 h-3.5" />}
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onFilterOptionChange('HIDDEN_ONLY')}
              className={`w-full px-3 py-2 rounded-lg text-xs font-medium transition-all duration-300 flex items-center justify-between ${
                filterOption === 'HIDDEN_ONLY'
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md'
                  : 'bg-gradient-to-r from-gray-50 to-gray-100 text-gray-700 hover:from-gray-100 hover:to-gray-200 border border-gray-200'
              }`}
            >
              <span>Hidden Only</span>
              {filterOption === 'HIDDEN_ONLY' && <Check className="w-3.5 h-3.5" />}
            </motion.button>
          </div>
        </div>

        {/* Category Sub-Cards */}
        <div>
          <h3 className="text-xs font-semibold text-gray-700 mb-2 tracking-wide uppercase">Categories</h3>
          <div className="space-y-1.5">
            {Object.entries(ACTIVITY_CATEGORIES).map(([key, { color, label }], idx) => (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="bg-gradient-to-br from-white to-gray-50/50 rounded-lg p-2.5 border border-gray-100 hover:shadow-md transition-all duration-300"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full shadow-sm"
                      style={{ backgroundColor: color, opacity: 0.9 }}
                    />
                    <span className="text-xs font-medium text-gray-700">{label}</span>
                  </div>
                  <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                    {categoryCounts[key as keyof typeof ACTIVITY_CATEGORIES].toLocaleString()}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <FacilitySidebar
        facility={selectedFacility}
        onClose={() => setSelectedFacility(null)}
        onUpdateFacility={onUpdateFacility}
      />
    </div>
  );
}
