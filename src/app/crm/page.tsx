"use client";

import { useState } from "react";
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
} from "lucide-react";
import { Facility } from "@/types/facility";

const cn = (...classes: (string | undefined | null | false)[]) =>
  classes.filter(Boolean).join(" ");

const TABS = [
  { id: "facilities", label: "Facilities", icon: Building2 },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "users", label: "Users", icon: Users },
  { id: "settings", label: "Settings", icon: Settings },
];

const mockFacilities: Partial<Facility>[] = [
  {
    place_id: "ChIJ123456789",
    name: "Elite Performance Training Center",
    sport_types: ["gym", "sports_complex"],
    identified_sports: ["Basketball", "Volleyball", "Performance Training"],
    address: "123 Sports Way, Dallas, TX 75201",
    location: { lat: 32.7767, lng: -96.797 },
    phone: "(214) 555-0123",
    website: "https://eliteperformance.com",
    rating: 4.8,
    user_ratings_total: 142,
    photo_references: Array(12).fill(""),
    tags: [
      { id: "1", name: "High Priority", color: "#ef4444" },
      { id: "2", name: "Contacted", color: "#3b82f6" },
    ],
    has_notes: true,
  },
  {
    place_id: "ChIJ987654321",
    name: "Texas Strike Baseball",
    sport_types: ["baseball_field"],
    identified_sports: ["Baseball", "Softball", "Batting Cages"],
    address: "456 Diamond Blvd, Austin, TX 78701",
    location: { lat: 30.2672, lng: -97.7431 },
    phone: "(512) 555-0456",
    website: "https://txstrikebaseball.com",
    rating: 4.5,
    user_ratings_total: 89,
    photo_references: Array(8).fill(""),
    tags: [{ id: "3", name: "Needs Review", color: "#f59e0b" }],
    has_notes: false,
  },
  {
    place_id: "ChIJabcdefghi",
    name: "Lone Star Soccer Complex",
    sport_types: ["soccer_field"],
    identified_sports: ["Soccer"],
    address: "789 Goal St, Houston, TX 78702",
    location: { lat: 29.7604, lng: -95.3698 },
    phone: "(713) 555-0789",
    rating: 4.2,
    user_ratings_total: 315,
    photo_references: Array(25).fill(""),
    tags: [],
    has_notes: true,
  },
  {
    place_id: "ChIJjklmnopqr",
    name: "Austin Tennis Center",
    sport_types: ["tennis_court"],
    identified_sports: ["Tennis", "Pickleball"],
    address: "321 Racket Ln, Austin, TX 78759",
    location: { lat: 30.4015, lng: -97.7268 },
    phone: "(512) 555-9999",
    website: "https://austintennis.org",
    rating: 4.7,
    user_ratings_total: 420,
    photo_references: Array(18).fill(""),
    tags: [{ id: "1", name: "High Priority", color: "#ef4444" }],
    has_notes: false,
  },
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

function FacilityTable({ facilities }: { facilities: Partial<Facility>[] }) {
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
              Sports & Tags
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

                <td className="px-4 py-3 align-top min-w-[200px]">
                  <div className="flex flex-wrap gap-1.5 mb-2">
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
                  {facility.tags && facility.tags.length > 0 && (
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
                          (facility.additional_photos?.length || 0)}{" "}
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
                colSpan={5}
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
              colSpan={3}
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

export default function CRMPage() {
  const [activeTab, setActiveTab] = useState("facilities");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredFacilities = mockFacilities.filter(
    (f) =>
      f.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.address?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const totalReviews = mockFacilities.reduce(
    (sum, f) => sum + (f.user_ratings_total || 0),
    0,
  );
  const facilitiesWithNotes = mockFacilities.filter((f) => f.has_notes).length;

  return (
    <div className="w-full min-h-screen bg-white font-poppins text-slate-900">
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
                value={mockFacilities.length}
                icon={Building2}
              />
              <SummaryCard
                label="Avg Rating"
                value={(
                  mockFacilities.reduce((sum, f) => sum + (f.rating || 0), 0) /
                  mockFacilities.length
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
              <FacilityTable facilities={filteredFacilities} />
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
