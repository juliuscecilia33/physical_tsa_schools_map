"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2,
  BarChart3,
  Users,
  Settings,
  Phone,
  Globe,
  Star,
  Camera,
  FileText,
  Search,
  Filter,
  Plus,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { FacilityLightweight } from "@/types/facility";
import { useQuery } from "@tanstack/react-query";

const cn = (...classes: (string | undefined | null | false)[]) =>
  classes.filter(Boolean).join(" ");

// Fetch all facilities
async function fetchAllFacilities(): Promise<FacilityLightweight[]> {
  const response = await fetch('/api/facilities/all');

  if (!response.ok) {
    throw new Error(`Failed to fetch facilities: ${response.statusText}`);
  }

  const data = await response.json();
  return data.facilities as FacilityLightweight[];
}

const TABS = [
  { id: "facilities", label: "Facilities", icon: Building2 },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "users", label: "Users", icon: Users },
  { id: "settings", label: "Settings", icon: Settings },
];

function CRMTabs({
  activeTab,
  setActiveTab,
}: {
  activeTab: string;
  setActiveTab: (id: string) => void;
}) {
  return (
    <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-md transition-colors",
              isActive
                ? "bg-white text-blue-700 shadow-sm"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-50",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: any;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-slate-200/60 bg-white p-5 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
          <Icon className="h-5 w-5" />
        </div>
        <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
          {label}
        </span>
      </div>
      <p className="text-3xl font-bold tabular-nums text-slate-800">
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
    </motion.div>
  );
}

