"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Search,
  MapPin,
  Phone,
  Globe,
  Star,
  Camera,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { FacilityLightweight } from "@/types/facility";

const cn = (...classes: (string | undefined | null | false)[]) =>
  classes.filter(Boolean).join(" ");

interface SportFacilitiesSidebarProps {
  sport: string | null;
  onClose: () => void;
  facilities: FacilityLightweight[];
  onFacilityClick: (placeId: string) => void;
}

type SortOption = "name" | "rating" | "reviews";

function FacilityCard({
  facility,
  onClick,
}: {
  facility: FacilityLightweight;
  onClick: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className="p-4 bg-white border border-slate-200 rounded-xl hover:shadow-md hover:border-blue-200 transition-all cursor-pointer group"
    >
      {/* Header with name and rating */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors text-sm leading-tight flex-1">
          {facility.name}
        </h3>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
          <span className="text-sm font-bold text-slate-800 tabular-nums">
            {facility.rating || "N/A"}
          </span>
        </div>
      </div>

      {/* Address */}
      <div className="flex items-start gap-1.5 mb-3">
        <MapPin className="h-3.5 w-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-slate-500 line-clamp-2">{facility.address}</p>
      </div>

      {/* Contact Info */}
      <div className="space-y-1.5 mb-3">
        {facility.phone && (
          <div className="flex items-center gap-1.5">
            <Phone className="h-3 w-3 text-slate-400" />
            <span className="text-xs text-slate-600 font-medium tabular-nums">
              {facility.phone}
            </span>
          </div>
        )}
        {facility.website && (
          <div className="flex items-center gap-1.5">
            <Globe className="h-3 w-3 text-slate-400" />
            <span className="text-xs text-blue-600 font-medium truncate">
              {new URL(facility.website).hostname.replace("www.", "")}
            </span>
          </div>
        )}
      </div>

      {/* Sports badges */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {facility.identified_sports?.map((sport) => (
          <span
            key={sport}
            className="text-[10px] bg-blue-50 text-blue-700 font-semibold px-2 py-0.5 rounded uppercase tracking-wide border border-blue-100"
          >
            {sport}
          </span>
        ))}
      </div>

      {/* Metrics */}
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span className="font-medium">
          {facility.user_ratings_total?.toLocaleString() || 0} reviews
        </span>
        <div className="flex items-center gap-1">
          <Camera className="h-3.5 w-3.5" />
          <span className="tabular-nums font-medium">
            {(facility.photo_references?.length || 0) +
              (facility.additional_photos_count || 0)}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

export default function SportFacilitiesSidebar({
  sport,
  onClose,
  facilities,
  onFacilityClick,
}: SportFacilitiesSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("rating");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 100;

  const isOpen = sport !== null;

  // Filter and sort facilities (with defensive deduplication)
  const filteredAndSortedFacilities = useMemo(() => {
    // Deduplicate by place_id first (defensive coding)
    const uniqueFacilities = Array.from(
      new Map(facilities.map((f) => [f.place_id, f])).values()
    );

    let result = [...uniqueFacilities];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (f) =>
          f.name?.toLowerCase().includes(query) ||
          f.address?.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    result.sort((a, b) => {
      if (sortBy === "name") {
        return (a.name || "").localeCompare(b.name || "");
      } else if (sortBy === "rating") {
        return (b.rating || 0) - (a.rating || 0);
      } else if (sortBy === "reviews") {
        return (b.user_ratings_total || 0) - (a.user_ratings_total || 0);
      }
      return 0;
    });

    return result;
  }, [facilities, searchQuery, sortBy]);

  // Calculate pagination
  const totalPages = Math.ceil(filteredAndSortedFacilities.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedFacilities = filteredAndSortedFacilities.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortBy, facilities]);

  const handleFacilityClick = (placeId: string) => {
    onFacilityClick(placeId);
    onClose(); // Close this sidebar when opening facility details
  };

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
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[80]"
          />

          {/* Sidebar */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 w-full sm:w-[480px] bg-slate-50 shadow-2xl z-[90] overflow-y-auto"
          >
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 z-10 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">
                      {sport}
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {facilities.length} {facilities.length === 1 ? "facility" : "facilities"} found
                    </p>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                    aria-label="Close sidebar"
                  >
                    <X className="h-5 w-5 text-slate-600" />
                  </button>
                </div>
              </div>

              {/* Search and Sort Controls */}
              <div className="sticky top-[73px] bg-white border-b border-slate-200 px-6 py-4 space-y-3 z-10 shadow-sm">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search facilities..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  />
                </div>

                {/* Sort */}
                <div className="flex items-center gap-2">
                  <ArrowUpDown className="h-4 w-4 text-slate-500" />
                  <span className="text-xs font-semibold text-slate-600">
                    Sort by:
                  </span>
                  <div className="flex gap-1.5 flex-1">
                    {[
                      { value: "rating" as const, label: "Rating" },
                      { value: "reviews" as const, label: "Reviews" },
                      { value: "name" as const, label: "Name" },
                    ].map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setSortBy(option.value)}
                        className={cn(
                          "flex-1 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all",
                          sortBy === option.value
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-white text-slate-700 border-slate-200 hover:border-blue-300 hover:bg-blue-50"
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Facilities List */}
              <div className="flex-1 px-6 py-6 space-y-3">
                {filteredAndSortedFacilities.length > 0 ? (
                  paginatedFacilities.map((facility, index) => (
                    <motion.div
                      key={facility.place_id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                    >
                      <FacilityCard
                        facility={facility}
                        onClick={() => handleFacilityClick(facility.place_id)}
                      />
                    </motion.div>
                  ))
                ) : (
                  <div className="text-center py-12">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-100 mb-4">
                      <Search className="h-8 w-8 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-1">
                      No facilities found
                    </h3>
                    <p className="text-sm text-slate-500">
                      Try adjusting your search query
                    </p>
                  </div>
                )}
              </div>

              {/* Pagination Controls */}
              {filteredAndSortedFacilities.length > itemsPerPage && (
                <div className="px-6 py-4 border-t border-slate-200 bg-white flex items-center justify-between">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </button>

                  <div className="text-sm text-slate-600 font-medium">
                    Page <span className="font-bold text-slate-900">{currentPage}</span> of{" "}
                    <span className="font-bold text-slate-900">{totalPages}</span>
                  </div>

                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}

              {/* Footer with result count */}
              {filteredAndSortedFacilities.length > 0 && (
                <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-3 shadow-lg">
                  <p className="text-xs text-center text-slate-600 font-medium">
                    Showing {startIndex + 1}-
                    {Math.min(endIndex, filteredAndSortedFacilities.length)} of{" "}
                    {filteredAndSortedFacilities.length}{" "}
                    {filteredAndSortedFacilities.length === 1 ? "facility" : "facilities"}
                    {filteredAndSortedFacilities.length < facilities.length && (
                      <span className="text-slate-400">
                        {" "}
                        (filtered from {facilities.length} total)
                      </span>
                    )}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
