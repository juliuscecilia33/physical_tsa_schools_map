"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Play, Pause, Edit, Trash2, Mail, MessageSquare, Layers } from "lucide-react";
import CreateCampaignModal from "./CreateCampaignModal";

// Mock campaign data
const MOCK_CAMPAIGNS = [
  {
    id: "1",
    name: "Initial Outreach - Basketball Facilities",
    channel: "Email",
    status: "Active",
    enrolled: 45,
    responseRate: 18,
    createdDate: "2024-02-15",
  },
  {
    id: "2",
    name: "Follow-up Sequence - High Priority",
    channel: "Multi-channel",
    status: "Active",
    enrolled: 23,
    responseRate: 34,
    createdDate: "2024-02-20",
  },
  {
    id: "3",
    name: "SMS Quick Touch - Soccer Venues",
    channel: "SMS",
    status: "Paused",
    enrolled: 67,
    responseRate: 12,
    createdDate: "2024-02-10",
  },
  {
    id: "4",
    name: "Re-engagement Campaign",
    channel: "Email",
    status: "Draft",
    enrolled: 0,
    responseRate: 0,
    createdDate: "2024-02-25",
  },
  {
    id: "5",
    name: "Premium Facilities Outreach",
    channel: "Multi-channel",
    status: "Active",
    enrolled: 31,
    responseRate: 22,
    createdDate: "2024-02-18",
  },
];

const getChannelIcon = (channel: string) => {
  if (channel === "Email") return <Mail className="h-4 w-4" />;
  if (channel === "SMS") return <MessageSquare className="h-4 w-4" />;
  return <Layers className="h-4 w-4" />;
};

const getStatusColor = (status: string) => {
  if (status === "Active") return "bg-green-100 text-green-700 border-green-200";
  if (status === "Paused") return "bg-yellow-100 text-yellow-700 border-yellow-200";
  return "bg-gray-100 text-gray-700 border-gray-200";
};

export default function CampaignsView() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  return (
    <div className="space-y-6">
      {/* Header with Create Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Campaigns</h2>
          <p className="text-sm text-slate-500 mt-1">
            Manage your automated outreach campaigns
          </p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Plus className="h-4 w-4" />
          Create Campaign
        </button>
      </div>

      {/* Campaigns Table */}
      <div className="rounded-2xl border border-slate-200/60 bg-white shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 uppercase tracking-wider border-b border-slate-200/60 bg-slate-50/50">
              <th className="px-5 py-4 font-semibold text-slate-600">Campaign Name</th>
              <th className="px-5 py-4 font-semibold text-slate-600">Channel</th>
              <th className="px-5 py-4 font-semibold text-slate-600">Status</th>
              <th className="px-5 py-4 font-semibold text-slate-600">Enrolled</th>
              <th className="px-5 py-4 font-semibold text-slate-600">Response Rate</th>
              <th className="px-5 py-4 font-semibold text-slate-600">Created</th>
              <th className="px-5 py-4 font-semibold text-slate-600 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {MOCK_CAMPAIGNS.map((campaign, index) => (
              <motion.tr
                key={campaign.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="hover:bg-slate-50/60 transition-colors group"
              >
                <td className="px-5 py-4">
                  <div className="font-semibold text-slate-800 group-hover:text-blue-600 transition-colors">
                    {campaign.name}
                  </div>
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2 text-slate-600">
                    {getChannelIcon(campaign.channel)}
                    <span className="font-medium">{campaign.channel}</span>
                  </div>
                </td>
                <td className="px-5 py-4">
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusColor(
                      campaign.status,
                    )}`}
                  >
                    {campaign.status}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <span className="font-bold text-slate-800 tabular-nums">
                    {campaign.enrolled}
                  </span>
                  <span className="text-slate-500 text-xs ml-1">facilities</span>
                </td>
                <td className="px-5 py-4">
                  <span className="font-bold text-slate-800 tabular-nums">
                    {campaign.responseRate}%
                  </span>
                </td>
                <td className="px-5 py-4">
                  <span className="text-slate-600 tabular-nums">
                    {new Date(campaign.createdDate).toLocaleDateString()}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit campaign"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      className="p-2 text-slate-500 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors"
                      title={campaign.status === "Active" ? "Pause campaign" : "Resume campaign"}
                    >
                      {campaign.status === "Active" ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete campaign"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create Campaign Modal */}
      <CreateCampaignModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </div>
  );
}
