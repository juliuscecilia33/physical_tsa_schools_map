"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Search, MapPin, Star, Users, Tag as TagIcon, FileText } from "lucide-react";
import { FacilityTag } from "@/types/facility";
import { useAllTags } from "@/hooks/useAllTags";

const cn = (...classes: (string | undefined | null | false)[]) =>
  classes.filter(Boolean).join(" ");

export interface FilterState {
  searchQuery: string;
  selectedSports: string[];
  selectedCities: string[];
  addressSearch: string;
  minRating: number | null;
  minReviews: number | null;
  selectedTags: string[];
  hasNotes: boolean | null; // null = all, true = with notes, false = without notes
}

interface FiltersSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  availableSports: string[];
  availableCities: string[];
}

export default function FiltersSidebar({
  isOpen,
  onClose,
  filters,
  onFiltersChange,
  availableSports,
  availableCities,
}: FiltersSidebarProps) {
  const { data: allTags = [], isLoading: isLoadingTags } = useAllTags();

  const updateFilter = <K extends keyof FilterState>(
    key: K,
    value: FilterState[K]
  ) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const toggleSport = (sport: string) => {
    const newSports = filters.selectedSports.includes(sport)
      ? filters.selectedSports.filter((s) => s !== sport)
      : [...filters.selectedSports, sport];
    updateFilter("selectedSports", newSports);
  };

  const toggleCity = (city: string) => {
    const newCities = filters.selectedCities.includes(city)
      ? filters.selectedCities.filter((c) => c !== city)
      : [...filters.selectedCities, city];
    updateFilter("selectedCities", newCities);
  };

  const toggleTag = (tagId: string) => {
    const newTags = filters.selectedTags.includes(tagId)
      ? filters.selectedTags.filter((t) => t !== tagId)
      : [...filters.selectedTags, tagId];
    updateFilter("selectedTags", newTags);
  };

  const clearAllFilters = () => {
    onFiltersChange({
      searchQuery: "",
      selectedSports: [],
      selectedCities: [],
      addressSearch: "",
      minRating: null,
      minReviews: null,
      selectedTags: [],
      hasNotes: null,
    });
  };

  const hasActiveFilters =
    filters.searchQuery ||
    filters.selectedSports.length > 0 ||
    filters.selectedCities.length > 0 ||
    filters.addressSearch ||
    filters.minRating !== null ||
    filters.minReviews !== null ||
    filters.selectedTags.length > 0 ||
    filters.hasNotes !== null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
          />

          {/* Sidebar */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 w-full sm:w-[450px] bg-white shadow-2xl z-50 overflow-y-auto"
          >
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Filters</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Refine your facility search
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                  aria-label="Close filters"
                >
                  <X className="h-5 w-5 text-slate-600" />
                </button>
              </div>

              {/* Filters Content */}
              <div className="flex-1 px-6 py-6 space-y-6">
                {/* Name Search */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700">
                    Search by Name
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search facilities..."
                      value={filters.searchQuery}
                      onChange={(e) => updateFilter("searchQuery", e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Sports Filter */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700">
                    Sports
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {availableSports.map((sport) => {
                      const isSelected = filters.selectedSports.includes(sport);
                      return (
                        <button
                          key={sport}
                          onClick={() => toggleSport(sport)}
                          className={cn(
                            "text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all",
                            isSelected
                              ? "bg-blue-600 text-white border-blue-600"
                              : "bg-white text-slate-700 border-slate-200 hover:border-blue-300 hover:bg-blue-50"
                          )}
                        >
                          {sport}
                        </button>
                      );
                    })}
                    {availableSports.length === 0 && (
                      <p className="text-xs text-slate-400 italic">No sports available</p>
                    )}
                  </div>
                </div>

                {/* City Filter */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700">
                    City
                  </label>
                  <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl p-2 bg-slate-50">
                    {availableCities.map((city) => {
                      const isSelected = filters.selectedCities.includes(city);
                      return (
                        <label
                          key={city}
                          className="flex items-center gap-2 px-3 py-2 hover:bg-white rounded-lg cursor-pointer transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleCity(city)}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500/20"
                          />
                          <span className="text-sm text-slate-700">{city}</span>
                        </label>
                      );
                    })}
                    {availableCities.length === 0 && (
                      <p className="text-xs text-slate-400 italic px-3 py-2">
                        No cities available
                      </p>
                    )}
                  </div>
                </div>

                {/* Address Search */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700">
                    Address Search
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search by address..."
                      value={filters.addressSearch}
                      onChange={(e) => updateFilter("addressSearch", e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Reviews Filter */}
                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-slate-700">
                    Reviews & Ratings
                  </label>

                  {/* Min Rating */}
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-600 font-medium flex items-center gap-1.5">
                      <Star className="h-3.5 w-3.5" />
                      Minimum Rating
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="5"
                      step="0.1"
                      placeholder="e.g., 4.0"
                      value={filters.minRating ?? ""}
                      onChange={(e) =>
                        updateFilter("minRating", e.target.value ? parseFloat(e.target.value) : null)
                      }
                      className="w-full px-4 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    />
                  </div>

                  {/* Min Review Count */}
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-600 font-medium flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" />
                      Minimum Review Count
                    </label>
                    <input
                      type="number"
                      min="0"
                      placeholder="e.g., 10"
                      value={filters.minReviews ?? ""}
                      onChange={(e) =>
                        updateFilter("minReviews", e.target.value ? parseInt(e.target.value) : null)
                      }
                      className="w-full px-4 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Tags Filter */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                    <TagIcon className="h-4 w-4" />
                    Tags
                  </label>
                  {isLoadingTags ? (
                    <div className="text-xs text-slate-400 italic">Loading tags...</div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {allTags.map((tag) => {
                        const isSelected = filters.selectedTags.includes(tag.id);
                        return (
                          <button
                            key={tag.id}
                            onClick={() => toggleTag(tag.id)}
                            className={cn(
                              "text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all",
                              isSelected
                                ? "border-opacity-100"
                                : "border-opacity-30 opacity-60 hover:opacity-100"
                            )}
                            style={{
                              backgroundColor: isSelected ? `${tag.color}20` : `${tag.color}10`,
                              borderColor: tag.color,
                              color: tag.color,
                            }}
                          >
                            {tag.name}
                          </button>
                        );
                      })}
                      {allTags.length === 0 && (
                        <p className="text-xs text-slate-400 italic">No tags available</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Has Notes Filter */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                    <FileText className="h-4 w-4" />
                    Notes
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => updateFilter("hasNotes", null)}
                      className={cn(
                        "flex-1 text-xs font-semibold px-3 py-2 rounded-lg border transition-all",
                        filters.hasNotes === null
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white text-slate-700 border-slate-200 hover:border-blue-300 hover:bg-blue-50"
                      )}
                    >
                      All
                    </button>
                    <button
                      onClick={() => updateFilter("hasNotes", true)}
                      className={cn(
                        "flex-1 text-xs font-semibold px-3 py-2 rounded-lg border transition-all",
                        filters.hasNotes === true
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white text-slate-700 border-slate-200 hover:border-blue-300 hover:bg-blue-50"
                      )}
                    >
                      With Notes
                    </button>
                    <button
                      onClick={() => updateFilter("hasNotes", false)}
                      className={cn(
                        "flex-1 text-xs font-semibold px-3 py-2 rounded-lg border transition-all",
                        filters.hasNotes === false
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white text-slate-700 border-slate-200 hover:border-blue-300 hover:bg-blue-50"
                      )}
                    >
                      Without Notes
                    </button>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 flex gap-3">
                <button
                  onClick={clearAllFilters}
                  disabled={!hasActiveFilters}
                  className="flex-1 px-4 py-2.5 text-sm font-semibold rounded-xl border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
                >
                  Clear All
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2.5 text-sm font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
