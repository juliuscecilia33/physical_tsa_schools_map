"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MoreVertical, Mail, MessageSquare, Phone, Layers } from "lucide-react";

interface QuickActionsDropdownProps {
  facilityId: string;
  facilityName: string;
}

export default function QuickActionsDropdown({
  facilityId,
  facilityName,
}: QuickActionsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleAction = (action: string) => {
    console.log(`Action "${action}" for facility:`, facilityId, facilityName);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
        title="Quick actions"
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop to close dropdown */}
            <div
              className="fixed inset-0 z-10"
              onClick={() => setIsOpen(false)}
            />

            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-slate-200 py-2 z-20"
            >
              <div className="px-3 py-2 border-b border-slate-100">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Quick Actions
                </p>
              </div>

              {[
                {
                  icon: Mail,
                  label: "Send Email",
                  action: "send-email",
                  color: "blue",
                },
                {
                  icon: MessageSquare,
                  label: "Send SMS",
                  action: "send-sms",
                  color: "purple",
                },
                {
                  icon: Phone,
                  label: "Add to Call Queue",
                  action: "add-to-call-queue",
                  color: "green",
                },
                {
                  icon: Layers,
                  label: "Enroll in Campaign",
                  action: "enroll-in-campaign",
                  color: "orange",
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.action}
                    onClick={() => handleAction(item.action)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <Icon className={`h-4 w-4 text-${item.color}-600`} />
                    <span className="font-medium">{item.label}</span>
                  </button>
                );
              })}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
