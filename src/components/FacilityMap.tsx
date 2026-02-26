"use client";

import { useRef, useState, useMemo, useEffect } from "react";
import Map, { Source, Layer, NavigationControl, Popup } from "react-map-gl";
import type { MapRef, MapLayerMouseEvent } from "react-map-gl";
import { Facility } from "@/types/facility";
import { FilterOption } from "./MapView";
import FacilitySidebar from "./FacilitySidebar";
import FacilitySearch from "./FacilitySearch";
import AISearchPanel from "./AISearchPanel";
import FilterButtonBar from "./FilterButtonBar";
import { motion, AnimatePresence } from "framer-motion";
import {
  Filter,
  Layers,
  Check,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Tag,
  PanelLeft,
  PanelLeftOpen,
  X,
} from "lucide-react";
import "mapbox-gl/dist/mapbox-gl.css";
import { AISearchFilters } from "@/app/api/ai-search/route";
import { useAllTags } from "@/hooks/useAllTags";

interface FacilityMapProps {
  facilities: Facility[];
  filterOption: FilterOption;
  onFilterOptionChange: (option: FilterOption) => void;
  selectedSports: string[];
  onSelectedSportsChange: (sports: string[]) => void;
  selectedTags: string[];
  onSelectedTagsChange: (tags: string[]) => void;
  onUpdateFacility: (place_id: string, hidden: boolean) => void;
}

// Sport emoji mapping
const SPORT_EMOJIS: { [key: string]: string } = {
  Basketball: "🏀",
  Soccer: "⚽",
  Baseball: "⚾",
  Football: "🏈",
  Tennis: "🎾",
  Volleyball: "🏐",
  Swimming: "🏊",
  "Track & Field": "🏃",
  Golf: "⛳",
  Hockey: "🏒",
  Lacrosse: "🥍",
  Softball: "🥎",
  Wrestling: "🤼",
  Gymnastics: "🤸",
  Pickleball: "🏓",
  Racquetball: "🎾",
  Squash: "🎾",
  Badminton: "🏸",
  "Gym/Fitness": "💪",
  CrossFit: "🏋️",
  Yoga: "🧘",
  Pilates: "🧘‍♀️",
  "Martial Arts": "🥋",
  Boxing: "🥊",
  Bowling: "🎳",
  Skating: "⛸️",
  Climbing: "🧗",
  "Water Sports": "🚣",
};

// Activity categories and their colors
const ACTIVITY_CATEGORIES = {
  parks: { color: "#22c55e", label: "Parks & Fields" }, // bright green
  fitness: { color: "#06b6d4", label: "Fitness & Wellness" }, // cyan
  sports: { color: "#f97316", label: "Sports Venues" }, // orange
  education: { color: "#3b82f6", label: "Educational" }, // blue
  other: { color: "#6b7280", label: "Other" }, // gray
};

