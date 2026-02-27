"use client";

import { Facility } from "@/types/facility";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { createPortal } from "react-dom";

// Sport emoji mapping
const SPORT_EMOJIS: { [key: string]: string } = {
  // Core Sports
  Basketball: "🏀",
  Soccer: "⚽",
  Baseball: "⚾",
  Football: "🏈",
  Tennis: "🎾",
  Volleyball: "🏐",
  Swimming: "🏊",
  "Track & Field": "🏃",

  // Extended Sports
  Golf: "⛳",
  Hockey: "🏒",
  Lacrosse: "🥍",
  Softball: "🥎",
  Wrestling: "🤼",
  Gymnastics: "🤸",
  Pickleball: "🏓",
  Racquetball: "🎾",
  Squash: "🎾",
  Badminton: "🏸",

  // Fitness Activities
  "Gym/Fitness": "💪",
  CrossFit: "🏋️",
  Yoga: "🧘",
  Pilates: "🧘‍♀️",
  "Martial Arts": "🥋",
  Boxing: "🥊",

  // Other Sports
  Bowling: "🎳",
  Skating: "⛸️",
  Climbing: "🧗",
  "Water Sports": "🚣",
};

interface SportDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedSport: string | null;
  onSelectSport: (sport: string) => void;
  facility: Facility;
}

