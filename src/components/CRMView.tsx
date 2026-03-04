"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
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
  Map as MapIcon,
  Eye,
} from "lucide-react";
import { FacilityLightweight } from "@/types/facility";
import { useLoading } from "@/contexts/LoadingContext";
import { useFacilities } from "@/hooks/useFacilities";
import FiltersSidebar, { FilterState } from "./FiltersSidebar";
import CRMFacilityDetailsSidebar from "./CRMFacilityDetailsSidebar";
import SportFacilitiesSidebar from "./SportFacilitiesSidebar";
import AddFacilitySidebar from "./AddFacilitySidebar";
import { SkeletonTableRows } from "./SkeletonTableRow";
import FacilitySearch from "./FacilitySearch";
import { Facility } from "@/types/facility";
import { CloseCRMExplorer } from "./CloseCRMExplorer";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const cn = (...classes: (string | undefined | null | false)[]) =>
  classes.filter(Boolean).join(" ");

const TABS = [
  { id: "facilities", label: "Facilities", icon: Building2 },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "close", label: "Close", icon: Users },
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

function FacilityTable({
  facilities,
  onOpenDetails,
  onViewOnMap,
  isLoading,
}: {
  facilities: FacilityLightweight[];
  onOpenDetails: (placeId: string) => void;
  onViewOnMap: (placeId: string) => void;
  isLoading?: boolean;
}) {
  return (
    <div className="w-full overflow-x-auto rounded-2xl border border-slate-200/60 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-slate-500 uppercase tracking-wider border-b border-slate-200/60 bg-slate-50/50">
            <th className="px-5 py-4 font-semibold text-slate-600">Facility</th>
            <th className="px-5 py-4 font-semibold text-slate-600">
              Contact Info
            </th>
            <th className="px-5 py-4 font-semibold text-slate-600">Sports</th>
            <th className="px-5 py-4 font-semibold text-slate-600">Tags</th>
            <th className="px-5 py-4 font-semibold text-slate-600 text-right">
              Metrics
            </th>
            <th className="px-5 py-4 font-semibold text-slate-600 text-right">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {isLoading ? (
            <SkeletonTableRows count={10} />
          ) : (
            <AnimatePresence>
              {facilities.map((facility, index) => (
                <motion.tr
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  key={facility.place_id}
                  onClick={() => onOpenDetails(facility.place_id)}
                  className="hover:bg-slate-50/60 transition-colors group cursor-pointer"
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
                          {new URL(facility.website).hostname.replace(
                            "www.",
                            "",
                          )}
                        </a>
                      </div>
                    ) : (
                      <div className="text-gray-400 italic">No website</div>
                    )}
                  </td>

                  <td className="px-4 py-3 align-top min-w-[180px]">
                    <div className="flex flex-wrap gap-1.5">
                      {facility.identified_sports
                        ?.filter((sport) => {
                          const score =
                            facility.sport_metadata?.[sport]?.score ?? 0;
                          return score >= 40;
                        })
                        .map((sport) => (
                          <span
                            key={sport}
                            className="text-[10px] bg-blue-50 text-blue-700 font-semibold px-2 py-0.5 rounded uppercase tracking-wide border border-blue-100"
                          >
                            {sport}
                          </span>
                        ))}
                      {(!facility.identified_sports ||
                        facility.identified_sports.length === 0 ||
                        facility.identified_sports.filter(
                          (sport) =>
                            (facility.sport_metadata?.[sport]?.score ?? 0) >=
                            40,
                        ).length === 0) && (
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
                      <span className="text-xs text-gray-400 italic">
                        No tags
                      </span>
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
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewOnMap(facility.place_id);
                        }}
                        title="View on Map"
                        className="p-2 rounded-lg border border-slate-200 text-slate-700 bg-white hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20 active:bg-slate-100 cursor-pointer"
                      >
                        <MapIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenDetails(facility.place_id);
                        }}
                        title="View Details"
                        className="p-2 rounded-lg border border-slate-200 text-slate-700 bg-white hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20 active:bg-slate-100 cursor-pointer"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
              {facilities.length === 0 && !isLoading && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-12 text-center text-gray-500 text-sm"
                  >
                    No facilities found.
                  </td>
                </tr>
              )}
            </AnimatePresence>
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

// Analytics data aggregation
function calculateSportAnalytics(facilities: FacilityLightweight[]) {
  const sportCounts: Record<string, number> = {};
  let facilitiesWithoutSports = 0;

  facilities.forEach((facility) => {
    const sports = facility.identified_sports || [];
    if (sports.length === 0) {
      facilitiesWithoutSports++;
    } else {
      sports.forEach((sport) => {
        sportCounts[sport] = (sportCounts[sport] || 0) + 1;
      });
    }
  });

  // Convert to array and sort by count descending
  const sportData = Object.entries(sportCounts)
    .map(([sport, count]) => ({
      sport,
      count,
      percentage: ((count / facilities.length) * 100).toFixed(1),
    }))
    .sort((a, b) => b.count - a.count);

  const topSport = sportData[0];

  return {
    sportData,
    totalUniqueSports: sportData.length,
    topSport: topSport
      ? { name: topSport.sport, count: topSport.count }
      : { name: "N/A", count: 0 },
    facilitiesWithoutSports,
    totalFacilities: facilities.length,
  };
}

// Skeleton loader for analytics
function AnalyticsSkeletonLoader() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Summary cards skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-slate-200/60 bg-white p-5 h-32"
          >
            <div className="h-8 w-8 bg-slate-200 rounded-lg mb-3"></div>
            <div className="h-4 w-24 bg-slate-200 rounded mb-2"></div>
            <div className="h-8 w-16 bg-slate-200 rounded"></div>
          </div>
        ))}
      </div>

      {/* Chart skeleton */}
      <div className="rounded-2xl border border-slate-200/60 bg-white p-8">
        <div className="h-6 w-48 bg-slate-200 rounded mb-6"></div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-4 w-20 bg-slate-200 rounded"></div>
              <div
                className="h-8 bg-slate-200 rounded"
                style={{ width: `${Math.random() * 60 + 20}%` }}
              ></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Analytics View Component
