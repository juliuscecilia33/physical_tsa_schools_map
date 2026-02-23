"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Sparkles, Loader2, MessageCircle, MapPin, Star, ChevronDown } from "lucide-react";
import { AISearchFilters, AISearchResponse } from "@/app/api/ai-search/route";
import { Facility } from "@/types/facility";

interface Message {
  role: "user" | "assistant";
  content: string;
  filters?: AISearchFilters;
}

interface AISearchPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onFiltersApplied: (filters: AISearchFilters) => void;
  onFacilitySelect: (facility: Facility) => void;
  allFacilities: Facility[];
  currentFilters: AISearchFilters | null;
}

// Sport emoji mapping
const SPORT_EMOJIS: { [key: string]: string } = {
  "Basketball": "🏀",
  "Soccer": "⚽",
  "Baseball": "⚾",
  "Football": "🏈",
  "Tennis": "🎾",
  "Volleyball": "🏐",
  "Swimming": "🏊",
  "Track & Field": "🏃",
  "Golf": "⛳",
  "Gym/Fitness": "💪",
  "CrossFit": "🏋️",
  "Yoga": "🧘",
  "Boxing": "🥊",
  "Martial Arts": "🥋",
};

// Helper function to apply AI filters (same logic as FacilityMap)
function applyAIFilters(facilities: Facility[], aiFilters: AISearchFilters | null): Facility[] {
  if (!aiFilters) return [];

  const SPORT_TO_TYPE_MAPPING: Record<string, string[]> = {
    "Gym/Fitness": ["gym", "health"],
    "CrossFit": ["gym", "health"],
    "Yoga": ["gym", "health"],
    "Swimming": ["aquarium", "swimming_pool"],
    "Basketball": ["stadium", "sports_complex", "recreation_center"],
    "Soccer": ["stadium", "sports_complex", "recreation_center", "athletic_field"],
    "Baseball": ["stadium", "sports_complex", "recreation_center", "athletic_field"],
    "Football": ["stadium", "sports_complex", "recreation_center", "athletic_field"],
    "Tennis": ["sports_complex", "recreation_center"],
    "Bowling": ["bowling_alley"],
    "Golf": ["golf"],
  };

  const extractCity = (address: string): string => {
    const parts = address.split(",");
    if (parts.length >= 2) {
      return parts[1].trim().toLowerCase();
    }
    return address.toLowerCase();
  };

  let filtered = facilities;

  if (aiFilters.city) {
    const targetCity = aiFilters.city.toLowerCase();
    filtered = filtered.filter((facility) => {
      const facilityCity = extractCity(facility.address);
      return facilityCity.includes(targetCity) || targetCity.includes(facilityCity);
    });
  }

  if (aiFilters.rating) {
    filtered = filtered.filter((facility) => {
      if (!facility.rating) return false;
      const meetsMin = !aiFilters.rating?.min || facility.rating >= aiFilters.rating.min;
      const meetsMax = !aiFilters.rating?.max || facility.rating <= aiFilters.rating.max;
      return meetsMin && meetsMax;
    });
  }

  if (aiFilters.reviewCount) {
    filtered = filtered.filter((facility) => {
      if (!facility.user_ratings_total) return false;
      const meetsMin = !aiFilters.reviewCount?.min || facility.user_ratings_total >= aiFilters.reviewCount.min;
      const meetsMax = !aiFilters.reviewCount?.max || facility.user_ratings_total <= aiFilters.reviewCount.max;
      return meetsMin && meetsMax;
    });
  }

  if (aiFilters.sports && aiFilters.sports.length > 0) {
    filtered = filtered.filter((facility) => {
      const requiredTypes = aiFilters.sports!.flatMap(
        sport => SPORT_TO_TYPE_MAPPING[sport] || []
      );
      if (requiredTypes.length === 0) return false;
      return requiredTypes.some((type) =>
        facility.sport_types.includes(type)
      );
    });
  }

  if (aiFilters.sportCountMin) {
    filtered = filtered.filter((facility) => {
      const sportCount = facility.sport_types?.length || 0;
      return sportCount >= aiFilters.sportCountMin!;
    });
  }

  if (aiFilters.businessStatus) {
    filtered = filtered.filter((facility) => {
      return facility.business_status === aiFilters.businessStatus;
    });
  }

  return filtered;
}

