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
    <div ref={searchRef} className="relative w-80">
      {/* Search Input */}
      <div className="relative">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`bg-white rounded-xl shadow-lg transition-all ${
            isFocused ? "ring-2 ring-blue-500" : ""
          }`}
        >
          <div className="flex items-center gap-2 px-4 py-3">
            <Search className="w-5 h-5 text-gray-400 flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsFocused(true)}
              placeholder="Search facilities, sports, or location..."
              className="flex-1 text-sm text-gray-900 placeholder:text-gray-400 bg-transparent focus:outline-none"
            />
            {searchQuery && (
              <button
                onClick={handleClearSearch}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            )}
          </div>
        </motion.div>
      </div>

      {/* Search Results */}
      <AnimatePresence>
        {isFocused && searchQuery.trim() && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden z-50"
          >
            {searchResults.length > 0 ? (
              <div className="max-h-[60vh] overflow-y-auto">
                <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide bg-gray-50 border-b border-gray-100">
                  {searchResults.length} {searchResults.length === 1 ? "Result" : "Results"}
                </div>
                {searchResults.map((facility, idx) => (
                  <motion.button
                    key={facility.place_id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: idx * 0.03 }}
                    onClick={() => handleSelectFacility(facility)}
                    className={`w-full text-left px-4 py-3 border-b border-gray-50 last:border-b-0 transition-all ${
                      idx === selectedIndex
                        ? "bg-blue-50"
                        : "hover:bg-gray-50"
                    }`}
                  >
                    <div className="space-y-2">
                      {/* Facility Name */}
                      <h4 className="font-semibold text-gray-900 text-sm leading-tight">
                        {facility.name}
                      </h4>

                      {/* Address with City */}
                      <div className="flex items-start gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-gray-600 leading-relaxed">
                          {facility.address}
                        </p>
                      </div>

                      {/* Sports Badges */}
                      {facility.identified_sports && facility.identified_sports.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {facility.identified_sports.slice(0, 4).map((sport) => (
                            <span
                              key={sport}
                              className="inline-flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-blue-50 to-blue-100/50 text-blue-700 rounded-full text-xs font-medium"
                            >
                              <span className="text-sm">{SPORT_EMOJIS[sport] || "🏅"}</span>
                              <span>{sport}</span>
                            </span>
                          ))}
                          {facility.identified_sports.length > 4 && (
                            <span className="inline-flex items-center px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                              +{facility.identified_sports.length - 4} more
                            </span>
                          )}
                        </div>
                      )}

                      {/* Rating if available */}
                      {facility.rating && (
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <span className="text-yellow-500">★</span>
                          <span className="font-medium">{facility.rating.toFixed(1)}</span>
                          <span>({facility.user_ratings_total})</span>
                        </div>
                      )}
                    </div>
                  </motion.button>
                ))}
              </div>
            ) : (
              <div className="px-4 py-8 text-center">
                <Search className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No facilities found</p>
                <p className="text-xs text-gray-400 mt-1">
                  Try searching by name, location, or sport
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Keyboard Shortcut Hint */}
      {isFocused && searchResults.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 px-2">
          <p className="text-xs text-gray-400 bg-white/90 backdrop-blur-sm rounded px-2 py-1 shadow-sm">
            <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600 font-mono">↑↓</kbd> navigate
            {" "}
            <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600 font-mono">Enter</kbd> select
            {" "}
            <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600 font-mono">Esc</kbd> close
          </p>
        </div>
      )}
    </div>
  );
}
