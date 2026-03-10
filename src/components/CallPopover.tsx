"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, ExternalLink } from "lucide-react";
import { CloseLead } from "@/types/close";
import { FacilityLeadLink } from "@/types/facility-lead-link";

interface CallPopoverProps {
  phone: string;
  linkedLeads: FacilityLeadLink[];
  leadsMap: Record<string, CloseLead>;
}

export default function CallPopover({
  phone,
  linkedLeads,
  leadsMap,
}: CallPopoverProps) {
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const hasLinkedLeads = linkedLeads.length > 0;

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }

    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  // No linked leads — render as a plain tel: link (unchanged behavior)
  if (!hasLinkedLeads) {
    return (
      <motion.a
        href={`tel:${phone}`}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        className="flex flex-col items-center gap-1.5 cursor-pointer group"
      >
        <div className="w-11 h-11 rounded-full bg-green-50 group-hover:bg-green-100 border border-green-200 flex items-center justify-center transition-all">
          <Phone className="w-5 h-5 text-green-600" />
        </div>
        <span className="text-[11px] font-medium text-slate-600">Call</span>
      </motion.a>
    );
  }

  return (
    <div className="relative" ref={popoverRef}>
      <motion.button
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen((prev) => !prev)}
        className="flex flex-col items-center gap-1.5 cursor-pointer group"
      >
        <div className="w-11 h-11 rounded-full bg-green-50 group-hover:bg-green-100 border border-green-200 flex items-center justify-center transition-all">
          <Phone className="w-5 h-5 text-green-600" />
        </div>
        <span className="text-[11px] font-medium text-slate-600">Call</span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 bg-white rounded-lg shadow-lg border border-slate-200 py-1 min-w-[180px]"
          >
            <a
              href={`tel:${phone}`}
              className="flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
              onClick={() => setOpen(false)}
            >
              <Phone className="w-4 h-4 text-green-600" />
              Call with Phone
            </a>

            {linkedLeads.map((link) => {
              const lead = leadsMap[link.close_lead_id];
              const label = lead?.display_name || lead?.name || "Lead";
              return (
                <a
                  key={link.close_lead_id}
                  href={`https://app.close.com/lead/${link.close_lead_id}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                  onClick={() => setOpen(false)}
                >
                  <ExternalLink className="w-4 h-4 text-blue-600" />
                  <span className="truncate">Open in Close{linkedLeads.length > 1 ? ` — ${label}` : ""}</span>
                </a>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