export default function AISearchPanel({
  isOpen,
  onClose,
  onFiltersApplied,
  onFacilitySelect,
  allFacilities,
  currentFilters,
}: AISearchPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hi! I'm your AI facility search assistant. Ask me anything like:\n\n• \"Show me facilities in Austin with 4.5+ rating\"\n• \"Find basketball courts in Houston\"\n• \"Facilities with multiple sports near Dallas\"\n• \"Highly rated gyms in San Antonio\"\n\nWhat are you looking for?",
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<any[]>([]);
  const [visibleResultCount, setVisibleResultCount] = useState(10);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Calculate matching facilities based on current filters
  const matchingFacilities = applyAIFilters(allFacilities, currentFilters);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const userMessage = inputValue.trim();
    setInputValue("");

    // Add user message to chat
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      // Call AI search API
      const response = await fetch("/api/ai-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: userMessage,
          conversationHistory,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get AI response");
      }

      const data: AISearchResponse = await response.json();

      // Add assistant message to chat
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.message,
          filters: data.filters,
        },
      ]);

      // Update conversation history
      if (data.conversationContext) {
        setConversationHistory(JSON.parse(data.conversationContext));
      }

      // Apply filters to the map
      if (data.filters && Object.keys(data.filters).length > 0) {
        onFiltersApplied(data.filters);
        // Reset visible count for new search
        setVisibleResultCount(10);
      }
    } catch (error) {
      console.error("AI Search Error:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I encountered an error processing your request. Please try again or check that your API key is configured correctly.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = () => {
    setMessages([
      {
        role: "assistant",
        content: "Chat cleared! What would you like to search for?",
      },
    ]);
    setConversationHistory([]);
    onFiltersApplied({});
    setVisibleResultCount(10);
  };

  const handleShowMore = () => {
    setVisibleResultCount((prev) => prev + 15);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Panel - Left side, no backdrop */}
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed left-0 top-0 bottom-0 w-[500px] bg-white shadow-2xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-6 flex-shrink-0">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">AI Search Assistant</h2>
                    <p className="text-sm text-purple-100">
                      Powered by Claude
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Result count badge */}
              {matchingFacilities.length > 0 && (
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="mt-3 inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-medium"
                >
                  <div className="w-2 h-2 bg-green-300 rounded-full animate-pulse" />
                  {matchingFacilities.length} {matchingFacilities.length === 1 ? "facility" : "facilities"} found
                </motion.div>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50">
              {messages.map((message, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                      message.role === "user"
                        ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-md"
                        : "bg-white text-gray-800 shadow-sm border border-gray-100"
                    }`}
                  >
                    {message.role === "assistant" && (
                      <div className="flex items-center gap-2 mb-2">
                        <MessageCircle className="w-4 h-4 text-purple-500" />
                        <span className="text-xs font-semibold text-purple-600 uppercase">
                          AI Assistant
                        </span>
                      </div>
                    )}
                    <p className="text-sm leading-relaxed whitespace-pre-line">
                      {message.content}
                    </p>

                    {/* Show facility result cards */}
                    {message.filters && Object.keys(message.filters).length > 0 && idx === messages.length - 1 && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <p className="text-xs font-semibold text-gray-700 mb-3">
                          Showing {Math.min(visibleResultCount, matchingFacilities.length)} of {matchingFacilities.length} {matchingFacilities.length === 1 ? "Result" : "Results"}
                        </p>
                        <div className="space-y-2 max-h-[400px] overflow-y-auto">
                          {matchingFacilities.slice(0, visibleResultCount).map((facility) => (
                            <motion.button
                              key={facility.place_id}
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => onFacilitySelect(facility)}
                              className="w-full text-left p-3 bg-gradient-to-br from-gray-50 to-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all"
                            >
                              <div className="flex flex-col gap-2">
                                <h4 className="font-semibold text-gray-900 text-sm line-clamp-1">
                                  {facility.name}
                                </h4>
                                <div className="flex items-center gap-1.5 text-xs text-gray-600">
                                  <MapPin className="w-3 h-3 text-gray-400" />
                                  <span className="line-clamp-1">{facility.address}</span>
                                </div>
                                {facility.rating && (
                                  <div className="flex items-center gap-2 text-xs">
                                    <div className="flex items-center gap-1">
                                      <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                                      <span className="font-semibold text-gray-900">{facility.rating.toFixed(1)}</span>
                                    </div>
                                    {facility.user_ratings_total && (
                                      <>
                                        <span className="text-gray-400">•</span>
                                        <span className="text-gray-500">{facility.user_ratings_total} reviews</span>
                                      </>
                                    )}
                                  </div>
                                )}
                                {facility.identified_sports && facility.identified_sports.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {facility.identified_sports.slice(0, 3).map((sport) => (
                                      <span
                                        key={sport}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 rounded text-xs font-medium"
                                      >
                                        <span>{SPORT_EMOJIS[sport] || "🏅"}</span>
                                        <span>{sport}</span>
                                      </span>
                                    ))}
                                    {facility.identified_sports.length > 3 && (
                                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-medium">
                                        +{facility.identified_sports.length - 3} more
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </motion.button>
                          ))}
                        </div>
                        {/* Show More button */}
                        {matchingFacilities.length > visibleResultCount && (
                          <motion.button
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={handleShowMore}
                            className="w-full mt-3 px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-medium hover:shadow-lg transition-all flex items-center justify-center gap-2"
                          >
                            <span>Show {Math.min(15, matchingFacilities.length - visibleResultCount)} More Results</span>
                            <ChevronDown className="w-4 h-4" />
                          </motion.button>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}

              {/* Loading indicator */}
              {isLoading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex justify-start"
                >
                  <div className="bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100">
                    <div className="flex items-center gap-2 text-gray-500">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Thinking...</span>
                    </div>
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 bg-white border-t border-gray-200 flex-shrink-0">
              <form onSubmit={handleSubmit} className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Ask me anything..."
                  disabled={isLoading}
                  className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  type="submit"
                  disabled={isLoading || !inputValue.trim()}
                  className="px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transition-shadow"
                >
                  <Send className="w-5 h-5" />
                </motion.button>
              </form>

              {/* Clear chat button */}
              <button
                onClick={handleClearChat}
                className="mt-2 w-full text-xs text-gray-500 hover:text-gray-700 py-2 transition-colors"
              >
                Clear chat & reset filters
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
