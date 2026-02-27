"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Mail, MessageSquare, Layers, Save, Rocket } from "lucide-react";

interface CreateCampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CreateCampaignModal({ isOpen, onClose }: CreateCampaignModalProps) {
  const [campaignName, setCampaignName] = useState("");
  const [selectedChannel, setSelectedChannel] = useState<"email" | "sms" | "multi">("email");
  const [selectedTemplate, setSelectedTemplate] = useState("");

  const handleSaveDraft = () => {
    console.log("Save as draft clicked");
    onClose();
  };

  const handleLaunch = () => {
    console.log("Launch campaign clicked");
    onClose();
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
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-white rounded-2xl shadow-2xl z-50 max-h-[90vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Create New Campaign</h2>
                <p className="text-sm text-slate-500 mt-1">
                  Set up an automated outreach campaign
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Campaign Name */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Campaign Name
                </label>
                <input
                  type="text"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder="e.g., Initial Outreach - Basketball Facilities"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>

              {/* Channel Selection */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-3">
                  Channel
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => setSelectedChannel("email")}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      selectedChannel === "email"
                        ? "border-blue-600 bg-blue-50"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <Mail className={`h-6 w-6 mx-auto mb-2 ${
                      selectedChannel === "email" ? "text-blue-600" : "text-slate-500"
                    }`} />
                    <div className={`text-sm font-semibold ${
                      selectedChannel === "email" ? "text-blue-700" : "text-slate-700"
                    }`}>
                      Email
                    </div>
                  </button>

                  <button
                    onClick={() => setSelectedChannel("sms")}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      selectedChannel === "sms"
                        ? "border-purple-600 bg-purple-50"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <MessageSquare className={`h-6 w-6 mx-auto mb-2 ${
                      selectedChannel === "sms" ? "text-purple-600" : "text-slate-500"
                    }`} />
                    <div className={`text-sm font-semibold ${
                      selectedChannel === "sms" ? "text-purple-700" : "text-slate-700"
                    }`}>
                      SMS
                    </div>
                  </button>

                  <button
                    onClick={() => setSelectedChannel("multi")}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      selectedChannel === "multi"
                        ? "border-green-600 bg-green-50"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <Layers className={`h-6 w-6 mx-auto mb-2 ${
                      selectedChannel === "multi" ? "text-green-600" : "text-slate-500"
                    }`} />
                    <div className={`text-sm font-semibold ${
                      selectedChannel === "multi" ? "text-green-700" : "text-slate-700"
                    }`}>
                      Multi-channel
                    </div>
                  </button>
                </div>
              </div>

              {/* Template Selection */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Starting Template (Optional)
                </label>
                <select
                  value={selectedTemplate}
                  onChange={(e) => setSelectedTemplate(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white"
                >
                  <option value="">Select a template...</option>
                  <option value="initial">Initial Introduction Email</option>
                  <option value="followup">Follow-up Email</option>
                  <option value="sms-intro">Quick SMS Introduction</option>
                  <option value="case-study">Case Study Email</option>
                  <option value="meeting">Meeting Request Email</option>
                </select>
                <p className="text-xs text-slate-500 mt-2">
                  You can customize the template after creating the campaign
                </p>
              </div>

              {/* Target Audience (Placeholder) */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Target Audience
                </label>
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                  <p className="text-sm text-slate-600">
                    Select facilities from the CRM view and use "Enroll in Campaign" to add them to this campaign after creation.
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-200 bg-slate-50">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-semibold text-slate-700 hover:text-slate-900 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveDraft}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 transition-colors"
              >
                <Save className="h-4 w-4" />
                Save as Draft
              </button>
              <button
                onClick={handleLaunch}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm"
              >
                <Rocket className="h-4 w-4" />
                Create & Launch
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