export default function SportDetailModal({
  isOpen,
  onClose,
  selectedSport,
  onSelectSport,
  facility,
}: SportDetailModalProps) {
  if (!isOpen || !selectedSport) return null;

  if (!facility.identified_sports || facility.identified_sports.length === 0) {
    return null;
  }

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 md:p-6 z-[9999]"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: "spring", damping: 25 }}
          className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[85vh] overflow-hidden flex font-['Poppins']"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Left Sidebar - Sport Navigation */}
          <div className="w-64 bg-slate-50 border-r border-slate-200 overflow-y-auto">
            <div className="p-4 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-700">
                Sports Analyzed
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {facility.identified_sports?.length || 0} total
              </p>
            </div>
            <div className="p-2">
              {facility.identified_sports?.map((sportName) => {
                const sportMeta = facility.sport_metadata?.[sportName];
                const isSelected = sportName === selectedSport;
                const confidence = sportMeta?.confidence || "unknown";

                let borderColor = "border-slate-300";
                let bgColor = "bg-white hover:bg-slate-100";
                let selectedBgColor = "bg-blue-50 border-blue-400";

                if (confidence === "high") {
                  borderColor = "border-green-300";
                  if (isSelected) selectedBgColor = "bg-green-50 border-green-500";
                } else if (confidence === "medium") {
                  borderColor = "border-yellow-300";
                  if (isSelected)
                    selectedBgColor = "bg-yellow-50 border-yellow-500";
                } else if (confidence === "low") {
                  borderColor = "border-red-300";
                  if (isSelected) selectedBgColor = "bg-red-50 border-red-500";
                }

                return (
                  <button
                    key={sportName}
                    onClick={() => onSelectSport(sportName)}
                    className={`w-full text-left p-3 rounded-xl mb-2 border transition-all ${
                      isSelected ? selectedBgColor : `${bgColor} ${borderColor}`
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">
                        {SPORT_EMOJIS[sportName] || "🏅"}
                      </span>
                      <span className="font-semibold text-sm text-slate-900">
                        {sportName}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-slate-600">
                        {sportMeta?.score || 0}/100
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded ${
                          confidence === "high"
                            ? "bg-green-100 text-green-700"
                            : confidence === "medium"
                              ? "bg-yellow-100 text-yellow-700"
                              : confidence === "low"
                                ? "bg-red-100 text-red-700"
                                : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {confidence}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Content Area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {(() => {
              const sport = selectedSport;
              const metadata = facility.sport_metadata?.[sport];

              if (!metadata) {
                return (
                  <div className="flex-1 flex items-center justify-center text-slate-500">
                    <div className="text-center">
                      <p className="text-lg">Select a sport to view details</p>
                    </div>
                  </div>
                );
              }
              const score = metadata.score;
              const confidence = metadata.confidence;

              // Color scheme based on confidence
              let bgGradient = "from-slate-50 to-slate-100";
              let textColor = "text-slate-700";

              if (confidence === "high") {
                bgGradient = "from-green-50 to-green-100";
                textColor = "text-green-800";
              } else if (confidence === "medium") {
                bgGradient = "from-yellow-50 to-yellow-100";
                textColor = "text-yellow-800";
              } else if (confidence === "low") {
                bgGradient = "from-red-50 to-red-100";
                textColor = "text-red-800";
              }

              return (
                <>
                  {/* Header */}
                  <div
                    className={`bg-gradient-to-br ${bgGradient} p-6 border-b border-slate-200 flex items-start justify-between`}
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-5xl">
                        {SPORT_EMOJIS[sport] || "🏅"}
                      </span>
                      <div>
                        <h3 className={`text-3xl font-bold ${textColor}`}>
                          {sport}
                        </h3>
                        <p className="text-sm text-slate-600 mt-1">
                          Confidence Analysis
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={onClose}
                      className="p-2 hover:bg-white/50 rounded-full transition-colors"
                    >
                      <X className="w-5 h-5 text-slate-600" />
                    </button>
                  </div>

                  {/* Score Bar */}
                  <div className="px-6 py-4 bg-white border-b border-slate-200">
                    <div className="flex items-center gap-6">
                      <div className="flex-1">
                        <div className="flex items-baseline gap-2 mb-2">
                          <span className={`text-4xl font-bold ${textColor}`}>
                            {score}
                          </span>
                          <span className="text-slate-500 text-lg">/100</span>
                        </div>
                        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all ${
                              confidence === "high"
                                ? "bg-green-500"
                                : confidence === "medium"
                                  ? "bg-yellow-500"
                                  : confidence === "low"
                                    ? "bg-red-500"
                                    : "bg-slate-500"
                            }`}
                            style={{ width: `${score}%` }}
                          />
                        </div>
                      </div>
                      <div
                        className={`px-5 py-3 bg-white rounded-xl border-2 ${
                          confidence === "high"
                            ? "border-green-300 bg-green-50"
                            : confidence === "medium"
                              ? "border-yellow-300 bg-yellow-50"
                              : confidence === "low"
                                ? "border-red-300 bg-red-50"
                                : "border-slate-300"
                        }`}
                      >
                        <div className="text-xs text-slate-500 mb-1">
                          Confidence
                        </div>
                        <div
                          className={`text-xl font-bold ${textColor} capitalize`}
                        >
                          {confidence}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Details - Scrollable Content */}
                  <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
                    {/* Sources */}
                    <div>
                      <h4 className="text-sm font-bold text-slate-700 mb-3">
                        Identified From
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {metadata.sources.map((source) => {
                          const sourceLabels: Record<string, string> = {
                            name: "📛 Facility Name",
                            review: "💬 Reviews",
                            api: "🔌 API Data",
                            serp_review: "🔍 Scraped Reviews",
                          };
                          return (
                            <span
                              key={source}
                              className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-xl text-sm font-medium border border-blue-200"
                            >
                              {sourceLabels[source] || source}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    {/* Keywords */}
                    <div>
                      <h4 className="text-sm font-bold text-slate-700 mb-3">
                        Matched Keywords
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {metadata.keywords_matched.map((keyword) => (
                          <span
                            key={keyword}
                            className="px-3 py-1.5 bg-orange-50 text-orange-700 rounded-full text-sm font-mono border border-orange-200"
                          >
                            {keyword}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Matched Text */}
                    {metadata.matched_text && (
                      <div>
                        <h4 className="text-sm font-bold text-slate-700 mb-3">
                          Text Evidence{" "}
                          {Array.isArray(metadata.matched_text) &&
                            `(${metadata.matched_text.length} reviews)`}
                        </h4>
                        {Array.isArray(metadata.matched_text) ? (
                          <div className="space-y-3">
                            {metadata.matched_text.map((review, idx) => {
                              // Highlight matched keywords in the review text
                              const highlightKeywords = (
                                text: string,
                                keywords: string[],
                              ) => {
                                if (!keywords || keywords.length === 0)
                                  return text;

                                // Create a regex that matches any of the keywords (case-insensitive)
                                const pattern = keywords
                                  .map((k) =>
                                    k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
                                  )
                                  .join("|");
                                const regex = new RegExp(`(${pattern})`, "gi");

                                // Split text by matches and wrap matches in spans
                                const parts = text.split(regex);
                                return parts.map((part, i) => {
                                  const isMatch = keywords.some(
                                    (k) =>
                                      k.toLowerCase() === part.toLowerCase(),
                                  );
                                  return isMatch ? (
                                    <mark
                                      key={i}
                                      className="bg-yellow-200 font-semibold px-0.5 rounded"
                                    >
                                      {part}
                                    </mark>
                                  ) : (
                                    <span key={i}>{part}</span>
                                  );
                                });
                              };

                              return (
                                <div
                                  key={idx}
                                  className="bg-slate-50 border border-slate-200 rounded-xl p-4 hover:border-slate-300 transition-colors"
                                >
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className="text-xs font-bold text-slate-600">
                                      Review {idx + 1}
                                    </span>
                                  </div>
                                  <p className="text-sm text-slate-700 leading-relaxed">
                                    "
                                    {highlightKeywords(
                                      review,
                                      metadata.keywords_matched,
                                    )}
                                    "
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                            <p className="text-sm text-slate-700 leading-relaxed">
                              "
                              {(() => {
                                // Highlight keywords in single matched text too
                                const text = metadata.matched_text;
                                const keywords = metadata.keywords_matched;
                                if (!keywords || keywords.length === 0)
                                  return text;

                                const pattern = keywords
                                  .map((k) =>
                                    k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
                                  )
                                  .join("|");
                                const regex = new RegExp(`(${pattern})`, "gi");
                                const parts = text.split(regex);

                                return parts.map((part, i) => {
                                  const isMatch = keywords.some(
                                    (k) =>
                                      k.toLowerCase() === part.toLowerCase(),
                                  );
                                  return isMatch ? (
                                    <mark
                                      key={i}
                                      className="bg-yellow-200 font-semibold px-0.5 rounded"
                                    >
                                      {part}
                                    </mark>
                                  ) : (
                                    <span key={i}>{part}</span>
                                  );
                                });
                              })()}
                              "
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Recommendation */}
                    <div
                      className={`border-2 rounded-xl p-4 ${
                        confidence === "high"
                          ? "border-green-200 bg-green-50/50"
                          : confidence === "medium"
                            ? "border-yellow-200 bg-yellow-50/50"
                            : confidence === "low"
                              ? "border-red-200 bg-red-50/50"
                              : "border-slate-200 bg-slate-50/50"
                      }`}
                    >
                      <h4 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                        <span>💡</span>
                        Recommendation
                      </h4>
                      <p className={`text-sm ${textColor}`}>
                        {confidence === "high" && (
                          <>
                            <strong>Keep this sport.</strong> High confidence
                            score indicates reliable identification from
                            facility name or verified sources.
                          </>
                        )}
                        {confidence === "medium" && (
                          <>
                            <strong>Review recommended.</strong> Medium
                            confidence suggests this sport was identified from
                            reviews, which may contain context that doesn't
                            reflect what's actually offered.
                          </>
                        )}
                        {confidence === "low" && (
                          <>
                            <strong>Consider removing.</strong> Low confidence
                            score indicates this is likely a false positive from
                            review mentions that don't reflect actual offerings.
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