function AnalyticsView({
  facilities,
  isLoading,
  onSportClick,
}: {
  facilities: FacilityLightweight[];
  isLoading: boolean;
  onSportClick: (sport: string) => void;
}) {
  const analytics = calculateSportAnalytics(facilities);

  // Show skeleton while loading
  if (isLoading || facilities.length === 0) {
    return <AnalyticsSkeletonLoader />;
  }

  // Limit to top 25 sports for chart readability
  const chartData = analytics.sportData.slice(0, 25);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        <SummaryCard
          label="Unique Sports"
          value={analytics.totalUniqueSports}
          icon={BarChart3}
        />
        <SummaryCard
          label="Top Sport"
          value={`${analytics.topSport.name} (${analytics.topSport.count})`}
          icon={Star}
        />
        <SummaryCard
          label="Total Facilities"
          value={analytics.totalFacilities}
          icon={Building2}
        />
        <SummaryCard
          label="Without Sports"
          value={analytics.facilitiesWithoutSports}
          icon={FileText}
        />
      </div>

      {/* Main Chart */}
      <div className="rounded-2xl border border-slate-200/60 bg-white p-8 shadow-sm">
        <div className="mb-6">
          <h3 className="text-xl font-bold text-slate-900">
            Facilities by Sport
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            Top {chartData.length} sports across all facilities
            {analytics.sportData.length > 25 && (
              <span className="ml-1 text-slate-400">
                (showing top 25 of {analytics.sportData.length})
              </span>
            )}
          </p>
        </div>

        <ResponsiveContainer
          width="100%"
          height={Math.max(400, chartData.length * 35)}
        >
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 120, bottom: 5 }}
          >
            <XAxis type="number" />
            <YAxis
              dataKey="sport"
              type="category"
              width={110}
              tick={{ fontSize: 12, fill: "#475569" }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "white",
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
              }}
              formatter={(value: number | undefined) => [
                `${value ?? 0} facilities`,
                "Count",
              ]}
              labelStyle={{ fontWeight: 600, color: "#1e293b" }}
            />
            <Bar
              dataKey="count"
              radius={[0, 8, 8, 0]}
              onClick={(data: any) => {
                if (data && data.sport) {
                  onSportClick(data.sport);
                }
              }}
              cursor="pointer"
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={`hsl(${217 + index * 5}, 91%, ${60 - index * 0.5}%)`}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Sport Statistics Table */}
      <div className="rounded-2xl border border-slate-200/60 bg-white shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200/60">
          <h3 className="text-xl font-bold text-slate-900">
            Complete Sport Statistics
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            All {analytics.sportData.length} sports identified across facilities
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 uppercase tracking-wider border-b border-slate-200/60 bg-slate-50/50">
                <th className="px-6 py-4 font-semibold text-slate-600">Rank</th>
                <th className="px-6 py-4 font-semibold text-slate-600">
                  Sport
                </th>
                <th className="px-6 py-4 font-semibold text-slate-600 text-right">
                  Facilities
                </th>
                <th className="px-6 py-4 font-semibold text-slate-600 text-right">
                  % of Total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {analytics.sportData.map((item, index) => (
                <motion.tr
                  key={item.sport}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.01 }}
                  onClick={() => onSportClick(item.sport)}
                  className="hover:bg-slate-50/60 transition-colors cursor-pointer"
                >
                  <td className="px-6 py-3 text-slate-500 font-medium">
                    #{index + 1}
                  </td>
                  <td className="px-6 py-3 font-semibold text-slate-800">
                    {item.sport}
                  </td>
                  <td className="px-6 py-3 text-right tabular-nums font-bold text-slate-900">
                    {item.count.toLocaleString()}
                  </td>
                  <td className="px-6 py-3 text-right tabular-nums text-slate-600">
                    {item.percentage}%
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}

