"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, MessageSquare, Phone, FileText, Plus, ChevronDown, ChevronUp } from "lucide-react";

// Mock communication data
const MOCK_COMMUNICATIONS = [
  {
    id: "1",
    type: "email",
    timestamp: "2024-02-25T14:30:00",
    subject: "Initial Partnership Inquiry",
    status: "opened",
    details: "Email opened 3 times, clicked 'Learn More' link",
  },
  {
    id: "2",
    type: "sms",
    timestamp: "2024-02-22T10:15:00",
    message: "Hi! Quick follow-up on our partnership opportunity...",
    status: "delivered",
    reply: "Interested! Can you call me tomorrow?",
  },
  {
    id: "3",
    type: "call",
    timestamp: "2024-02-20T15:45:00",
    outcome: "Interested",
    duration: "12 min",
    notes: "Spoke with facility manager. Very interested in basketball programs. Scheduled follow-up meeting for next week.",
  },
  {
    id: "4",
    type: "email",
    timestamp: "2024-02-18T09:00:00",
    subject: "TSA Partnership Opportunity",
    status: "sent",
    details: "Email sent, not yet opened",
  },
  {
    id: "5",
    type: "note",
    timestamp: "2024-02-15T16:20:00",
    note: "Found facility via Google Maps. High priority - has excellent basketball courts and good reviews.",
  },
];

const getIcon = (type: string) => {
  switch (type) {
    case "email":
      return <Mail className="h-4 w-4" />;
    case "sms":
      return <MessageSquare className="h-4 w-4" />;
    case "call":
      return <Phone className="h-4 w-4" />;
    case "note":
      return <FileText className="h-4 w-4" />;
    default:
      return <FileText className="h-4 w-4" />;
  }
};

const getIconColor = (type: string) => {
  switch (type) {
    case "email":
      return "bg-blue-100 text-blue-600";
    case "sms":
      return "bg-purple-100 text-purple-600";
    case "call":
      return "bg-green-100 text-green-600";
    case "note":
      return "bg-gray-100 text-gray-600";
    default:
      return "bg-gray-100 text-gray-600";
  }
};

const formatTimestamp = (timestamp: string) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return `Today at ${date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
  } else if (diffDays === 1) {
    return "Yesterday";
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
};

export default function CommunicationTimeline() {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [showAddActivity, setShowAddActivity] = useState(false);

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
          Communication History
        </h3>
        <div className="relative">
          <button
            onClick={() => setShowAddActivity(!showAddActivity)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Activity
          </button>

          {/* Add Activity Dropdown */}
          <AnimatePresence>
            {showAddActivity && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-slate-200 py-2 z-10"
              >
                {[
                  { icon: Mail, label: "Log Email", color: "blue" },
                  { icon: MessageSquare, label: "Log SMS", color: "purple" },
                  { icon: Phone, label: "Log Call", color: "green" },
                  { icon: FileText, label: "Add Note", color: "gray" },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.label}
                      onClick={() => {
                        console.log(`Add ${item.label}`);
                        setShowAddActivity(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <Icon className={`h-4 w-4 text-${item.color}-600`} />
                      {item.label}
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Timeline */}
      <div className="relative space-y-4">
        {/* Timeline Line */}
        <div className="absolute left-5 top-0 bottom-0 w-px bg-slate-200" />

        {/* Timeline Items */}
        {MOCK_COMMUNICATIONS.map((item, index) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className="relative pl-12"
          >
            {/* Icon */}
            <div
              className={`absolute left-0 top-0 w-10 h-10 rounded-full flex items-center justify-center ${getIconColor(
                item.type,
              )} border-2 border-white shadow-sm`}
            >
              {getIcon(item.type)}
            </div>

            {/* Content Card */}
            <div className="bg-white border border-slate-200 rounded-lg p-3 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-slate-900 uppercase">
                      {item.type}
                    </span>
                    <span className="text-xs text-slate-500">
                      {formatTimestamp(item.timestamp)}
                    </span>
                  </div>

                  {/* Email */}
                  {item.type === "email" && "subject" in item && (
                    <div>
                      <p className="text-sm font-semibold text-slate-800 mb-1">
                        {item.subject}
                      </p>
                      {"status" in item && (
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                            item.status === "opened"
                              ? "bg-green-100 text-green-700 border border-green-200"
                              : "bg-gray-100 text-gray-600 border border-gray-200"
                          }`}
                        >
                          {item.status === "opened" ? "Opened" : "Sent"}
                        </span>
                      )}
                    </div>
                  )}

                  {/* SMS */}
                  {item.type === "sms" && "message" in item && (
                    <div>
                      <p className="text-sm text-slate-700 line-clamp-1">
                        {item.message}
                      </p>
                      {"reply" in item && item.reply && (
                        <div className="mt-2 p-2 bg-green-50 border-l-2 border-green-500 rounded">
                          <p className="text-xs font-semibold text-green-900 mb-1">
                            Reply received:
                          </p>
                          <p className="text-xs text-green-800">{item.reply}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Call */}
                  {item.type === "call" && "outcome" in item && (
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                            item.outcome === "Interested"
                              ? "bg-green-100 text-green-700 border border-green-200"
                              : "bg-gray-100 text-gray-600 border border-gray-200"
                          }`}
                        >
                          {item.outcome}
                        </span>
                        {"duration" in item && (
                          <span className="text-xs text-slate-500 tabular-nums">
                            {item.duration}
                          </span>
                        )}
                      </div>
                      {"notes" in item && item.notes && (
                        <p className="text-xs text-slate-600 line-clamp-2">
                          {item.notes}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Note */}
                  {item.type === "note" && "note" in item && (
                    <p className="text-sm text-slate-700 line-clamp-2">
                      {item.note}
                    </p>
                  )}
                </div>

                {/* Expand Button */}
                {"details" in item || ("notes" in item && item.notes) ? (
                  <button
                    onClick={() => toggleExpand(item.id)}
                    className="ml-2 p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
                  >
                    {expandedItems.has(item.id) ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                ) : null}
              </div>

              {/* Expanded Details */}
              <AnimatePresence>
                {expandedItems.has(item.id) && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="pt-2 mt-2 border-t border-slate-100">
                      {"details" in item && item.details && (
                        <p className="text-xs text-slate-600">{item.details}</p>
                      )}
                      {item.type === "call" && "notes" in item && item.notes && (
                        <p className="text-xs text-slate-600">{item.notes}</p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
