"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Phone, Filter } from "lucide-react";
import CallModal from "./CallModal";

// Mock call queue data
const MOCK_CALL_QUEUE = [
  {
    id: "1",
    facilityName: "Elite Sports Complex",
    priority: "High",
    sports: ["Basketball", "Volleyball"],
    lastContact: "2024-02-20",
    phone: "(512) 555-0123",
    leadScore: 85,
    place_id: "mock-1",
  },
  {
    id: "2",
    facilityName: "Austin Athletic Center",
    priority: "High",
    sports: ["Soccer", "Track & Field"],
    lastContact: "Never",
    phone: "(512) 555-0456",
    leadScore: 78,
    place_id: "mock-2",
  },
  {
    id: "3",
    facilityName: "Westlake Recreation Facility",
    priority: "Medium",
    sports: ["Tennis", "Swimming"],
    lastContact: "2024-02-15",
    phone: "(512) 555-0789",
    leadScore: 65,
    place_id: "mock-3",
  },
  {
    id: "4",
    facilityName: "Round Rock Sports Academy",
    priority: "High",
    sports: ["Basketball", "Baseball"],
    lastContact: "2024-02-22",
    phone: "(512) 555-0111",
    leadScore: 82,
    place_id: "mock-4",
  },
  {
    id: "5",
    facilityName: "Cedar Park Athletic Complex",
    priority: "Medium",
    sports: ["Soccer", "Lacrosse"],
    lastContact: "2024-02-18",
    phone: "(512) 555-0222",
    leadScore: 70,
    place_id: "mock-5",
  },
  {
    id: "6",
    facilityName: "Georgetown Fitness Hub",
    priority: "Low",
    sports: ["Gym/Fitness", "Yoga"],
    lastContact: "2024-02-10",
    phone: "(512) 555-0333",
    leadScore: 55,
    place_id: "mock-6",
  },
  {
    id: "7",
    facilityName: "Pflugerville Sports Center",
    priority: "High",
    sports: ["Basketball", "Volleyball", "Wrestling"],
    lastContact: "Never",
    phone: "(512) 555-0444",
    leadScore: 88,
    place_id: "mock-7",
  },
  {
    id: "8",
    facilityName: "Lakeway Activity Center",
    priority: "Medium",
    sports: ["Swimming", "Tennis"],
    lastContact: "2024-02-12",
    phone: "(512) 555-0555",
    leadScore: 62,
    place_id: "mock-8",
  },
];

const getPriorityColor = (priority: string) => {
  if (priority === "High") return "bg-red-100 text-red-700 border-red-200";
  if (priority === "Medium") return "bg-yellow-100 text-yellow-700 border-yellow-200";
  return "bg-blue-100 text-blue-700 border-blue-200";
};

const getLeadScoreColor = (score: number) => {
  if (score >= 80) return "bg-green-600";
  if (score >= 60) return "bg-yellow-500";
  return "bg-gray-400";
};

export default function CallQueueView() {
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [selectedFacility, setSelectedFacility] = useState<typeof MOCK_CALL_QUEUE[0] | null>(null);
  const [isCallModalOpen, setIsCallModalOpen] = useState(false);

  const handleCallNow = (facility: typeof MOCK_CALL_QUEUE[0]) => {
    setSelectedFacility(facility);
    setIsCallModalOpen(true);
  };

  const filteredQueue = MOCK_CALL_QUEUE.filter((item) => {
    if (selectedFilter === "all") return true;
    if (selectedFilter === "high-priority") return item.priority === "High";
    if (selectedFilter === "follow-ups") return item.lastContact !== "Never";
    if (selectedFilter === "not-contacted") return item.lastContact === "Never";
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Call Queue</h2>
          <p className="text-sm text-slate-500 mt-1">
            {filteredQueue.length} facilities ready to contact
          </p>
        </div>
      </div>

      {/* Filter Buttons */}
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-slate-500" />
        <div className="flex gap-2">
          {[
            { id: "all", label: "All" },
            { id: "high-priority", label: "High Priority" },
            { id: "follow-ups", label: "Follow-ups" },
            { id: "not-contacted", label: "Not Contacted" },
          ].map((filter) => (
            <button
              key={filter.id}
              onClick={() => setSelectedFilter(filter.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                selectedFilter === filter.id
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Call Queue Table */}
      <div className="rounded-2xl border border-slate-200/60 bg-white shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 uppercase tracking-wider border-b border-slate-200/60 bg-slate-50/50">
              <th className="px-5 py-4 font-semibold text-slate-600">Facility Name</th>
              <th className="px-5 py-4 font-semibold text-slate-600">Priority</th>
              <th className="px-5 py-4 font-semibold text-slate-600">Sports</th>
              <th className="px-5 py-4 font-semibold text-slate-600">Last Contact</th>
              <th className="px-5 py-4 font-semibold text-slate-600">Phone</th>
              <th className="px-5 py-4 font-semibold text-slate-600">Lead Score</th>
              <th className="px-5 py-4 font-semibold text-slate-600 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredQueue.map((item, index) => (
              <motion.tr
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="hover:bg-slate-50/60 transition-colors group"
              >
                <td className="px-5 py-4">
                  <div className="font-semibold text-slate-800 group-hover:text-blue-600 transition-colors">
                    {item.facilityName}
                  </div>
                </td>
                <td className="px-5 py-4">
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${getPriorityColor(
                      item.priority,
                    )}`}
                  >
                    {item.priority}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <div className="flex flex-wrap gap-1">
                    {item.sports.map((sport) => (
                      <span
                        key={sport}
                        className="text-[10px] bg-blue-50 text-blue-700 font-semibold px-2 py-0.5 rounded uppercase tracking-wide border border-blue-100"
                      >
                        {sport}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-5 py-4">
                  <span
                    className={`tabular-nums text-slate-600 ${
                      item.lastContact === "Never" ? "text-gray-400 italic" : ""
                    }`}
                  >
                    {item.lastContact === "Never"
                      ? "Never"
                      : new Date(item.lastContact).toLocaleDateString()}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <a
                    href={`tel:${item.phone}`}
                    className="text-blue-600 hover:text-blue-700 font-medium tabular-nums"
                  >
                    {item.phone}
                  </a>
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-slate-100 rounded-full h-2 w-16">
                      <div
                        className={`h-full rounded-full ${getLeadScoreColor(item.leadScore)}`}
                        style={{ width: `${item.leadScore}%` }}
                      />
                    </div>
                    <span className="font-bold text-slate-800 tabular-nums text-sm">
                      {item.leadScore}
                    </span>
                  </div>
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center justify-end">
                    <button
                      onClick={() => handleCallNow(item)}
                      className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors shadow-sm"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      Call Now
                    </button>
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Call Modal */}
      {selectedFacility && (
        <CallModal
          isOpen={isCallModalOpen}
          onClose={() => {
            setIsCallModalOpen(false);
            setSelectedFacility(null);
          }}
          facility={selectedFacility}
        />
      )}
    </div>
  );
}