// Load filters from localStorage
function loadFiltersFromStorage(): FilterState {
  if (typeof window === "undefined") {
    return getDefaultFilters();
  }
  try {
    const stored = localStorage.getItem("crm-filters");
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error("Failed to load filters from localStorage:", error);
  }
  return getDefaultFilters();
}

// Get default filter state
function getDefaultFilters(): FilterState {
  return {
    searchQuery: "",
    selectedSports: [],
    addressSearch: "",
    minRating: null,
    minReviews: null,
    selectedTags: [],
    hasNotes: null,
  };
}

export default function CRMView({ isVisible }: { isVisible: boolean }) {
  const [activeTab, setActiveTab] = useState("facilities");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(100);
  const [isFiltersSidebarOpen, setIsFiltersSidebarOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>(getDefaultFilters);
  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(
    null,
  );
  const [selectedSport, setSelectedSport] = useState<string | null>(null);
  const [isAddFacilitySidebarOpen, setIsAddFacilitySidebarOpen] =
    useState(false);
  const { setLoadingComplete } = useLoading();
  const router = useRouter();

  // Hydrate filters from localStorage after mount to avoid hydration mismatch
  useEffect(() => {
    const stored = loadFiltersFromStorage();
    if (JSON.stringify(stored) !== JSON.stringify(getDefaultFilters())) {
      setFilters(stored);
    }
  }, []);

  // Handler to open facility details and close filters
  const handleOpenDetails = (placeId: string) => {
    setIsFiltersSidebarOpen(false); // Auto-close filters sidebar
    setSelectedFacilityId(placeId);
  };

  // Handler to view facility on map
  const handleViewOnMap = (placeId: string) => {
    router.push(`/?focus=${placeId}`);
  };

  // Handler for facility selection from search
  const handleSearchSelect = (facility: Facility) => {
    handleOpenDetails(facility.place_id);
  };

  // Handler to open sport facilities sidebar
  const handleSportClick = (sport: string) => {
    setIsFiltersSidebarOpen(false); // Close filters sidebar
    setSelectedSport(sport);
  };

  // Use shared facilities hook (same data as MapView)
  const {
    facilities: allFacilities,
    isPriorityLoading,
    isBackgroundLoading,
    backgroundLoadingComplete,
    priorityLoadingProgress,
    backgroundLoadingProgress,
    isError,
    error,
    isBackgroundError,
    retryBackgroundLoading,
  } = useFacilities();

  // Convert Facility[] to FacilityLightweight[] (they have the same structure)
  const facilities = allFacilities as unknown as FacilityLightweight[];

  // Filter facilities by selected sport (with deduplication to prevent duplicate keys)
  const sportFacilities = selectedSport
    ? Array.from(
        new Map<string, FacilityLightweight>(
          facilities
            .filter((f) => f.identified_sports?.includes(selectedSport))
            .map((facility) => [facility.place_id, facility]),
        ).values(),
      )
    : [];

  // Signal loading complete when background loading finishes
  useEffect(() => {
    if (backgroundLoadingComplete) {
      setLoadingComplete();
    }
  }, [backgroundLoadingComplete, setLoadingComplete]);

  // Save filters to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem("crm-filters", JSON.stringify(filters));
    } catch (error) {
      console.error("Failed to save filters to localStorage:", error);
    }
  }, [filters]);

  // Extract unique sports from facilities
  const availableSports = Array.from(
    new Set(facilities.flatMap((f) => f.identified_sports || [])),
  ).sort();

  // Apply all filters
  const filteredFacilities = facilities.filter((facility) => {
    // Name search
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      const matchesName = facility.name?.toLowerCase().includes(query);
      if (!matchesName) return false;
    }

    // Sports filter
    if (filters.selectedSports.length > 0) {
      const hasSport = filters.selectedSports.some((sport) =>
        facility.identified_sports?.includes(sport),
      );
      if (!hasSport) return false;
    }

    // Address search
    if (filters.addressSearch) {
      const query = filters.addressSearch.toLowerCase();
      const matchesAddress = facility.address?.toLowerCase().includes(query);
      if (!matchesAddress) return false;
    }

    // Min rating
    if (filters.minRating !== null) {
      if (!facility.rating || facility.rating < filters.minRating) return false;
    }

    // Min reviews
    if (filters.minReviews !== null) {
      if (
        !facility.user_ratings_total ||
        facility.user_ratings_total < filters.minReviews
      )
        return false;
    }

    // Tags filter
    if (filters.selectedTags.length > 0) {
      const facilityTagIds = facility.tags?.map((t) => t.id) || [];
      const hasTag = filters.selectedTags.some((tagId) =>
        facilityTagIds.includes(tagId),
      );
      if (!hasTag) return false;
    }

    // Has notes filter
    if (filters.hasNotes !== null) {
      if (filters.hasNotes && !facility.has_notes) return false;
      if (!filters.hasNotes && facility.has_notes) return false;
    }

    return true;
  });

  // Reset to page 1 when filters change
  const previousFilters = useRef(filters);
  useEffect(() => {
    if (JSON.stringify(previousFilters.current) !== JSON.stringify(filters)) {
      setCurrentPage(1);
      previousFilters.current = filters;
    }
  }, [filters]);

  // Count active filters
  const activeFilterCount =
    (filters.searchQuery ? 1 : 0) +
    filters.selectedSports.length +
    (filters.addressSearch ? 1 : 0) +
    (filters.minRating !== null ? 1 : 0) +
    (filters.minReviews !== null ? 1 : 0) +
    filters.selectedTags.length +
    (filters.hasNotes !== null ? 1 : 0);

  // Calculate pagination
  const totalPages = Math.ceil(filteredFacilities.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedFacilities = filteredFacilities.slice(startIndex, endIndex);

  const facilitiesWithNotes = facilities.filter((f) => f.has_notes).length;

  // Calculate display count for "Total Facilities" card
  // During priority loading: show incremental priority progress
  // During background loading: show current facilities + background progress
  // After loading completes: show actual total
  const displayTotalFacilities = isPriorityLoading
    ? priorityLoadingProgress
    : isBackgroundLoading
    ? facilities.length + backgroundLoadingProgress
    : facilities.length;

  // Show error state (only for critical errors, not for loading)
  if (isError && !isPriorityLoading) {
    return (
      <div
        className={`w-full min-h-screen bg-white font-poppins text-slate-900 ${!isVisible ? "hidden" : ""} flex items-center justify-center`}
      >
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">
            ❌ Error loading facilities
          </div>
          <p className="text-gray-600">{error?.message || "Unknown error"}</p>
        </div>
      </div>
    );
  }

  // Determine if we should show loading state
  const isLoadingData = isPriorityLoading;
  const showSkeletonRows =
    isLoadingData || (isBackgroundLoading && facilities.length === 0);

  return (
    <div
      className={`w-full min-h-screen bg-white font-poppins text-slate-900 ${!isVisible ? "hidden" : ""}`}
    >
      {/* Filters Sidebar */}
      <FiltersSidebar
        isOpen={isFiltersSidebarOpen}
        onClose={() => setIsFiltersSidebarOpen(false)}
        filters={filters}
        onFiltersChange={setFilters}
        availableSports={availableSports}
      />

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
            <div className="grid grid-cols-2 gap-5">
              <SummaryCard
                label="Total Facilities"
                value={displayTotalFacilities}
                icon={Building2}
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
                <div className="flex items-center gap-3">
                  {/* Priority loading indicator */}
                  {isPriorityLoading && (
                    <div className="text-sm text-slate-600 font-medium">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg border border-blue-200">
                        <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-blue-600"></div>
                        Loading priority facilities... ({priorityLoadingProgress.toLocaleString()} loaded)
                      </span>
                    </div>
                  )}
                  {/* Background loading indicator */}
                  {!isPriorityLoading && isBackgroundLoading && (
                    <div className="text-sm text-slate-600 font-medium">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg border border-blue-200">
                        <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-blue-600"></div>
                        Loading more facilities... ({backgroundLoadingProgress.toLocaleString()} loaded)
                      </span>
                    </div>
                  )}
                  {/* Background error with retry */}
                  {!isPriorityLoading && isBackgroundError && !isBackgroundLoading && (
                    <div className="text-sm text-slate-600 font-medium">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 rounded-lg border border-red-200">
                        Failed to load remaining facilities
                        <button
                          onClick={() => retryBackgroundLoading()}
                          className="ml-2 px-2 py-0.5 bg-red-600 text-white text-xs font-semibold rounded hover:bg-red-700 transition-colors"
                        >
                          Retry
                        </button>
                      </span>
                    </div>
                  )}
                  {/* Active filters indicator */}
                  {!isPriorityLoading && !isBackgroundLoading && activeFilterCount > 0 && (
                    <div className="text-sm text-slate-600 font-medium">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg border border-blue-200">
                        <Filter className="h-3.5 w-3.5" />
                        {activeFilterCount} active filter
                        {activeFilterCount !== 1 ? "s" : ""}
                      </span>
                    </div>
                  )}
                  {!isPriorityLoading && !isBackgroundLoading && activeFilterCount === 0 && (
                    <div className="text-sm text-slate-500 font-medium">
                      No filters applied
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <FacilitySearch
                    facilities={facilities as unknown as Facility[]}
                    onSelectFacility={handleSearchSelect}
                  />
                  <button
                    onClick={() => setIsFiltersSidebarOpen(true)}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 transition-colors shadow-sm active:bg-slate-100 relative"
                  >
                    <Filter className="h-4 w-4 text-slate-500" />
                    Filters
                    {activeFilterCount > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
                        {activeFilterCount}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => setIsAddFacilitySidebarOpen(true)}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm active:bg-blue-800"
                  >
                    <Plus className="h-4 w-4" />
                    Add Facility
                  </button>
                </div>
              </div>

              {/* Table */}
              <FacilityTable
                facilities={paginatedFacilities}
                onOpenDetails={handleOpenDetails}
                onViewOnMap={handleViewOnMap}
                isLoading={showSkeletonRows}
              />

              {/* Pagination Controls */}
              {filteredFacilities.length > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200">
                  {/* Results Info */}
                  <div className="text-sm text-slate-600 font-medium">
                    Showing {startIndex + 1}-
                    {Math.min(endIndex, filteredFacilities.length)} of{" "}
                    {filteredFacilities.length} facilities
                  </div>

                  {/* Page Controls */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </button>

                    <div className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700">
                      Page{" "}
                      <span className="font-bold text-slate-900">
                        {currentPage}
                      </span>{" "}
                      of{" "}
                      <span className="font-bold text-slate-900">
                        {totalPages}
                      </span>
                    </div>

                    <button
                      onClick={() =>
                        setCurrentPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={currentPage === totalPages}
                      className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Items per page selector */}
                  <div className="flex items-center gap-2 text-sm">
                    <label
                      htmlFor="itemsPerPage"
                      className="text-slate-600 font-medium"
                    >
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
        ) : activeTab === "analytics" ? (
          <AnalyticsView
            facilities={facilities}
            isLoading={showSkeletonRows}
            onSportClick={handleSportClick}
          />
        ) : activeTab === "close" ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <CloseCRMExplorer facilities={facilities as unknown as Facility[]} />
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center justify-center py-24"
          >
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-slate-50 border border-slate-100 mb-6 shadow-sm">
                {(() => {
                  const TabIcon =
                    TABS.find((t) => t.id === activeTab)?.icon || BarChart3;
                  return <TabIcon className="h-10 w-10 text-slate-400" />;
                })()}
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

      {/* Facility Details Sidebar */}
      <CRMFacilityDetailsSidebar
        placeId={selectedFacilityId}
        onClose={() => setSelectedFacilityId(null)}
      />

      {/* Sport Facilities Sidebar */}
      <SportFacilitiesSidebar
        sport={selectedSport}
        onClose={() => setSelectedSport(null)}
        facilities={sportFacilities}
        onFacilityClick={(placeId) => {
          setSelectedSport(null); // Close sport sidebar
          setSelectedFacilityId(placeId); // Open facility details
        }}
      />

      {/* Add Facility Sidebar */}
      <AddFacilitySidebar
        isOpen={isAddFacilitySidebarOpen}
        onClose={() => setIsAddFacilitySidebarOpen(false)}
        onSuccess={(placeId) => {
          setIsAddFacilitySidebarOpen(false);
          // Optionally open the new facility in details sidebar
          setSelectedFacilityId(placeId);
        }}
      />
    </div>
  );
}
