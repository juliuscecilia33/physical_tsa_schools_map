"use client";

import { useRef, useState, useMemo } from "react";
import Map, { Source, Layer, NavigationControl } from "react-map-gl";
import type { MapRef, MapLayerMouseEvent } from "react-map-gl";
import { Facility } from "@/types/facility";
import { FilterOption } from "@/app/page";
import FacilitySidebar from "./FacilitySidebar";
import { motion, AnimatePresence } from "framer-motion";
import { Filter, Layers, Check, ChevronDown, ChevronUp } from "lucide-react";
import "mapbox-gl/dist/mapbox-gl.css";

interface FacilityMapProps {
  facilities: Facility[];
  filterOption: FilterOption;
  onFilterOptionChange: (option: FilterOption) => void;
  selectedSports: string[];
  onSelectedSportsChange: (sports: string[]) => void;
  onUpdateFacility: (place_id: string, hidden: boolean) => void;
}

// Activity categories and their colors
const ACTIVITY_CATEGORIES = {
  parks: { color: "#22c55e", label: "Parks & Fields" }, // bright green
  fitness: { color: "#06b6d4", label: "Fitness & Wellness" }, // cyan
  sports: { color: "#f97316", label: "Sports Venues" }, // orange
  education: { color: "#3b82f6", label: "Educational" }, // blue
  other: { color: "#6b7280", label: "Other" }, // gray
};

// Categorize facility based on sport types
function getFacilityCategory(
  sportTypes: string[],
): keyof typeof ACTIVITY_CATEGORIES {
  const parkTypes = ["park", "athletic_field", "sports_complex"];
  const fitnessTypes = ["gym", "fitness_center", "spa"];
  const sportsTypes = ["stadium", "recreation_center", "community_center"];
  const educationTypes = ["school"];

  if (sportTypes.some((type) => parkTypes.includes(type))) return "parks";
  if (sportTypes.some((type) => fitnessTypes.includes(type))) return "fitness";
  if (sportTypes.some((type) => sportsTypes.includes(type))) return "sports";
  if (sportTypes.some((type) => educationTypes.includes(type)))
    return "education";
  return "other";
}

