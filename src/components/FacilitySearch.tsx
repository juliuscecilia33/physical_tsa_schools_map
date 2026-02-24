"use client";

import { Facility } from "@/types/facility";
import { motion, AnimatePresence } from "framer-motion";
import { Search, MapPin, X } from "lucide-react";
import { useState, useMemo, useRef, useEffect } from "react";

// Sport emoji mapping (same as FacilitySidebar)
const SPORT_EMOJIS: { [key: string]: string } = {
  "Basketball": "🏀",
  "Soccer": "⚽",
  "Baseball": "⚾",
  "Football": "🏈",
  "Tennis": "🎾",
  "Volleyball": "🏐",
  "Swimming": "🏊",
  "Track & Field": "🏃",
  "Golf": "⛳",
  "Hockey": "🏒",
  "Lacrosse": "🥍",
  "Softball": "🥎",
  "Wrestling": "🤼",
  "Gymnastics": "🤸",
  "Pickleball": "🏓",
  "Racquetball": "🎾",
  "Squash": "🎾",
  "Badminton": "🏸",
  "Gym/Fitness": "💪",
  "CrossFit": "🏋️",
  "Yoga": "🧘",
  "Pilates": "🧘‍♀️",
  "Martial Arts": "🥋",
  "Boxing": "🥊",
  "Bowling": "🎳",
  "Skating": "⛸️",
  "Climbing": "🧗",
  "Water Sports": "🚣",
};

interface FacilitySearchProps {
  facilities: Facility[];
  onSelectFacility: (facility: Facility) => void;
}