function FacilityTable({ facilities }: { facilities: FacilityLightweight[] }) {
  return (
    <div className="w-full overflow-x-auto rounded-2xl border border-slate-200/60 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-slate-500 uppercase tracking-wider border-b border-slate-200/60 bg-slate-50/50">
            <th className="px-5 py-4 font-semibold text-slate-600">Facility</th>
            <th className="px-5 py-4 font-semibold text-slate-600">
              Contact Info
            </th>
            <th className="px-5 py-4 font-semibold text-slate-600">
              Sports
            </th>
            <th className="px-5 py-4 font-semibold text-slate-600">
              Tags
            </th>
            <th className="px-5 py-4 font-semibold text-slate-600 text-right">
              Metrics
            </th>
            <th className="px-5 py-4 font-semibold text-slate-600 text-right">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          <AnimatePresence>
            {facilities.map((facility, index) => (
              <motion.tr
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                key={facility.place_id}
                className="hover:bg-slate-50/60 transition-colors group"
              >
                <td className="px-5 py-4 align-top min-w-[200px]">
                  <div className="font-semibold text-slate-800 mb-1 group-hover:text-blue-600 transition-colors">
                    {facility.name}
                  </div>
                  <div
                    className="text-xs text-slate-500 line-clamp-1 max-w-[250px]"
                    title={facility.address}
                  >
                    {facility.address}
                  </div>
                  {facility.has_notes && (
                    <span className="mt-2 inline-flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50 border border-amber-200/50 px-2 py-1 rounded-md font-semibold uppercase tracking-wider">
                      <FileText className="h-3 w-3" />
                      Has Notes
                    </span>
                  )}
                </td>

                <td className="px-4 py-3 align-top text-xs text-gray-600 space-y-1.5 min-w-[150px]">
                  {facility.phone ? (
                    <div className="flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-gray-400" />
                      <span className="tabular-nums font-medium">
                        {facility.phone}
                      </span>
                    </div>
                  ) : (
                    <div className="text-gray-400 italic">No phone</div>
                  )}
                  {facility.website ? (
                    <div className="flex items-center gap-1.5">
                      <Globe className="h-3.5 w-3.5 text-gray-400" />
                      <a
                        href={facility.website}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:text-blue-700 font-medium truncate max-w-[180px] transition-colors"
                      >
                        {new URL(facility.website).hostname.replace("www.", "")}
                      </a>
                    </div>
                  ) : (
                    <div className="text-gray-400 italic">No website</div>
                  )}
                </td>

                <td className="px-4 py-3 align-top min-w-[180px]">
                  <div className="flex flex-wrap gap-1.5">
                    {facility.identified_sports?.map((sport) => (
                      <span
                        key={sport}
                        className="text-[10px] bg-blue-50 text-blue-700 font-semibold px-2 py-0.5 rounded uppercase tracking-wide border border-blue-100"
                      >
                        {sport}
                      </span>
                    ))}
                    {(!facility.identified_sports ||
                      facility.identified_sports.length === 0) && (
                      <span className="text-xs text-gray-400 italic">
                        No sports
                      </span>
                    )}
                  </div>
                </td>

                <td className="px-4 py-3 align-top min-w-[180px]">
                  {facility.tags && facility.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {facility.tags.map((tag) => (
                        <span
                          key={tag.id}
                          className="text-[10px] font-semibold px-2 py-0.5 rounded border uppercase tracking-wide"
                          style={{
                            backgroundColor: `${tag.color}15`,
                            borderColor: `${tag.color}30`,
                            color: tag.color,
                          }}
                        >
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400 italic">No tags</span>
                  )}
                </td>

                <td className="px-5 py-4 align-top text-right min-w-[120px]">
                  <div className="flex flex-col items-end gap-1.5 text-xs">
                    <div className="flex items-center gap-1.5" title="Rating">
                      <span className="font-bold tabular-nums text-slate-800 text-sm">
                        {facility.rating || "N/A"}
                      </span>
                      <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
                    </div>
                    <div className="text-slate-500 font-medium tabular-nums">
                      {facility.user_ratings_total?.toLocaleString() || 0}{" "}
                      reviews
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-500 mt-0.5 font-medium">
                      <Camera className="h-4 w-4" />
                      <span className="tabular-nums">
                        {(facility.photo_references?.length || 0) +
                          (facility.additional_photos_count || 0)}{" "}
                        photos
                      </span>
                    </div>
                  </div>
                </td>

                <td className="px-5 py-4 align-middle text-right">
                  <button className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 hover:text-blue-600 hover:border-blue-200 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20 active:bg-slate-100">
                    View Details
                  </button>
                </td>
              </motion.tr>
            ))}
          </AnimatePresence>
          {facilities.length === 0 && (
            <tr>
              <td
                colSpan={6}
                className="px-4 py-12 text-center text-gray-500 text-sm"
              >
                No facilities found.
              </td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr className="border-t border-gray-300 bg-white">
            <td
              className="px-4 py-3 font-semibold text-gray-900 text-xs uppercase tracking-wider"
              colSpan={4}
            >
              Total Facilities
            </td>
            <td
              className="px-4 py-3 text-right tabular-nums font-bold text-gray-900 text-sm"
              colSpan={2}
            >
              {facilities.length}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export default function CRMView({ isVisible }: { isVisible: boolean }) {
  const [activeTab, setActiveTab] = useState("facilities");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(100);

  // Fetch all facilities with React Query (shares cache with MapView)
  const { data: facilities = [], isLoading, isError, error } = useQuery({
    queryKey: ['facilities', 'all'],
    queryFn: fetchAllFacilities,
    staleTime: Infinity, // Session-based caching
    gcTime: Infinity,
  });

  const filteredFacilities = facilities.filter(
    (f) =>
      f.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.address?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // Reset to page 1 when search changes
  const previousSearchQuery = useRef(searchQuery);
  useEffect(() => {
    if (previousSearchQuery.current !== searchQuery) {
      setCurrentPage(1);
      previousSearchQuery.current = searchQuery;
    }
  }, [searchQuery]);

  // Calculate pagination
  const totalPages = Math.ceil(filteredFacilities.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedFacilities = filteredFacilities.slice(startIndex, endIndex);

  const totalReviews = facilities.reduce(
    (sum, f) => sum + (f.user_ratings_total || 0),
    0,
  );
  const facilitiesWithNotes = facilities.filter((f) => f.has_notes).length;

  // Show loading state
  if (isLoading) {
    return (
      <div className={`w-full min-h-screen bg-white font-poppins text-slate-900 ${!isVisible ? 'hidden' : ''} flex items-center justify-center`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading facilities...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (isError) {
    return (
      <div className={`w-full min-h-screen bg-white font-poppins text-slate-900 ${!isVisible ? 'hidden' : ''} flex items-center justify-center`}>
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">❌ Error loading facilities</div>
          <p className="text-gray-600">{error?.message || 'Unknown error'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full min-h-screen bg-white font-poppins text-slate-900 ${!isVisible ? 'hidden' : ''}`}>
      <div className="w-full h-full p-6 md:p-8 lg:p-12 space-y-8">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              Facility CRM
            </h1>
            <p className="text-sm text-slate-500 mt-2 font-medium">
              Manage and track your sports facility outreach
            </p>
          </div>
          <CRMTabs activeTab={activeTab} setActiveTab={setActiveTab} />
        </div>

        {activeTab === "facilities" ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            {/* Metrics Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
              <SummaryCard
                label="Total Facilities"
                value={facilities.length}
                icon={Building2}
              />
              <SummaryCard
                label="Avg Rating"
                value={(
                  facilities.reduce((sum, f) => sum + (f.rating || 0), 0) /
                  facilities.length
                ).toFixed(1)}
                icon={Star}
              />
              <SummaryCard
                label="Total Reviews"
                value={totalReviews}
                icon={Users}
              />
              <SummaryCard
                label="With Notes"
                value={facilitiesWithNotes}
                icon={FileText}
              />
            </div>

            {/* Main Content Area */}
            <div className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm space-y-5">
              {/* Toolbar */}
              <div className="flex flex-col sm:flex-row justify-between gap-4 items-center">
                <div className="relative w-full sm:w-80">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search facilities..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 text-sm font-medium border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-slate-400 text-slate-900 shadow-sm"
                  />
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 transition-colors shadow-sm active:bg-slate-100">
                    <Filter className="h-4 w-4 text-slate-500" />
                    Filters
                  </button>
                  <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm active:bg-blue-800">
                    <Plus className="h-4 w-4" />
                    Add Facility
                  </button>
                </div>
              </div>

              {/* Table */}
              <FacilityTable facilities={paginatedFacilities} />

              {/* Pagination Controls */}
              {filteredFacilities.length > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200">
                  {/* Results Info */}
                  <div className="text-sm text-slate-600 font-medium">
                    Showing {startIndex + 1}-{Math.min(endIndex, filteredFacilities.length)} of {filteredFacilities.length} facilities
                  </div>

                  {/* Page Controls */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </button>

                    <div className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700">
                      Page <span className="font-bold text-slate-900">{currentPage}</span> of <span className="font-bold text-slate-900">{totalPages}</span>
                    </div>

                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Items per page selector */}
                  <div className="flex items-center gap-2 text-sm">
                    <label htmlFor="itemsPerPage" className="text-slate-600 font-medium">
                      Per page:
                    </label>
                    <select
                      id="itemsPerPage"
                      value={itemsPerPage}
                      onChange={(e) => {
                        setItemsPerPage(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="px-3 py-2 border border-slate-200 rounded-lg bg-white text-slate-700 font-semibold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm"
                    >
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                      <option value={200}>200</option>
                      <option value={500}>500</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center justify-center py-24"
          >
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-slate-50 border border-slate-100 mb-6 shadow-sm">
                <BarChart3 className="h-10 w-10 text-slate-400" />
              </div>
              <h2 className="text-xl font-bold tracking-tight text-slate-900 mb-2">
                Module Coming Soon
              </h2>
              <p className="text-sm text-slate-500 max-w-sm mx-auto font-medium">
                The {TABS.find((t) => t.id === activeTab)?.label} module is
                currently under development. Check back later for updates.
              </p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
