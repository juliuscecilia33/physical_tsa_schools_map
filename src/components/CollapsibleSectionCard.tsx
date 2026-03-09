"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface CollapsibleSectionCardProps {
  title: string;
  summary: string;
  icon: LucideIcon;
  iconBgColor: string;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

export default function CollapsibleSectionCard({
  title,
  summary,
  icon: Icon,
  iconBgColor,
  isExpanded,
  onToggle,
  children,
}: CollapsibleSectionCardProps) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden">
      {/* Header - always visible */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-3 cursor-pointer hover:bg-slate-100 transition-colors"
      >
        <div
          className={`w-8 h-8 rounded-full ${iconBgColor} flex items-center justify-center flex-shrink-0`}
        >
          <Icon className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 text-left min-w-0">
          <div className="text-sm font-medium text-slate-800">{title}</div>
          <div className="text-xs text-slate-500">{summary}</div>
        </div>
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="w-4 h-4 text-slate-400" />
        </motion.div>
      </button>

      {/* Body - expandable */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-3 py-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