export default function FacilitySearch({ facilities, onSelectFacility }: FacilitySearchProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter facilities based on search query
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];

    const query = searchQuery.toLowerCase();
    const results = facilities.filter((facility) => {
      // Search by name
      const nameMatch = facility.name.toLowerCase().includes(query);

      // Search by address (includes city)
      const addressMatch = facility.address.toLowerCase().includes(query);

      // Search by sports
      const sportsMatch = facility.identified_sports?.some((sport) =>
        sport.toLowerCase().includes(query)
      );

      return nameMatch || addressMatch || sportsMatch;
    });

    // Limit to 15 results for performance
    return results.slice(0, 15);
  }, [facilities, searchQuery]);

  // Extract city from address
  const extractCity = (address: string): string => {
    // Typically format: "123 Street, City, State ZIP"
    const parts = address.split(",");
    if (parts.length >= 2) {
      return parts[parts.length - 2].trim();
    }
    return address;
  };

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isFocused || searchResults.length === 0) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < searchResults.length - 1 ? prev + 1 : prev
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
          break;
        case "Enter":
          e.preventDefault();
          if (searchResults[selectedIndex]) {
            handleSelectFacility(searchResults[selectedIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          setSearchQuery("");
          inputRef.current?.blur();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFocused, searchResults, selectedIndex]);

  // Reset selected index when search results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchResults]);

  // Handle click outside to close results
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsFocused(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectFacility = (facility: Facility) => {
    onSelectFacility(facility);
    setSearchQuery("");
    setIsFocused(false);
    inputRef.current?.blur();
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    inputRef.current?.focus();
  };

  return (
    <div ref={searchRef} className="relative">
      <AnimatePresence mode="wait">
        {!isExpanded ? (
          // Collapsed: Icon Button
          <motion.button
            key="collapsed"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            onClick={() => {
              setIsExpanded(true);
              setTimeout(() => inputRef.current?.focus(), 100);
            }}
            className="p-4 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200 hover:bg-gray-50 transition-all"
          >
            <Search className="w-6 h-6 text-gray-600" />
          </motion.button>
        ) : (
          // Expanded: Full Search Bar
          <motion.div
            key="expanded"
            initial={{ opacity: 0, width: 60 }}
            animate={{ opacity: 1, width: 400 }}
            exit={{ opacity: 0, width: 60 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="relative"
          >
            <div className="relative">
              <motion.div
                className={`bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl transition-all duration-300 border ${
                  isFocused
                    ? "ring-2 ring-[#004aad]/50 shadow-[#004aad]/20 border-[#004aad]/30"
                    : "border-[#E8E9EB] hover:border-gray-300/50"
                }`}
              >
                <div className="flex items-center gap-4 px-6 py-4">
                  <Search className={`w-6 h-6 flex-shrink-0 transition-colors duration-300 ${
                    isFocused ? "text-[#004aad]" : "text-gray-400"
                  }`} />
                  <input
                    ref={inputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => setIsFocused(true)}
                    placeholder="Search facilities, sports, or location..."
                    className="flex-1 text-base text-gray-900 placeholder:text-gray-400 bg-transparent focus:outline-none font-medium"
                  />
                  {searchQuery ? (
                    <motion.button
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={handleClearSearch}
                      className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                      <X className="w-5 h-5 text-gray-400 hover:text-gray-600" />
                    </motion.button>
                  ) : (
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => {
                        setIsExpanded(false);
                        setIsFocused(false);
                      }}
                      className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                      <X className="w-5 h-5 text-gray-400 hover:text-gray-600" />
                    </motion.button>
                  )}
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search Results - Modern Relaxed Design */}
      <AnimatePresence>
        {isExpanded && isFocused && searchQuery.trim() && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="absolute top-full left-0 right-0 mt-4 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-[#E8E9EB] overflow-hidden z-50"
          >
            {searchResults.length > 0 ? (
              <div className="max-h-[65vh] overflow-y-auto">
                {/* Header */}
                <div className="px-6 py-4 bg-gradient-to-r from-[#004aad]/5 to-[#004aad]/10 border-b border-[#E8E9EB]">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-gray-700">
                      {searchResults.length} {searchResults.length === 1 ? "Result" : "Results"}
                    </p>
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                      Live search
                    </div>
                  </div>
                </div>

                {/* Results Grid */}
                <div className="p-3">
                  {searchResults.map((facility, idx) => (
                    <motion.button
                      key={facility.place_id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.04, duration: 0.3 }}
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleSelectFacility(facility)}
                      className={`w-full text-left p-5 mb-3 rounded-xl transition-all duration-300 ${
                        idx === selectedIndex
                          ? "bg-gradient-to-br from-[#004aad]/5 to-[#004aad]/10 shadow-lg shadow-[#004aad]/10 border-2 border-[#004aad]/30"
                          : "bg-gradient-to-br from-white to-gray-50/50 hover:from-gray-50 hover:to-gray-100/50 border-2 border-transparent hover:border-[#E8E9EB] shadow-sm hover:shadow-md"
                      }`}
                    >
                      <div className="space-y-3">
                        {/* Facility Name */}
                        <h4 className="font-bold text-gray-900 text-base leading-tight">
                          {facility.name}
                        </h4>

                        {/* Address with City */}
                        <div className="flex items-start gap-2">
                          <MapPin className="w-4 h-4 text-[#004aad] flex-shrink-0 mt-0.5" />
                          <p className="text-sm text-gray-600 leading-relaxed">
                            {facility.address}
                          </p>
                        </div>

                        {/* Sports Badges */}
                        {facility.identified_sports && facility.identified_sports.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {facility.identified_sports.slice(0, 5).map((sport) => (
                              <span
                                key={sport}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-[#004aad]/5 to-[#004aad]/10 text-[#004aad] rounded-lg text-xs font-semibold shadow-sm"
                              >
                                <span className="text-base">{SPORT_EMOJIS[sport] || "🏅"}</span>
                                <span>{sport}</span>
                              </span>
                            ))}
                            {facility.identified_sports.length > 5 && (
                              <span className="inline-flex items-center px-3 py-1.5 bg-[#E8E9EB] text-gray-600 rounded-lg text-xs font-semibold">
                                +{facility.identified_sports.length - 5} more
                              </span>
                            )}
                          </div>
                        )}

                        {/* Rating if available */}
                        {facility.rating && (
                          <div className="flex items-center gap-2 text-sm">
                            <div className="flex items-center gap-1">
                              <span className="text-yellow-500 text-base">★</span>
                              <span className="font-bold text-gray-900">{facility.rating.toFixed(1)}</span>
                            </div>
                            <span className="text-gray-400">•</span>
                            <span className="text-gray-500">{facility.user_ratings_total} reviews</span>
                          </div>
                        )}
                      </div>
                    </motion.button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="px-6 py-12 text-center">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center">
                    <Search className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-base font-semibold text-gray-700 mb-1">No facilities found</p>
                  <p className="text-sm text-gray-500">
                    Try searching by name, location, or sport
                  </p>
                </motion.div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Keyboard Shortcut Hint - Modern Style */}
      <AnimatePresence>
        {isExpanded && isFocused && searchResults.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ delay: 0.2 }}
            className="absolute top-full left-0 right-0 mt-2"
          >
            <div className="bg-white/95 backdrop-blur-xl rounded-xl shadow-lg border border-[#E8E9EB] px-4 py-3">
              <div className="flex items-center justify-center gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <kbd className="px-2.5 py-1.5 bg-gradient-to-b from-[#E8E9EB]/70 to-[#E8E9EB] rounded-lg text-gray-700 font-mono font-semibold shadow-sm border border-[#E8E9EB]">
                    ↑↓
                  </kbd>
                  <span className="text-gray-600 font-medium">Navigate</span>
                </div>
                <div className="w-px h-4 bg-gray-300"></div>
                <div className="flex items-center gap-1.5">
                  <kbd className="px-2.5 py-1.5 bg-gradient-to-b from-[#E8E9EB]/70 to-[#E8E9EB] rounded-lg text-gray-700 font-mono font-semibold shadow-sm border border-[#E8E9EB]">
                    Enter
                  </kbd>
                  <span className="text-gray-600 font-medium">Select</span>
                </div>
                <div className="w-px h-4 bg-gray-300"></div>
                <div className="flex items-center gap-1.5">
                  <kbd className="px-2.5 py-1.5 bg-gradient-to-b from-[#E8E9EB]/70 to-[#E8E9EB] rounded-lg text-gray-700 font-mono font-semibold shadow-sm border border-[#E8E9EB]">
                    Esc
                  </kbd>
                  <span className="text-gray-600 font-medium">Close</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