// Map AI sport names to Google Places types (since identified_sports is null)
const SPORT_TO_TYPE_MAPPING: Record<string, string[]> = {
  "Gym/Fitness": ["gym", "health"],
  CrossFit: ["gym", "health"],
  Yoga: ["gym", "health"],
  Pilates: ["gym", "health"],
  Swimming: ["aquarium", "swimming_pool"],
  Basketball: ["stadium", "sports_complex", "recreation_center"],
  Soccer: ["stadium", "sports_complex", "recreation_center", "athletic_field"],
  Baseball: [
    "stadium",
    "sports_complex",
    "recreation_center",
    "athletic_field",
  ],
  Football: [
    "stadium",
    "sports_complex",
    "recreation_center",
    "athletic_field",
  ],
  Tennis: ["sports_complex", "recreation_center"],
  Volleyball: ["sports_complex", "recreation_center"],
  "Track & Field": ["stadium", "sports_complex", "athletic_field"],
  Golf: ["golf"],
  Bowling: ["bowling_alley"],
  Skating: ["skating_rink"],
  Climbing: ["gym"],
  "Martial Arts": ["gym"],
  Boxing: ["gym"],
  Wrestling: ["stadium", "sports_complex"],
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

// Helper function to extract city from address
function extractCity(address: string): string {
  // Format: "Street, City, State ZIP, Country"
  const parts = address.split(",");
  if (parts.length >= 2) {
    // City is the second part (index 1)
    return parts[1].trim().toLowerCase();
  }
  return address.toLowerCase();
}

// Helper function to format numbers with commas
function formatNumber(num: number | undefined): string {
  if (num === undefined || num === null) return "0";
  return num.toLocaleString();
}

// Helper function to apply AI filters to facilities
function applyAIFilters(
  facilities: Facility[],
  aiFilters: AISearchFilters | null,
): Facility[] {
  if (!aiFilters) return facilities;

  let filtered = facilities;

  // Filter by city
  if (aiFilters.city) {
    const targetCity = aiFilters.city.toLowerCase();
    filtered = filtered.filter((facility) => {
      const facilityCity = extractCity(facility.address);
      return (
        facilityCity.includes(targetCity) || targetCity.includes(facilityCity)
      );
    });
  }

  // Filter by rating
  if (aiFilters.rating) {
    filtered = filtered.filter((facility) => {
      if (!facility.rating) return false;
      const meetsMin =
        !aiFilters.rating?.min || facility.rating >= aiFilters.rating.min;
      const meetsMax =
        !aiFilters.rating?.max || facility.rating <= aiFilters.rating.max;
      return meetsMin && meetsMax;
    });
  }

  // Filter by review count
  if (aiFilters.reviewCount) {
    filtered = filtered.filter((facility) => {
      if (!facility.user_ratings_total) return false;
      const meetsMin =
        !aiFilters.reviewCount?.min ||
        facility.user_ratings_total >= aiFilters.reviewCount.min;
      const meetsMax =
        !aiFilters.reviewCount?.max ||
        facility.user_ratings_total <= aiFilters.reviewCount.max;
      return meetsMin && meetsMax;
    });
  }

  // Filter by sports
  if (aiFilters.sports && aiFilters.sports.length > 0) {
    filtered = filtered.filter((facility) => {
      const requiredTypes = aiFilters.sports!.flatMap(
        (sport) => SPORT_TO_TYPE_MAPPING[sport] || [],
      );

      if (requiredTypes.length === 0) {
        if (
          facility.identified_sports &&
          facility.identified_sports.length > 0
        ) {
          return aiFilters.sports!.some((sport) =>
            facility.identified_sports!.includes(sport),
          );
        }
        return false;
      }

      return requiredTypes.some((type) => facility.sport_types.includes(type));
    });
  }

  // Filter by minimum sport count
  if (aiFilters.sportCountMin) {
    filtered = filtered.filter((facility) => {
      const sportCount = facility.sport_types?.length || 0;
      return sportCount >= aiFilters.sportCountMin!;
    });
  }

  // Filter by business status
  if (aiFilters.businessStatus) {
    filtered = filtered.filter((facility) => {
      return facility.business_status === aiFilters.businessStatus;
    });
  }

  return filtered;
}

export default function FacilityMap({
  facilities,
  filterOption,
  onFilterOptionChange,
  selectedSports,
  onSelectedSportsChange,
  selectedTags,
  onSelectedTagsChange,
  onUpdateFacility,
}: FacilityMapProps) {
  const [selectedFacility, setSelectedFacility] = useState<Facility | null>(
    null,
  );
  const [hoveredFacility, setHoveredFacility] = useState<Facility | null>(null);
  const [clickedFacility, setClickedFacility] = useState<Facility | null>(null);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    displayFilter: true,
    sportFilter: true,
    tagFilter: true,
    categories: true,
    moreFilters: true,
  });
  const [isAISearchOpen, setIsAISearchOpen] = useState(false);
  const [currentAIFilters, setCurrentAIFilters] =
    useState<AISearchFilters | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<
    Array<keyof typeof ACTIVITY_CATEGORIES>
  >(["parks", "fitness", "sports", "education", "other"]);
  const [isAnimating, setIsAnimating] = useState(false);
  const mapRef = useRef<MapRef>(null);

  // Expose animation state globally for cache persistence logic
  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as any).__mapAnimating = isAnimating;
    }
  }, [isAnimating]);

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({
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

  // Fetch all available tags from the database (not just tags assigned to facilities)
  const { data: availableTags = [] } = useAllTags();

  // Client-side filtering based on filterOption, selectedSports, selectedTags, and AI filters
  const filteredFacilities = useMemo(() => {
    let filtered = facilities;

    // Apply visibility filter
    switch (filterOption) {
      case "ALL":
        break;
      case "HIDDEN_ONLY":
        filtered = filtered.filter((f) => f.hidden === true);
        break;
      case "CLEANED_UP_ONLY":
        filtered = filtered.filter((f) => f.cleaned_up === true);
        break;
      case "WITH_NOTES_ONLY":
        filtered = filtered.filter((f) => f.has_notes === true);
        break;
      case "UNHIDDEN_ONLY":
      default:
        // Exclude both hidden AND cleaned_up facilities
        filtered = filtered.filter((f) => !f.hidden && !f.cleaned_up);
        break;
    }

    // Apply sport filter (from manual selection)
    if (selectedSports.length > 0) {
      filtered = filtered.filter((facility) => {
        if (
          !facility.identified_sports ||
          facility.identified_sports.length === 0
        ) {
          return false;
        }
        // Check if facility has at least one of the selected sports
        return selectedSports.some((sport) =>
          facility.identified_sports!.includes(sport),
        );
      });
    }

    // Apply tag filter (from manual selection)
    if (selectedTags.length > 0) {
      filtered = filtered.filter((facility) => {
        if (!facility.tags || facility.tags.length === 0) {
          return false;
        }
        // Check if facility has at least one of the selected tags
        return selectedTags.some((tagId) =>
          facility.tags!.some((tag) => tag.id === tagId),
        );
      });
    }

    // Apply category filter
    if (selectedCategories.length > 0 && selectedCategories.length < 5) {
      // Only filter if not all categories are selected
      filtered = filtered.filter((facility) => {
        const category = getFacilityCategory(facility.sport_types);
        return selectedCategories.includes(category);
      });
    }

    // Don't apply AI filters to the map - only manual filters
    // AI filters will be used by AISearchPanel to show results as cards

    return filtered;
  }, [
    facilities,
    filterOption,
    selectedSports,
    selectedTags,
    selectedCategories,
  ]);

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

  // Category colors mapping for filter dropdowns
  const categoryColors = useMemo(() => {
    return {
      "Parks & Fields": ACTIVITY_CATEGORIES.parks.color,
      "Fitness & Wellness": ACTIVITY_CATEGORIES.fitness.color,
      "Sports Venues": ACTIVITY_CATEGORIES.sports.color,
      Educational: ACTIVITY_CATEGORIES.education.color,
      Other: ACTIVITY_CATEGORIES.other.color,
    };
  }, []);

  // Category counts by label for filter dropdowns
  const categoryCountsByLabel = useMemo(() => {
    return {
      "Parks & Fields": categoryCounts.parks,
      "Fitness & Wellness": categoryCounts.fitness,
      "Sports Venues": categoryCounts.sports,
      Educational: categoryCounts.education,
      Other: categoryCounts.other,
    };
  }, [categoryCounts]);

  // Category label to key mapping
  const categoryLabelToKey: Record<string, keyof typeof ACTIVITY_CATEGORIES> = {
    "Parks & Fields": "parks",
    "Fitness & Wellness": "fitness",
    "Sports Venues": "sports",
    Educational: "education",
    Other: "other",
  };

  // Helper functions for filter bar
  const handleCategoryToggle = (categoryLabel: string) => {
    const categoryKey = categoryLabelToKey[categoryLabel];
    setSelectedCategories((prev) => {
      if (prev.includes(categoryKey)) {
        return prev.filter((c) => c !== categoryKey);
      }
      return [...prev, categoryKey];
    });
  };

  const handleClearCategories = () => {
    setSelectedCategories(["parks", "fitness", "sports", "education", "other"]);
  };

  const handleSportToggle = (sport: string) => {
    onSelectedSportsChange(
      selectedSports.includes(sport)
        ? selectedSports.filter((s) => s !== sport)
        : [...selectedSports, sport],
    );
  };

  const handleClearSports = () => {
    onSelectedSportsChange([]);
  };

  const handleTagToggle = (tagId: string) => {
    onSelectedTagsChange(
      selectedTags.includes(tagId)
        ? selectedTags.filter((t) => t !== tagId)
        : [...selectedTags, tagId],
    );
  };

  const handleClearTags = () => {
    onSelectedTagsChange([]);
  };

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

      // Zoom to facility location
      const map = mapRef.current?.getMap();
      setIsAnimating(true);
      map?.flyTo({
        center: [facility.location.lng, facility.location.lat],
        zoom: 16,
        duration: 1500,
      });
      // Clear animation flag after animation completes
      setTimeout(() => setIsAnimating(false), 1600);

      setSelectedFacility(facility);
      setClickedFacility(facility);
    }
  };

  // Handle facility selection from search
  const handleSearchSelect = (facility: Facility) => {
    // Focus map on facility location with smooth animation
    const map = mapRef.current?.getMap();
    setIsAnimating(true);
    map?.flyTo({
      center: [facility.location.lng, facility.location.lat],
      zoom: 16,
      duration: 1500,
    });
    // Clear animation flag after animation completes
    setTimeout(() => setIsAnimating(false), 1600);

    // Open facility sidebar
    setSelectedFacility(facility);
  };

  // Handle AI filters applied - store for AISearchPanel to use
  const handleAIFiltersApplied = (filters: AISearchFilters) => {
    setCurrentAIFilters(filters);
  };

  // Handle facility selection from AI search results
  const handleAIFacilitySelect = (facility: Facility) => {
    // Zoom to facility on map
    const map = mapRef.current?.getMap();
    setIsAnimating(true);
    map?.flyTo({
      center: [facility.location.lng, facility.location.lat],
      zoom: 16,
      duration: 1500,
    });
    // Clear animation flag after animation completes
    setTimeout(() => setIsAnimating(false), 1600);

    // Open facility sidebar
    setSelectedFacility(facility);
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
        onMouseMove={(e) => {
          // Show hover popup if no facility is currently selected
          if (!selectedFacility && e.features && e.features.length > 0) {
            const feature = e.features[0];
            const facilityData = feature.properties?.facilityData;
            if (facilityData) {
              const facility: Facility = JSON.parse(facilityData);
              setHoveredFacility(facility);
            }
          }
        }}
        onMouseLeave={() => {
          setHoveredFacility(null);
        }}
      >
        <NavigationControl position="top-right" />

        {/* Unified Dark Mode Stats Popup - Shows on both hover and click */}
        {(hoveredFacility || clickedFacility) && (
          <Popup
            longitude={(hoveredFacility || clickedFacility)!.location.lng}
            latitude={(hoveredFacility || clickedFacility)!.location.lat}
            anchor="bottom"
            closeButton={false}
            closeOnClick={false}
            offset={20}
            className="stats-popup"
          >
            <div className="bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 overflow-hidden">
              {/* Facility Name Header */}
              <div className="px-4 py-3 border-b border-slate-700">
                <h3 className="text-sm font-semibold text-white text-center truncate">
                  {(hoveredFacility || clickedFacility)!.name}
                </h3>
              </div>

              {/* Stats Grid - 2 rows x 3 columns */}
              <div className="grid grid-cols-3">
                {/* Row 1 - Photos */}
                <div className="px-5 py-3 flex flex-col items-center justify-center border-r border-b border-slate-700">
                  <div className="flex items-center gap-2 mb-2">
                    <svg
                      className="w-4 h-4 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    <span className="text-[10px] font-medium text-slate-400">
                      Photos
                    </span>
                  </div>
                  <span className="text-base font-bold text-white mt-1">
                    {formatNumber(
                      ((hoveredFacility || clickedFacility)?.photo_references
                        ?.length || 0) +
                        ((hoveredFacility || clickedFacility)?.additional_photos
                          ?.length || 0),
                    )}
                  </span>
                </div>

                {/* Row 1 - Reviews */}
                <div className="px-5 py-3 flex flex-col items-center justify-center border-r border-b border-slate-700">
                  <div className="flex items-center gap-2 mb-2">
                    <svg
                      className="w-4 h-4 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                      />
                    </svg>
                    <span className="text-[10px] font-medium text-slate-400">
                      Reviews
                    </span>
                  </div>
                  <span className="text-base font-bold text-white mt-1">
                    {formatNumber(
                      (hoveredFacility || clickedFacility)
                        ?.user_ratings_total || 0,
                    )}
                  </span>
                </div>

                {/* Row 1 - Rating */}
                <div className="px-5 py-3 flex flex-col items-center justify-center border-b border-slate-700">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-yellow-400 text-base">★</span>
                    <span className="text-[10px] font-medium text-slate-400">
                      Rating
                    </span>
                  </div>
                  <span className="text-base font-bold text-white mt-1">
                    {(() => {
                      const rating = (hoveredFacility || clickedFacility)
                        ?.rating;
                      return rating ? Number(rating).toFixed(1) : "N/A";
                    })()}
                  </span>
                </div>

                {/* Row 2 - Tags */}
                <div className="px-5 py-3 flex flex-col items-center justify-center border-r border-slate-700">
                  <div className="flex items-center gap-2 mb-2">
                    <svg
                      className="w-4 h-4 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                      />
                    </svg>
                    <span className="text-[10px] font-medium text-slate-400">
                      Tags
                    </span>
                  </div>
                  <span className="text-base font-bold text-white mt-1">
                    {formatNumber(
                      (hoveredFacility || clickedFacility)?.tags?.length || 0,
                    )}
                  </span>
                </div>

                {/* Row 2 - Notes */}
                <div className="px-5 py-3 flex flex-col items-center justify-center border-r border-slate-700 col-span-2">
                  <div className="flex items-center gap-2 mb-2">
                    <svg
                      className="w-4 h-4 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                    <span className="text-[10px] font-medium text-slate-400">
                      Notes
                    </span>
                  </div>
                  <span className="text-base font-bold text-white mt-1">
                    {(hoveredFacility || clickedFacility)?.has_notes
                      ? "1"
                      : "0"}
                  </span>
                </div>
              </div>
            </div>
          </Popup>
        )}

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

      {/* Left: Sidebar Toggle */}
      <button
        onClick={() => setSidebarVisible(!sidebarVisible)}
        className="absolute top-3 left-4 z-15 flex-shrink-0 flex items-center gap-2 px-4 py-4 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200 hover:bg-slate-50 transition-all text-sm font-medium text-slate-700"
        title={sidebarVisible ? "Hide filters sidebar" : "Show filters sidebar"}
      >
        {sidebarVisible ? (
          <PanelLeftOpen className="w-5 h-5" />
        ) : (
          <PanelLeft className="w-5 h-5" />
        )}
      </button>

      {/* Center: Search and Filters */}
      <div className="absolute top-3 z-10 flex items-center gap-3 w-full justify-center px-4">
        <FacilitySearch
          facilities={filteredFacilities}
          onSelectFacility={handleSearchSelect}
        />

        {/* Filter Button Bar - Inline */}
        <FilterButtonBar
          sidebarVisible={sidebarVisible}
          onToggleSidebar={() => setSidebarVisible(!sidebarVisible)}
          visibilityFilter={filterOption}
          onVisibilityFilterChange={onFilterOptionChange}
          availableSports={availableSports}
          selectedSports={selectedSports}
          onSportToggle={handleSportToggle}
          onClearSports={handleClearSports}
          sportEmojis={SPORT_EMOJIS}
          availableTags={availableTags}
          selectedTagIds={selectedTags}
          onTagToggle={handleTagToggle}
          onClearTags={handleClearTags}
          selectedCategories={selectedCategories.map(
            (key) => ACTIVITY_CATEGORIES[key].label,
          )}
          onCategoryToggle={handleCategoryToggle}
          onClearCategories={handleClearCategories}
          categoryCounts={categoryCountsByLabel}
          categoryColors={categoryColors}
        />
      </div>

      {/* Right: AI Assistant Button (Hidden) */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsAISearchOpen(true)}
        className="hidden absolute top-7 right-4 z-10 px-4 py-4 bg-[#1A1B1E]/90 text-white rounded-2xl shadow-2xl hover:bg-[#1A1B1E]/90 transition-all duration-300 font-semibold items-center gap-2 border border-[#559fff]"
      >
        <Sparkles className="w-5 h-5" color="#559fff" />
      </motion.button>

      {/* Modern Info Panel */}
      <AnimatePresence>
        {sidebarVisible && !selectedFacility && (
          <motion.div
            initial={{ x: -400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -400, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="fixed top-[1vh] left-20 h-[98vh] w-full md:w-[340px] bg-white shadow-2xl rounded-2xl p-6 overflow-y-auto z-20"
          >
            {/* Close Button */}
            <button
              onClick={() => setSidebarVisible(false)}
              className="absolute top-4 right-4 p-2 rounded-xl hover:bg-slate-100 transition-colors z-20"
              title="Close sidebar"
            >
              <X className="w-5 h-5 text-slate-600" />
            </button>

            {/* TSA Logo */}
            <div className="flex justify-center pb-4 mb-4 border-b border-[#E8E9EB]">
              <motion.img
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                src="/assets/TSA.png"
                alt="TSA Logo"
                className="h-10 w-auto"
              />
            </div>
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 bg-gradient-to-br from-[#004aad] to-[#004aad]/90 rounded-xl">
                <Layers className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Texas Sports Facilities
                </h2>
                <p className="text-sm text-slate-500">
                  {filteredFacilities.length.toLocaleString()} of{" "}
                  {facilities.length.toLocaleString()} shown
                </p>
              </div>
            </div>

            <p className="text-sm text-slate-500 mb-4 flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 bg-[#004aad] rounded-full"></span>
              Click any marker for details
            </p>

            {/* Modern Filter Options */}
            <div className="mb-4">
              <button
                onClick={() => toggleSection("displayFilter")}
                className="flex items-center justify-between w-full mb-3 p-2 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-slate-600" />
                  <h3 className="text-sm font-semibold text-slate-700 tracking-wide uppercase">
                    Display Filter
                  </h3>
                </div>
                {expandedSections.displayFilter ? (
                  <ChevronUp className="w-4 h-4 text-slate-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-500" />
                )}
              </button>
              <AnimatePresence>
                {expandedSections.displayFilter && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="grid grid-cols-2 gap-2 overflow-hidden"
                  >
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={() => onFilterOptionChange("UNHIDDEN_ONLY")}
                      className={`px-2 py-3 rounded-xl text-xs font-medium transition-all duration-300 flex flex-col items-center justify-center gap-1 cursor-pointer relative ${
                        filterOption === "UNHIDDEN_ONLY"
                          ? "bg-gradient-to-r from-[#004aad] to-[#004aad]/90 text-white shadow-md shadow-[#004aad]/20"
                          : "bg-gradient-to-r from-[#E8E9EB]/50 to-[#E8E9EB] text-slate-700 hover:from-[#E8E9EB] hover:to-[#E8E9EB]/80 border border-[#E8E9EB]"
                      }`}
                    >
                      <span className="text-center leading-tight">All</span>
                      {filterOption === "UNHIDDEN_ONLY" && (
                        <Check className="w-3 h-3 absolute top-1 right-1" />
                      )}
                    </motion.button>
                    {/* <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => onFilterOptionChange("HIDDEN_ONLY")}
                  className={`px-2 py-3 rounded-xl text-xs font-medium transition-all duration-300 flex flex-col items-center justify-center gap-1 cursor-pointer relative ${
                    filterOption === "HIDDEN_ONLY"
                      ? "bg-gradient-to-r from-[#004aad] to-[#004aad]/90 text-white shadow-md shadow-[#004aad]/20"
                      : "bg-gradient-to-r from-[#E8E9EB]/50 to-[#E8E9EB] text-slate-700 hover:from-[#E8E9EB] hover:to-[#E8E9EB]/80 border border-[#E8E9EB]"
                  }`}
                >
                  <span className="text-center leading-tight">Hidden Only</span>
                  {filterOption === "HIDDEN_ONLY" && (
                    <Check className="w-3 h-3 absolute top-1 right-1" />
                  )}
                </motion.button> */}
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={() => onFilterOptionChange("WITH_NOTES_ONLY")}
                      className={`px-2 py-3 rounded-xl text-xs font-medium transition-all duration-300 flex flex-col items-center justify-center gap-1 cursor-pointer relative ${
                        filterOption === "WITH_NOTES_ONLY"
                          ? "bg-gradient-to-r from-[#004aad] to-[#004aad]/90 text-white shadow-md shadow-[#004aad]/20"
                          : "bg-gradient-to-r from-[#E8E9EB]/50 to-[#E8E9EB] text-slate-700 hover:from-[#E8E9EB] hover:to-[#E8E9EB]/80 border border-[#E8E9EB]"
                      }`}
                    >
                      <span className="text-center leading-tight">
                        With Notes Only
                      </span>
                      {filterOption === "WITH_NOTES_ONLY" && (
                        <Check className="w-3 h-3 absolute top-1 right-1" />
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
                  onClick={() => toggleSection("sportFilter")}
                  className="flex items-center justify-between w-full mb-3 p-2 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-slate-600" />
                    <h3 className="text-sm font-semibold text-slate-700 tracking-wide uppercase">
                      Filter by Sport
                    </h3>
                  </div>
                  {expandedSections.sportFilter ? (
                    <ChevronUp className="w-4 h-4 text-slate-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-500" />
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
                      <div className="max-h-96 overflow-y-auto grid grid-cols-2 gap-2">
                        {availableSports.map((sport) => (
                          <motion.button
                            key={sport}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => {
                              if (selectedSports.includes(sport)) {
                                onSelectedSportsChange(
                                  selectedSports.filter((s) => s !== sport),
                                );
                              } else {
                                onSelectedSportsChange([
                                  ...selectedSports,
                                  sport,
                                ]);
                              }
                            }}
                            className={`px-2 py-3 rounded-xl text-xs font-medium transition-all duration-300 flex flex-col items-center justify-center gap-1 cursor-pointer relative ${
                              selectedSports.includes(sport)
                                ? "bg-gradient-to-r from-[#004aad] to-[#004aad]/90 text-white shadow-md shadow-[#004aad]/20"
                                : "bg-gradient-to-r from-[#E8E9EB]/50 to-[#E8E9EB] text-slate-700 hover:from-[#E8E9EB] hover:to-[#E8E9EB]/80 border border-[#E8E9EB]"
                            }`}
                          >
                            <span className="text-xl">
                              {SPORT_EMOJIS[sport] || "🏅"}
                            </span>
                            <span className="text-center leading-tight">
                              {sport}
                            </span>
                            {selectedSports.includes(sport) && (
                              <Check className="w-3 h-3 absolute top-1 right-1" />
                            )}
                          </motion.button>
                        ))}
                      </div>
                      {selectedSports.length > 0 && (
                        <motion.button
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => onSelectedSportsChange([])}
                          className="w-full mt-2 px-4 py-3 rounded-xl text-sm font-medium bg-[#c9472b]/10 text-[#c9472b] hover:bg-[#c9472b]/20 border border-[#c9472b]/20 transition-all duration-300 cursor-pointer"
                        >
                          Clear Sport Filter ({selectedSports.length})
                        </motion.button>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Tag Filter */}
            {availableTags.length > 0 && (
              <div className="mb-4">
                <button
                  onClick={() => toggleSection("tagFilter")}
                  className="flex items-center justify-between w-full mb-3 p-2 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4 text-slate-600" />
                    <h3 className="text-sm font-semibold text-slate-700 tracking-wide uppercase">
                      Filter by Tag
                    </h3>
                  </div>
                  {expandedSections.tagFilter ? (
                    <ChevronUp className="w-4 h-4 text-slate-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-500" />
                  )}
                </button>
                <AnimatePresence>
                  {expandedSections.tagFilter && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="max-h-96 overflow-y-auto flex flex-wrap gap-2">
                        {availableTags.map((tag) => (
                          <motion.button
                            key={tag.id}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => {
                              if (selectedTags.includes(tag.id)) {
                                onSelectedTagsChange(
                                  selectedTags.filter((id) => id !== tag.id),
                                );
                              } else {
                                onSelectedTagsChange([...selectedTags, tag.id]);
                              }
                            }}
                            className={`px-3 py-2 rounded-full text-xs font-medium transition-all duration-300 flex items-center gap-1.5 cursor-pointer relative ${
                              selectedTags.includes(tag.id)
                                ? "text-white shadow-md ring-2 ring-white/50"
                                : "text-white/80 hover:text-white shadow-sm hover:shadow-sm opacity-70 hover:opacity-100"
                            }`}
                            style={{ backgroundColor: tag.color }}
                          >
                            <Tag className="w-3 h-3" />
                            <span>{tag.name}</span>
                            {selectedTags.includes(tag.id) && (
                              <Check className="w-3 h-3" />
                            )}
                          </motion.button>
                        ))}
                      </div>
                      {selectedTags.length > 0 && (
                        <motion.button
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => onSelectedTagsChange([])}
                          className="w-full mt-2 px-4 py-3 rounded-xl text-sm font-medium bg-[#c9472b]/10 text-[#c9472b] hover:bg-[#c9472b]/20 border border-[#c9472b]/20 transition-all duration-300 cursor-pointer"
                        >
                          Clear Tag Filter ({selectedTags.length})
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
                onClick={() => toggleSection("categories")}
                className="flex items-center justify-between w-full mb-3 p-2 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-slate-600" />
                  <h3 className="text-sm font-semibold text-slate-700 tracking-wide uppercase">
                    Categories
                  </h3>
                </div>
                {expandedSections.categories ? (
                  <ChevronUp className="w-4 h-4 text-slate-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-500" />
                )}
              </button>
              <AnimatePresence>
                {expandedSections.categories && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="grid grid-cols-2 gap-2 overflow-hidden"
                  >
                    {Object.entries(ACTIVITY_CATEGORIES).map(
                      ([key, { color, label }], idx) => {
                        const isSelected = selectedCategories.includes(
                          key as keyof typeof ACTIVITY_CATEGORIES,
                        );
                        return (
                          <motion.button
                            key={key}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => {
                              const categoryKey =
                                key as keyof typeof ACTIVITY_CATEGORIES;
                              if (selectedCategories.includes(categoryKey)) {
                                setSelectedCategories(
                                  selectedCategories.filter(
                                    (c) => c !== categoryKey,
                                  ),
                                );
                              } else {
                                setSelectedCategories([
                                  ...selectedCategories,
                                  categoryKey,
                                ]);
                              }
                            }}
                            className={`rounded-xl p-3 transition-all duration-300 cursor-pointer relative ${
                              isSelected
                                ? "bg-white border-2"
                                : "bg-gradient-to-r from-[#E8E9EB]/50 to-[#E8E9EB] hover:from-[#E8E9EB] hover:to-[#E8E9EB]/80 border border-[#E8E9EB]"
                            }`}
                            style={
                              isSelected ? { borderColor: color } : undefined
                            }
                          >
                            <div className="flex flex-col items-center gap-2">
                              <div
                                className="w-4 h-4 rounded-full shadow-sm"
                                style={{ backgroundColor: color, opacity: 0.9 }}
                              />
                              <span
                                className={`text-xs font-medium text-center leading-tight ${
                                  isSelected
                                    ? "text-slate-900"
                                    : "text-slate-700"
                                }`}
                              >
                                {label}
                              </span>
                              <span
                                className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                  isSelected
                                    ? "bg-[#E8E9EB] text-slate-700"
                                    : "bg-[#E8E9EB] text-slate-500"
                                }`}
                              >
                                {categoryCounts[
                                  key as keyof typeof ACTIVITY_CATEGORIES
                                ].toLocaleString()}
                              </span>
                            </div>
                            {isSelected && (
                              <Check className="w-3 h-3 text-slate-700 absolute top-1 right-1" />
                            )}
                          </motion.button>
                        );
                      },
                    )}
                    {selectedCategories.length > 0 &&
                      selectedCategories.length < 5 && (
                        <motion.button
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() =>
                            setSelectedCategories([
                              "parks",
                              "fitness",
                              "sports",
                              "education",
                              "other",
                            ])
                          }
                          className="col-span-2 px-4 py-2.5 rounded-xl text-xs font-medium bg-[#c9472b]/10 text-[#c9472b] hover:bg-[#c9472b]/20 border border-[#c9472b]/20 transition-all duration-300 cursor-pointer"
                        >
                          Clear Category Filter ({5 - selectedCategories.length}{" "}
                          hidden)
                        </motion.button>
                      )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* More Filters */}
            <div className="mt-4">
              <button
                onClick={() => toggleSection("moreFilters")}
                className="flex items-center justify-between w-full mb-3 p-2 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-slate-600" />
                  <h3 className="text-sm font-semibold text-slate-700 tracking-wide uppercase">
                    More Filters
                  </h3>
                </div>
                {expandedSections.moreFilters ? (
                  <ChevronUp className="w-4 h-4 text-slate-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-500" />
                )}
              </button>
              <AnimatePresence>
                {expandedSections.moreFilters && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="grid grid-cols-2 gap-2 overflow-hidden"
                  >
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={() => onFilterOptionChange("ALL")}
                      className={`px-2 py-3 rounded-xl text-xs font-medium transition-all duration-300 flex flex-col items-center justify-center gap-1 cursor-pointer relative ${
                        filterOption === "ALL"
                          ? "bg-gradient-to-r from-[#004aad] to-[#004aad]/90 text-white shadow-md shadow-[#004aad]/20"
                          : "bg-gradient-to-r from-[#E8E9EB]/50 to-[#E8E9EB] text-slate-700 hover:from-[#E8E9EB] hover:to-[#E8E9EB]/80 border border-[#E8E9EB]"
                      }`}
                    >
                      <span className="text-center leading-tight">
                        All Facilities
                      </span>
                      {filterOption === "ALL" && (
                        <Check className="w-3 h-3 absolute top-1 right-1" />
                      )}
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={() => onFilterOptionChange("CLEANED_UP_ONLY")}
                      className={`px-2 py-3 rounded-xl text-xs font-medium transition-all duration-300 flex flex-col items-center justify-center gap-1 cursor-pointer relative ${
                        filterOption === "CLEANED_UP_ONLY"
                          ? "bg-gradient-to-r from-[#f97316] to-[#f97316]/90 text-white shadow-md shadow-[#f97316]/20"
                          : "bg-gradient-to-r from-[#fed7aa]/50 to-[#fed7aa] text-[#9a3412] hover:from-[#fed7aa] hover:to-[#fed7aa]/80 border border-[#fdba74]"
                      }`}
                    >
                      <span className="text-center leading-tight">
                        Cleaned Up (Low Quality)
                      </span>
                      {filterOption === "CLEANED_UP_ONLY" && (
                        <Check className="w-3 h-3 absolute top-1 right-1" />
                      )}
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <FacilitySidebar
        facility={selectedFacility}
        onClose={() => {
          setSelectedFacility(null);
          setClickedFacility(null);
        }}
        onUpdateFacility={onUpdateFacility}
      />

      {/* AI Search Panel */}
      <AISearchPanel
        isOpen={isAISearchOpen}
        onClose={() => setIsAISearchOpen(false)}
        onFiltersApplied={handleAIFiltersApplied}
        onFacilitySelect={handleAIFacilitySelect}
        allFacilities={facilities}
        currentFilters={currentAIFilters}
      />
    </div>
  );
}