export default function FacilityMap({
  facilities,
  filterOption,
  onFilterOptionChange,
  selectedSports,
  onSelectedSportsChange,
  onUpdateFacility,
}: FacilityMapProps) {
  const [selectedFacility, setSelectedFacility] = useState<Facility | null>(
    null,
  );
  const [expandedSections, setExpandedSections] = useState({
    displayFilter: true,
    sportFilter: true,
    categories: false,
  });
  const mapRef = useRef<MapRef>(null);

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

  // Texas center coordinates
  const INITIAL_VIEW_STATE = {
    longitude: -99.9018,
    latitude: 31.9686,
    zoom: 5.5,
  };

  // Calculate all available sports from facilities
  const availableSports = useMemo(() => {
    const sportsSet = new Set<string>();
    facilities.forEach((facility) => {
      if (facility.identified_sports) {
        facility.identified_sports.forEach((sport) => sportsSet.add(sport));
      }
    });
    return Array.from(sportsSet).sort();
  }, [facilities]);

  // Client-side filtering based on filterOption and selectedSports
  const filteredFacilities = useMemo(() => {
    let filtered = facilities;

    // Apply visibility filter
    switch (filterOption) {
      case "ALL":
        break;
      case "HIDDEN_ONLY":
        filtered = filtered.filter((f) => f.hidden === true);
        break;
      case "WITH_NOTES_ONLY":
        filtered = filtered.filter((f) => f.has_notes === true);
        break;
      case "UNHIDDEN_ONLY":
      default:
        filtered = filtered.filter((f) => !f.hidden);
        break;
    }

    // Apply sport filter
    if (selectedSports.length > 0) {
      filtered = filtered.filter((facility) => {
        if (!facility.identified_sports || facility.identified_sports.length === 0) {
          return false;
        }
        // Check if facility has at least one of the selected sports
        return selectedSports.some((sport) =>
          facility.identified_sports!.includes(sport)
        );
      });
    }

    return filtered;
  }, [facilities, filterOption, selectedSports]);

  // Calculate category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<keyof typeof ACTIVITY_CATEGORIES, number> = {
      parks: 0,
      fitness: 0,
      sports: 0,
      education: 0,
      other: 0,
    };
    filteredFacilities.forEach((facility) => {
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
        interactiveLayerIds={[
          "facility-dots-low-zoom",
          "facility-dots-high-zoom",
        ]}
        onClick={(e) => {
          if (e.features && e.features.length > 0) {
            onMarkerClick(e);
          }
        }}
      >
        <NavigationControl position="top-left" />

        <Source id="facilities" type="geojson" data={geojsonData}>
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
      <div className="absolute inset-y-4 right-4 bg-white rounded-xl shadow-2xl p-6 max-w-md h-[calc(100vh-2rem)] overflow-y-auto z-10 border border-gray-100">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg">
            <Layers className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">
              Texas Sports Facilities
            </h2>
            <p className="text-sm text-gray-500">
              {filteredFacilities.length.toLocaleString()} of{" "}
              {facilities.length.toLocaleString()} shown
            </p>
          </div>
        </div>

        <p className="text-sm text-gray-500 mb-4 flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 bg-blue-500 rounded-full"></span>
          Click any marker for details
        </p>

        {/* Modern Filter Options */}
        <div className="mb-4">
          <button
            onClick={() => toggleSection('displayFilter')}
            className="flex items-center justify-between w-full mb-3 p-2 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-600" />
              <h3 className="text-sm font-semibold text-gray-700 tracking-wide uppercase">
                Display Filter
              </h3>
            </div>
            {expandedSections.displayFilter ? (
              <ChevronUp className="w-4 h-4 text-gray-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-500" />
            )}
          </button>
          <AnimatePresence>
            {expandedSections.displayFilter && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-2 overflow-hidden"
              >
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onFilterOptionChange("UNHIDDEN_ONLY")}
              className={`w-full px-4 py-3 rounded-lg text-sm font-medium transition-all duration-300 flex items-center justify-between ${
                filterOption === "UNHIDDEN_ONLY"
                  ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md"
                  : "bg-gradient-to-r from-gray-50 to-gray-100 text-gray-700 hover:from-gray-100 hover:to-gray-200 border border-gray-200"
              }`}
            >
              <span>All (Unhidden)</span>
              {filterOption === "UNHIDDEN_ONLY" && (
                <Check className="w-3.5 h-3.5" />
              )}
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onFilterOptionChange("ALL")}
              className={`w-full px-4 py-3 rounded-lg text-sm font-medium transition-all duration-300 flex items-center justify-between ${
                filterOption === "ALL"
                  ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md"
                  : "bg-gradient-to-r from-gray-50 to-gray-100 text-gray-700 hover:from-gray-100 hover:to-gray-200 border border-gray-200"
              }`}
            >
              <span>All Facilities</span>
              {filterOption === "ALL" && <Check className="w-3.5 h-3.5" />}
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onFilterOptionChange("HIDDEN_ONLY")}
              className={`w-full px-4 py-3 rounded-lg text-sm font-medium transition-all duration-300 flex items-center justify-between ${
                filterOption === "HIDDEN_ONLY"
                  ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md"
                  : "bg-gradient-to-r from-gray-50 to-gray-100 text-gray-700 hover:from-gray-100 hover:to-gray-200 border border-gray-200"
              }`}
            >
              <span>Hidden Only</span>
              {filterOption === "HIDDEN_ONLY" && (
                <Check className="w-3.5 h-3.5" />
              )}
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onFilterOptionChange("WITH_NOTES_ONLY")}
              className={`w-full px-4 py-3 rounded-lg text-sm font-medium transition-all duration-300 flex items-center justify-between ${
                filterOption === "WITH_NOTES_ONLY"
                  ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md"
                  : "bg-gradient-to-r from-gray-50 to-gray-100 text-gray-700 hover:from-gray-100 hover:to-gray-200 border border-gray-200"
              }`}
            >
              <span>With Notes Only</span>
              {filterOption === "WITH_NOTES_ONLY" && (
                <Check className="w-3.5 h-3.5" />
              )}
            </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Sport Filter */}
        {availableSports.length > 0 && (
          <div className="mb-4">
            <button
              onClick={() => toggleSection('sportFilter')}
              className="flex items-center justify-between w-full mb-3 p-2 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-600" />
                <h3 className="text-sm font-semibold text-gray-700 tracking-wide uppercase">
                  Filter by Sport
                </h3>
              </div>
              {expandedSections.sportFilter ? (
                <ChevronUp className="w-4 h-4 text-gray-500" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-500" />
              )}
            </button>
            <AnimatePresence>
              {expandedSections.sportFilter && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="max-h-96 overflow-y-auto space-y-2">
              {availableSports.map((sport) => (
                <motion.button
                  key={sport}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    if (selectedSports.includes(sport)) {
                      onSelectedSportsChange(
                        selectedSports.filter((s) => s !== sport)
                      );
                    } else {
                      onSelectedSportsChange([...selectedSports, sport]);
                    }
                  }}
                  className={`w-full px-4 py-3 rounded-lg text-sm font-medium transition-all duration-300 flex items-center justify-between ${
                    selectedSports.includes(sport)
                      ? "bg-gradient-to-r from-green-500 to-green-600 text-white shadow-md"
                      : "bg-gradient-to-r from-gray-50 to-gray-100 text-gray-700 hover:from-gray-100 hover:to-gray-200 border border-gray-200"
                  }`}
                >
                  <span>{sport}</span>
                  {selectedSports.includes(sport) && (
                    <Check className="w-3.5 h-3.5" />
                  )}
                </motion.button>
              ))}
            </div>
            {selectedSports.length > 0 && (
              <motion.button
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onSelectedSportsChange([])}
                className="w-full mt-2 px-4 py-3 rounded-lg text-sm font-medium bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition-all duration-300"
              >
                Clear Sport Filter ({selectedSports.length})
              </motion.button>
            )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Category Sub-Cards */}
        <div>
          <button
            onClick={() => toggleSection('categories')}
            className="flex items-center justify-between w-full mb-3 p-2 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-gray-600" />
              <h3 className="text-sm font-semibold text-gray-700 tracking-wide uppercase">
                Categories
              </h3>
            </div>
            {expandedSections.categories ? (
              <ChevronUp className="w-4 h-4 text-gray-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-500" />
            )}
          </button>
          <AnimatePresence>
            {expandedSections.categories && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-2 overflow-hidden"
              >
            {Object.entries(ACTIVITY_CATEGORIES).map(
              ([key, { color, label }], idx) => (
                <motion.div
                  key={key}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-gradient-to-br from-white to-gray-50/50 rounded-lg p-3 border border-gray-100 hover:shadow-md transition-all duration-300"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-3.5 h-3.5 rounded-full shadow-sm"
                        style={{ backgroundColor: color, opacity: 0.9 }}
                      />
                      <span className="text-sm font-medium text-gray-700">
                        {label}
                      </span>
                    </div>
                    <span className="text-sm font-semibold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
                      {categoryCounts[
                        key as keyof typeof ACTIVITY_CATEGORIES
                      ].toLocaleString()}
                    </span>
                  </div>
                </motion.div>
              ),
            )}
              </motion.div>
            )}
          </AnimatePresence>
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
