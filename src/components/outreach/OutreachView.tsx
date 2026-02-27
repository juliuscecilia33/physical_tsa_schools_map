"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, Phone, FileText } from "lucide-react";
import CampaignsView from "./CampaignsView";
import CallQueueView from "./CallQueueView";
import TemplatesView from "./TemplatesView";

const cn = (...classes: (string | undefined | null | false)[]) =>
  classes.filter(Boolean).join(" ");

const OUTREACH_TABS = [
  { id: "campaigns", label: "Campaigns", icon: Mail },
  { id: "call-queue", label: "Call Queue", icon: Phone },
  { id: "templates", label: "Templates", icon: FileText },
];

export default function OutreachView() {
  const [activeTab, setActiveTab] = useState("campaigns");

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      {/* Sub-tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {OUTREACH_TABS.map((tab) => {
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

      {/* Content */}
      {activeTab === "campaigns" && <CampaignsView />}
      {activeTab === "call-queue" && <CallQueueView />}
      {activeTab === "templates" && <TemplatesView />}
    </motion.div>
  );
}
