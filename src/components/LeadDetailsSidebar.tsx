"use client";

import { motion, AnimatePresence } from "framer-motion";
import NoteText from "./NoteText";
import {
  X,
  MapPin,
  Phone,
  Mail,
  Globe,
  Building2,
  User,
  Calendar,
  ExternalLink,
  AlertCircle,
  Search,
  Link2,
  Info,
  Plus,
} from "lucide-react";
import {
  useCloseLead,
  useCloseLeadActivities,
  useCloseLeadStatuses,
} from "@/hooks/useCloseCRM";
import { CloseActivityTimeline } from "./CloseActivityTimeline";
import { useEffect, useMemo, useState } from "react";
import { Facility } from "@/types/facility";
import {
  useFacilityLeadLinks,
  useCreateFacilityLeadLink,
  useDeleteFacilityLeadLink,
} from "@/hooks/useFacilityLeadLinks";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { updateFacilityTags } from "@/utils/facilityCache";

const CLOSE_DATA_TAG_ID = "ef3537b6-4d83-4eb8-84a5-9bc74e776c72";

// Sport emoji mapping
const SPORT_EMOJIS: { [key: string]: string } = {
  Basketball: "🏀",
  Soccer: "⚽",
  Baseball: "⚾",
  Football: "🏈",
  Tennis: "🎾",
  Volleyball: "🏐",
  Swimming: "🏊",
  "Track & Field": "🏃",
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
  "Gym/Fitness": "💪",
  CrossFit: "🏋️",
  Yoga: "🧘",
  Pilates: "🧘‍♀️",
  "Martial Arts": "🥋",
  Boxing: "🥊",
  Bowling: "🎳",
  Skating: "⛸️",
  Climbing: "🧗",
  "Water Sports": "🚣",
};

interface LeadDetailsSidebarProps {
  leadId: string | null;
  onClose: () => void;
  facilities: Facility[];
  onAddFacility?: (leadName: string, leadId: string) => void;
}

export function LeadDetailsSidebar({
  leadId,
  onClose,
  facilities,
  onAddFacility,
}: LeadDetailsSidebarProps) {
  const {
    data: lead,
    isLoading: leadLoading,
    error: leadError,
  } = useCloseLead(leadId);
  const { data: activitiesData, isLoading: activitiesLoading } =
    useCloseLeadActivities(leadId);
  const { data: statuses } = useCloseLeadStatuses();

  // Facility-lead links
  const { data: facilityLeadLinks = [], isLoading: linksLoading } =
    useFacilityLeadLinks(leadId);
  const createLinkMutation = useCreateFacilityLeadLink();
  const deleteLinkMutation = useDeleteFacilityLeadLink();
  const queryClient = useQueryClient();
  const supabase = createClient();

  // Facility search state
  const [facilitySearchQuery, setFacilitySearchQuery] = useState("");

  // Reset facility search when lead changes or sidebar closes
  useEffect(() => {
    setFacilitySearchQuery("");
  }, [leadId]);

  // Link confirmation modal state
  const [isLinkConfirmModalOpen, setIsLinkConfirmModalOpen] = useState(false);
  const [pendingLinkFacility, setPendingLinkFacility] = useState<{
    placeId: string;
    confidence: number;
    matchReason: string;
    facilityName: string;
  } | null>(null);

  // Get status label
  const statusLabel = useMemo(() => {
    if (!lead || !statuses) return null;
    const status = statuses.find((s) => s.id === lead.status_id);
    return status?.label || lead.status_label || "Unknown";
  }, [lead, statuses]);

  // Utility: Normalize phone number (remove all non-digit characters)
  const normalizePhone = (phone: string | undefined): string => {
    if (!phone) return "";
    return phone.replace(/\D/g, "");
  };

  // Utility: Extract city from address string
  const extractCity = (address: string): string => {
    // Typical format: "123 Street, City, State ZIP"
    const parts = address.split(",");
    if (parts.length >= 2) {
      return parts[parts.length - 2].trim().toLowerCase();
    }
    return "";
  };

  // Utility: Calculate Levenshtein distance for fuzzy matching
  const levenshteinDistance = (str1: string, str2: string): number => {
    const len1 = str1.length;
    const len2 = str2.length;
    const matrix: number[][] = [];

    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost,
        );
      }
    }

    return matrix[len1][len2];
  };

  // Utility: Check if strings are similar (fuzzy match)
  const isFuzzyMatch = (
    str1: string,
    str2: string,
    threshold: number = 0.8,
  ): boolean => {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();
    const maxLen = Math.max(s1.length, s2.length);
    if (maxLen === 0) return false;
    const distance = levenshteinDistance(s1, s2);
    const similarity = 1 - distance / maxLen;
    return similarity >= threshold;
  };

  // Match facilities based on confidence scoring
  const matchedFacilities = useMemo(() => {
    if (!facilities || facilities.length === 0 || !lead) return [];

    const leadName = (lead.display_name || lead.name || "")
      .toLowerCase()
      .trim();
    const leadPhone =
      lead.contacts && lead.contacts.length > 0
        ? normalizePhone(lead.contacts[0].phones?.[0]?.phone)
        : "";
    const leadAddress =
      lead.addresses && lead.addresses.length > 0
        ? lead.addresses[0].address_1?.toLowerCase() || ""
        : "";
    const leadCity =
      lead.addresses && lead.addresses.length > 0
        ? (lead.addresses[0].city || "").toLowerCase()
        : "";

    interface MatchResult extends Facility {
      confidence: number;
      matchReason: string;
    }

    // Score each facility
    const results: MatchResult[] = facilities
      .map((facility) => {
        let confidence = 0;
        let matchReason = "";

        // 1. Phone Match (Confidence: 5)
        if (leadPhone && facility.phone) {
          const facilityPhone = normalizePhone(facility.phone);
          if (facilityPhone === leadPhone) {
            confidence = 5;
            matchReason = "Phone match";
            return { ...facility, confidence, matchReason };
          }
        }

        // 2. Address Match (Confidence: 5)
        if (leadAddress && facility.address) {
          const facilityAddress = facility.address.toLowerCase();
          // Check if addresses are very similar
          if (
            facilityAddress.includes(leadAddress) ||
            leadAddress.includes(facilityAddress) ||
            isFuzzyMatch(leadAddress, facilityAddress, 0.85)
          ) {
            confidence = 5;
            matchReason = "Address match";
            return { ...facility, confidence, matchReason };
          }
        }

        // 3. Name + City Match (Confidence: 4)
        if (leadName && leadCity && facility.name && facility.address) {
          const facilityName = facility.name.toLowerCase();
          const facilityCity = extractCity(facility.address);

          if (facilityName === leadName && facilityCity === leadCity) {
            confidence = 4;
            matchReason = "Name + City match";
            return { ...facility, confidence, matchReason };
          }
        }

        // 4. Exact Name Match (Confidence: 3)
        if (leadName && facility.name) {
          const facilityName = facility.name.toLowerCase();
          if (facilityName === leadName) {
            confidence = 3;
            matchReason = "Exact name match";
            return { ...facility, confidence, matchReason };
          }
        }

        // 5. Fuzzy Name Match (Confidence: 2)
        if (leadName && facility.name) {
          const facilityName = facility.name.toLowerCase();
          if (isFuzzyMatch(leadName, facilityName, 0.75)) {
            confidence = 2;
            matchReason = "Fuzzy name match";
            return { ...facility, confidence, matchReason };
          }
        }

        return { ...facility, confidence, matchReason };
      })
      .filter((result) => result.confidence > 0); // Only show matches

    // Sort by confidence (highest first), then by name
    return results
      .sort((a, b) => {
        if (b.confidence !== a.confidence) {
          return b.confidence - a.confidence;
        }
        return a.name.localeCompare(b.name);
      })
      .slice(0, 50); // Limit to 50 results
  }, [facilities, lead]);

  // Separate linked facilities from matched facilities
  const linkedFacilities = useMemo(() => {
    if (!facilityLeadLinks || !facilities) return [];

    return facilityLeadLinks
      .map((link) => {
        const facility = facilities.find((f) => f.place_id === link.place_id);
        if (!facility) return null;
        return {
          ...facility,
          link,
          confidence: link.confidence,
          matchReason: link.match_reason,
        };
      })
      .filter(Boolean) as ((typeof matchedFacilities)[0] & {
      link: (typeof facilityLeadLinks)[0];
    })[];
  }, [facilityLeadLinks, facilities]);

  // Filter out linked facilities from matched facilities, and search all facilities when query is active
  const unmatchedFacilities = useMemo(() => {
    const linkedPlaceIds = new Set(linkedFacilities.map((f) => f.place_id));
    const matchedMap = new Map(matchedFacilities.map((f) => [f.place_id, f]));

    if (!facilitySearchQuery.trim()) {
      // No search query: show only confidence-matched facilities
      return matchedFacilities.filter((f) => !linkedPlaceIds.has(f.place_id));
    }

    // With search query: search ALL facilities
    const query = facilitySearchQuery.toLowerCase();
    const results = facilities
      .filter((facility) => {
        if (linkedPlaceIds.has(facility.place_id)) return false;
        const nameMatch = facility.name?.toLowerCase().includes(query);
        const addressMatch = facility.address?.toLowerCase().includes(query);
        const sportsMatch = facility.identified_sports?.some((sport) =>
          sport.toLowerCase().includes(query),
        );
        return nameMatch || addressMatch || sportsMatch;
      })
      .map((facility) => {
        const matched = matchedMap.get(facility.place_id);
        if (matched) return matched;
        return { ...facility, confidence: 1, matchReason: "Search result" };
      })
      .sort((a, b) => {
        // Confidence-matched results first (search-only results have confidence 1)
        if (a.confidence > 1 && b.confidence <= 1) return -1;
        if (a.confidence <= 1 && b.confidence > 1) return 1;
        if (b.confidence !== a.confidence) return b.confidence - a.confidence;
        return a.name.localeCompare(b.name);
      })
      .slice(0, 50);

    return results;
  }, [matchedFacilities, linkedFacilities, facilities, facilitySearchQuery]);

  // Calculate confidence breakdown (for unmatched facilities only)
  const confidenceBreakdown = useMemo(() => {
    const breakdown = {
      high: 0, // Confidence 5
      medium: 0, // Confidence 4
      low: 0, // Confidence 3
      fuzzy: 0, // Confidence 2
    };

    unmatchedFacilities.forEach((facility) => {
      if (facility.confidence === 5) breakdown.high++;
      else if (facility.confidence === 4) breakdown.medium++;
      else if (facility.confidence === 3) breakdown.low++;
      else if (facility.confidence === 2) breakdown.fuzzy++;
    });

    return breakdown;
  }, [unmatchedFacilities]);

  // Handle linking a facility to the lead - open confirmation modal
  const handleLinkFacility = (
    placeId: string,
    confidence: number,
    matchReason: string,
    facilityName: string,
  ) => {
    setPendingLinkFacility({ placeId, confidence, matchReason, facilityName });
    setIsLinkConfirmModalOpen(true);
  };

  // Auto-assign "Close Data Included" tag to a facility
  const assignCloseDataTag = async (placeId: string) => {
    try {
      // Insert tag assignment (ignore if already exists)
      const { error: insertError } = await supabase
        .from("facility_tag_assignments")
        .insert({ place_id: placeId, tag_id: CLOSE_DATA_TAG_ID });

      if (insertError && insertError.code !== "23505") {
        console.error("Error assigning Close Data tag:", insertError);
        return;
      }

      // Fetch the tag details for cache update
      const { data: tagData, error: tagError } = await supabase
        .from("facility_tags")
        .select("id, name, color, description")
        .eq("id", CLOSE_DATA_TAG_ID)
        .single();

      if (tagError || !tagData) {
        console.error("Error fetching Close Data tag details:", tagError);
        return;
      }

      // Update the facility cache with the new tag
      const facility = facilities.find((f) => f.place_id === placeId);
      const currentTags = facility?.tags ?? [];
      if (!currentTags.some((t) => t.id === CLOSE_DATA_TAG_ID)) {
        updateFacilityTags(queryClient, placeId, [...currentTags, tagData]);
      }
    } catch (error) {
      console.error("Error in assignCloseDataTag:", error);
    }
  };

  // Confirm linking facility
  const handleConfirmLink = async () => {
    if (!lead?.id || !pendingLinkFacility) return;

    try {
      await createLinkMutation.mutateAsync({
        place_id: pendingLinkFacility.placeId,
        close_lead_id: lead.id,
        confidence: pendingLinkFacility.confidence,
        match_reason: pendingLinkFacility.matchReason,
      });
      // Auto-assign "Close Data Included" tag
      await assignCloseDataTag(pendingLinkFacility.placeId);
      // Close modal and clear pending state
      setIsLinkConfirmModalOpen(false);
      setPendingLinkFacility(null);
    } catch (error) {
      console.error("Error linking facility:", error);
      alert("Failed to link facility. Please try again.");
    }
  };

  // Cancel linking facility
  const handleCancelLink = () => {
    setIsLinkConfirmModalOpen(false);
    setPendingLinkFacility(null);
  };

  // Handle unlinking a facility from the lead
  const handleUnlinkFacility = async (linkId: string, placeId: string) => {
    if (!lead?.id) return;

    if (!confirm("Are you sure you want to unlink this facility?")) return;

    try {
      await deleteLinkMutation.mutateAsync({
        id: linkId,
        closeLeadId: lead.id,
        placeId,
      });
    } catch (error) {
      console.error("Error unlinking facility:", error);
      alert("Failed to unlink facility. Please try again.");
    }
  };

  const isOpen = !!leadId;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div key="lead-details-sidebar">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
          />

          {/* Sidebar */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 h-full w-full max-w-2xl bg-white shadow-2xl z-50 overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-white">
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold text-gray-900 truncate">
                  {leadLoading
                    ? "Loading..."
                    : lead?.display_name || lead?.name || "Lead Details"}
                </h2>
                {statusLabel && (
                  <div className="mt-2">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                      {statusLabel}
                    </span>
                  </div>
                )}
              </div>
              <button
                onClick={onClose}
                className="ml-4 p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {leadError && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-red-900">
                      Failed to load lead
                    </p>
                    <p className="text-sm text-red-700 mt-1">
                      {leadError.message}
                    </p>
                  </div>
                </div>
              )}

              {leadLoading ? (
                <div className="flex items-center justify-center p-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                </div>
              ) : lead ? (
                <>
                  {/* About Section */}
                  <div className="bg-gray-50 rounded-lg p-5 space-y-4">
                    <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                      <Building2 className="w-4 h-4" />
                      About
                    </h3>

                    {lead.description && (
                      <p className="text-sm text-gray-700">
                        {lead.description}
                      </p>
                    )}

                    {/* Address */}
                    {lead.addresses && lead.addresses.length > 0 && (
                      <div className="flex items-start gap-3">
                        <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                        <div className="text-sm text-gray-700">
                          {lead.addresses[0].address_1}
                          {lead.addresses[0].address_2 && (
                            <>, {lead.addresses[0].address_2}</>
                          )}
                          {(lead.addresses[0].city ||
                            lead.addresses[0].state ||
                            lead.addresses[0].zipcode) && (
                            <div>
                              {lead.addresses[0].city}
                              {lead.addresses[0].state &&
                                `, ${lead.addresses[0].state}`}
                              {lead.addresses[0].zipcode &&
                                ` ${lead.addresses[0].zipcode}`}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Website */}
                    {lead.url && (
                      <div className="flex items-center gap-3">
                        <Globe className="w-4 h-4 text-gray-400" />
                        <a
                          href={lead.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                        >
                          {lead.url}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}

                    {/* Dates */}
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <Calendar className="w-4 h-4" />
                      <div>
                        <div>
                          Created:{" "}
                          {new Date(lead.date_created).toLocaleDateString()}
                        </div>
                        <div>
                          Updated:{" "}
                          {new Date(lead.date_updated).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Contacts Section */}
                  {lead.contacts && lead.contacts.length > 0 && (
                    <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
                      <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                        <User className="w-4 h-4" />
                        Contacts ({lead.contacts.length})
                      </h3>

                      <div className="space-y-4">
                        {lead.contacts.map((contact) => (
                          <div
                            key={contact.id}
                            className="p-4 bg-gray-50 rounded-lg space-y-2"
                          >
                            {contact.name && (
                              <p className="font-medium text-gray-900">
                                {contact.name}
                              </p>
                            )}
                            {contact.title && (
                              <p className="text-sm text-gray-600">
                                {contact.title}
                              </p>
                            )}

                            {/* Emails */}
                            {contact.emails && contact.emails.length > 0 && (
                              <div className="space-y-1">
                                {contact.emails.map((email, idx) => (
                                  <div
                                    key={idx}
                                    className="flex items-center gap-2 text-sm"
                                  >
                                    <Mail className="w-4 h-4 text-gray-400" />
                                    <a
                                      href={`mailto:${email.email}`}
                                      className="text-blue-600 hover:text-blue-800"
                                    >
                                      {email.email}
                                    </a>
                                    {email.type && (
                                      <span className="text-xs text-gray-500">
                                        ({email.type})
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Phones */}
                            {contact.phones && contact.phones.length > 0 && (
                              <div className="space-y-1">
                                {contact.phones.map((phone, idx) => (
                                  <div
                                    key={idx}
                                    className="flex items-center gap-2 text-sm"
                                  >
                                    <Phone className="w-4 h-4 text-gray-400" />
                                    <a
                                      href={`tel:${phone.phone}`}
                                      className="text-blue-600 hover:text-blue-800"
                                    >
                                      {phone.phone}
                                    </a>
                                    {phone.type && (
                                      <span className="text-xs text-gray-500">
                                        ({phone.type})
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Custom Fields */}
                  {lead.custom && Object.keys(lead.custom).length > 0 && (
                    <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-3">
                      <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
                        Custom Fields
                      </h3>
                      <div className="space-y-2">
                        {Object.entries(lead.custom).map(([key, value]) => (
                          <div
                            key={key}
                            className="flex justify-between text-sm gap-20"
                          >
                            <span className="text-gray-600 shrink-0">
                              {key}:
                            </span>
                            <span className="text-gray-900 font-medium overflow-hidden">
                              <NoteText text={String(value)} truncateUrls />
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Activity Timeline */}
                  <div className="bg-white border border-gray-200 rounded-lg p-5">
                    <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
                      Activity Timeline
                    </h3>
                    {activitiesData && (
                      <div className="mb-3 flex flex-wrap gap-2 text-xs text-gray-600">
                        <span>Total: {activitiesData.count.total}</span>
                        {activitiesData.count.calls > 0 && (
                          <span>• Calls: {activitiesData.count.calls}</span>
                        )}
                        {activitiesData.count.emails > 0 && (
                          <span>• Emails: {activitiesData.count.emails}</span>
                        )}
                        {activitiesData.count.notes > 0 && (
                          <span>• Notes: {activitiesData.count.notes}</span>
                        )}
                        {activitiesData.count.tasks > 0 && (
                          <span>• Tasks: {activitiesData.count.tasks}</span>
                        )}
                        {activitiesData.count.opportunities > 0 && (
                          <span>
                            • Opportunities:{" "}
                            {activitiesData.count.opportunities}
                          </span>
                        )}
                      </div>
                    )}
                    <CloseActivityTimeline
                      activities={activitiesData?.activities || []}
                      isLoading={activitiesLoading}
                    />
                  </div>

                  {/* Linked & Matched Facilities */}
                  <div className="bg-white border border-gray-200 rounded-lg p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                        <Building2 className="w-4 h-4" />
                        {linkedFacilities.length > 0
                          ? "Linked Facilities"
                          : "Matched Facilities"}
                        {(linkedFacilities.length > 0 ||
                          unmatchedFacilities.length > 0) && (
                          <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold text-white bg-blue-600 rounded-full">
                            {linkedFacilities.length +
                              unmatchedFacilities.length}
                          </span>
                        )}
                        {linkedFacilities.length === 0 &&
                          unmatchedFacilities.length > 0 && (
                            <span className="relative group">
                              <Info className="w-4 h-4 text-blue-500 cursor-help" />
                              <span className="hidden group-hover:block absolute left-1/2 -translate-x-1/2 top-full mt-2 w-64 p-2 text-xs text-white bg-gray-900 rounded-lg shadow-lg z-50 normal-case font-light">
                                Link facilities to this lead to track
                                relationships and manage your outreach. Click
                                &quot;Link to Lead&quot; on any facility card
                                below.
                              </span>
                            </span>
                          )}
                      </h3>
                    </div>

                    {/* Linked Facilities Section */}
                    {linkedFacilities.length > 0 && (
                      <div className="mb-6">
                        <h4 className="text-xs font-semibold text-green-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                          Linked ({linkedFacilities.length})
                        </h4>
                        <div className="space-y-3">
                          {linkedFacilities.map((facility, idx) => {
                            const getConfidenceBadge = () => {
                              switch (facility.confidence) {
                                case 5:
                                  return {
                                    label: "High Match",
                                    className:
                                      "bg-gradient-to-r from-green-50 to-green-100 text-green-800 border-green-300",
                                    dotColor: "bg-green-500",
                                  };
                                case 4:
                                  return {
                                    label: "Name + City",
                                    className:
                                      "bg-gradient-to-r from-blue-50 to-blue-100 text-blue-800 border-blue-300",
                                    dotColor: "bg-blue-500",
                                  };
                                case 3:
                                  return {
                                    label: "Name Match",
                                    className:
                                      "bg-gradient-to-r from-yellow-50 to-yellow-100 text-yellow-800 border-yellow-300",
                                    dotColor: "bg-yellow-500",
                                  };
                                case 2:
                                  return {
                                    label: "Fuzzy Match",
                                    className:
                                      "bg-gradient-to-r from-orange-50 to-orange-100 text-orange-800 border-orange-300",
                                    dotColor: "bg-orange-500",
                                  };
                                default:
                                  return {
                                    label: "Match",
                                    className:
                                      "bg-gradient-to-r from-gray-50 to-gray-100 text-gray-800 border-gray-300",
                                    dotColor: "bg-gray-500",
                                  };
                              }
                            };

                            const confidenceBadge = getConfidenceBadge();

                            return (
                              <motion.div
                                key={facility.place_id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{
                                  delay: idx * 0.04,
                                  duration: 0.3,
                                }}
                                className="p-5 rounded-xl transition-all duration-300 bg-gradient-to-br from-green-50 to-white border-2 border-green-300 shadow-sm"
                              >
                                <div className="space-y-3">
                                  {/* Header with Linked Badge */}
                                  <div className="flex items-start justify-between gap-3">
                                    <h4 className="font-bold text-gray-900 text-base leading-tight flex-1">
                                      {facility.name}
                                    </h4>
                                    <div className="flex flex-col gap-1 items-end flex-shrink-0">
                                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-green-100 text-green-800 border border-green-300 shadow-sm">
                                        <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                                        Linked
                                      </span>
                                      <span
                                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold border shadow-sm ${confidenceBadge.className}`}
                                      >
                                        <span
                                          className={`w-1.5 h-1.5 rounded-full ${confidenceBadge.dotColor}`}
                                        ></span>
                                        {confidenceBadge.label}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Match Reason */}
                                  <div className="flex items-center gap-2 text-xs text-gray-600">
                                    <span className="font-semibold">
                                      Reason:
                                    </span>
                                    <span>{facility.matchReason}</span>
                                  </div>

                                  {/* Address */}
                                  <div className="flex items-start gap-2">
                                    <MapPin className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                                    <p className="text-sm text-gray-600 leading-relaxed">
                                      {facility.address}
                                    </p>
                                  </div>

                                  {/* Phone */}
                                  {facility.phone && (
                                    <div className="flex items-center gap-2">
                                      <Phone className="w-4 h-4 text-blue-600 flex-shrink-0" />
                                      <p className="text-sm text-gray-700 font-medium">
                                        {facility.phone}
                                      </p>
                                    </div>
                                  )}

                                  {/* Sports Badges */}
                                  {facility.identified_sports &&
                                    facility.identified_sports.length > 0 && (
                                      <div className="flex flex-wrap gap-2">
                                        {facility.identified_sports
                                          .slice(0, 5)
                                          .map((sport) => (
                                            <span
                                              key={sport}
                                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 rounded-lg text-xs font-semibold shadow-sm border border-blue-200"
                                            >
                                              <span className="text-base">
                                                {SPORT_EMOJIS[sport] || "🏅"}
                                              </span>
                                              <span>{sport}</span>
                                            </span>
                                          ))}
                                        {facility.identified_sports.length >
                                          5 && (
                                          <span className="inline-flex items-center px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-semibold border border-gray-200">
                                            +
                                            {facility.identified_sports.length -
                                              5}{" "}
                                            more
                                          </span>
                                        )}
                                      </div>
                                    )}

                                  {/* Rating */}
                                  {facility.rating && (
                                    <div className="flex items-center gap-2 text-sm">
                                      <div className="flex items-center gap-1">
                                        <span className="text-yellow-500 text-base">
                                          ★
                                        </span>
                                        <span className="font-bold text-gray-900">
                                          {facility.rating.toFixed(1)}
                                        </span>
                                      </div>
                                      <span className="text-gray-400">•</span>
                                      <span className="text-gray-500">
                                        {facility.user_ratings_total} reviews
                                      </span>
                                    </div>
                                  )}

                                  {/* Unlink Button */}
                                  <div className="pt-3 border-t border-green-200">
                                    <button
                                      onClick={() =>
                                        handleUnlinkFacility(
                                          facility.link.id,
                                          facility.place_id,
                                        )
                                      }
                                      disabled={deleteLinkMutation.isPending}
                                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 hover:border-red-300 rounded-lg transition-all duration-200 hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                    >
                                      <X className="w-4 h-4" />
                                      {deleteLinkMutation.isPending
                                        ? "Unlinking..."
                                        : "Unlink from Lead"}
                                    </button>
                                  </div>
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Suggested Matches Section - Only show if no linked facilities */}
                    {linkedFacilities.length === 0 && (
                      <>
                        {/* Search Input + Add Facility */}
                        <div className="mb-4 flex items-center gap-2">
                          <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                              type="text"
                              value={facilitySearchQuery}
                              onChange={(e) =>
                                setFacilitySearchQuery(e.target.value)
                              }
                              placeholder="Search by name, location, or sport..."
                              className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                          </div>
                          {onAddFacility && lead && (
                            <button
                              onClick={() => {
                                onAddFacility(
                                  lead.display_name || lead.name,
                                  lead.id,
                                );
                                onClose();
                              }}
                              title="Add new facility"
                              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors cursor-pointer"
                            >
                              <Plus className="w-4 h-4" />
                              Add
                            </button>
                          )}
                        </div>
                      </>
                    )}

                    {linkedFacilities.length === 0 &&
                      unmatchedFacilities.length > 0 && (
                        <div className="space-y-3">
                          {unmatchedFacilities.map((facility, idx) => {
                              // Determine confidence badge style
                              const getConfidenceBadge = () => {
                                switch (facility.confidence) {
                                  case 5:
                                    return {
                                      label: "High Match",
                                      className:
                                        "bg-gradient-to-r from-green-50 to-green-100 text-green-800 border-green-300",
                                      dotColor: "bg-green-500",
                                      needsReview: false,
                                    };
                                  case 4:
                                    return {
                                      label: "Name + City",
                                      className:
                                        "bg-gradient-to-r from-blue-50 to-blue-100 text-blue-800 border-blue-300",
                                      dotColor: "bg-blue-500",
                                      needsReview: true,
                                    };
                                  case 3:
                                    return {
                                      label: "Name Match",
                                      className:
                                        "bg-gradient-to-r from-yellow-50 to-yellow-100 text-yellow-800 border-yellow-300",
                                      dotColor: "bg-yellow-500",
                                      needsReview: true,
                                    };
                                  case 2:
                                    return {
                                      label: "Fuzzy Match",
                                      className:
                                        "bg-gradient-to-r from-orange-50 to-orange-100 text-orange-800 border-orange-300",
                                      dotColor: "bg-orange-500",
                                      needsReview: true,
                                    };
                                  case 1:
                                    return {
                                      label: "Search Result",
                                      className:
                                        "bg-gradient-to-r from-purple-50 to-purple-100 text-purple-800 border-purple-300",
                                      dotColor: "bg-purple-500",
                                      needsReview: false,
                                    };
                                  default:
                                    return {
                                      label: "Match",
                                      className:
                                        "bg-gradient-to-r from-gray-50 to-gray-100 text-gray-800 border-gray-300",
                                      dotColor: "bg-gray-500",
                                      needsReview: false,
                                    };
                                }
                              };

                              const confidenceBadge = getConfidenceBadge();

                              return (
                                <motion.div
                                  key={facility.place_id}
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{
                                    delay: idx * 0.04,
                                    duration: 0.3,
                                  }}
                                  whileTap={{ scale: 0.98 }}
                                  className="p-5 rounded-xl transition-all duration-300 cursor-pointer bg-gradient-to-br from-white to-gray-50/50 hover:from-gray-50 hover:to-gray-100/50 border-2 border-gray-200 hover:border-blue-300 shadow-sm hover:shadow-md"
                                >
                                  <div className="space-y-3">
                                    {/* Header: Name and Confidence Badge */}
                                    <div className="flex items-start justify-between gap-3">
                                      <h4 className="font-bold text-gray-900 text-base leading-tight flex-1">
                                        {facility.name}
                                      </h4>
                                      <div className="flex flex-col gap-1 items-end flex-shrink-0">
                                        <span
                                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold border shadow-sm ${confidenceBadge.className}`}
                                        >
                                          <span
                                            className={`w-1.5 h-1.5 rounded-full ${confidenceBadge.dotColor}`}
                                          ></span>
                                          {confidenceBadge.label}
                                        </span>
                                        {confidenceBadge.needsReview && (
                                          <span className="text-[10px] text-gray-500 italic font-medium">
                                            Needs review
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    {/* Address */}
                                    <div className="flex items-start gap-2">
                                      <MapPin className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                                      <p className="text-sm text-gray-600 leading-relaxed">
                                        {facility.address}
                                      </p>
                                    </div>

                                    {/* Phone */}
                                    {facility.phone && (
                                      <div className="flex items-center gap-2">
                                        <Phone className="w-4 h-4 text-blue-600 flex-shrink-0" />
                                        <p className="text-sm text-gray-700 font-medium">
                                          {facility.phone}
                                        </p>
                                      </div>
                                    )}

                                    {/* Sports Badges */}
                                    {facility.identified_sports &&
                                      facility.identified_sports.length > 0 && (
                                        <div className="flex flex-wrap gap-2">
                                          {facility.identified_sports
                                            .slice(0, 5)
                                            .map((sport) => (
                                              <span
                                                key={sport}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 rounded-lg text-xs font-semibold shadow-sm border border-blue-200"
                                              >
                                                <span className="text-base">
                                                  {SPORT_EMOJIS[sport] || "🏅"}
                                                </span>
                                                <span>{sport}</span>
                                              </span>
                                            ))}
                                          {facility.identified_sports.length >
                                            5 && (
                                            <span className="inline-flex items-center px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-semibold border border-gray-200">
                                              +
                                              {facility.identified_sports
                                                .length - 5}{" "}
                                              more
                                            </span>
                                          )}
                                        </div>
                                      )}

                                    {/* Rating */}
                                    {facility.rating && (
                                      <div className="flex items-center gap-2 text-sm">
                                        <div className="flex items-center gap-1">
                                          <span className="text-yellow-500 text-base">
                                            ★
                                          </span>
                                          <span className="font-bold text-gray-900">
                                            {facility.rating.toFixed(1)}
                                          </span>
                                        </div>
                                        <span className="text-gray-400">•</span>
                                        <span className="text-gray-500">
                                          {facility.user_ratings_total} reviews
                                        </span>
                                      </div>
                                    )}

                                    {/* Link to Lead Button */}
                                    <div className="pt-3 border-t border-gray-200">
                                      <button
                                        onClick={() =>
                                          handleLinkFacility(
                                            facility.place_id,
                                            facility.confidence,
                                            facility.matchReason,
                                            facility.name,
                                          )
                                        }
                                        disabled={createLinkMutation.isPending}
                                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 hover:border-blue-300 rounded-lg transition-all duration-200 hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                      >
                                        <Link2 className="w-4 h-4" />
                                        {createLinkMutation.isPending
                                          ? "Linking..."
                                          : "Link to Lead"}
                                      </button>
                                    </div>
                                  </div>
                                </motion.div>
                              );
                            })}
                          </div>
                      )}

                    {/* No Facilities Message */}
                    {linkedFacilities.length === 0 &&
                      unmatchedFacilities.length === 0 && (
                        <motion.div
                          initial={{ scale: 0.8, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ duration: 0.3 }}
                          className="text-center py-12"
                        >
                          <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center">
                            <Building2 className="w-8 h-8 text-gray-400" />
                          </div>
                          <p className="text-base font-semibold text-gray-700 mb-1">
                            {facilitySearchQuery.trim()
                              ? "No facilities match your search"
                              : "No matching facilities found"}
                          </p>
                          <p className="text-sm text-gray-500">
                            Try adjusting your search or check if the lead
                            details are correct
                          </p>
                          {onAddFacility && lead && (
                            <button
                              onClick={() => {
                                onAddFacility(
                                  lead.display_name || lead.name,
                                  lead.id,
                                );
                                onClose();
                              }}
                              className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer"
                            >
                              <Plus className="w-4 h-4" />
                              Add Facility
                            </button>
                          )}
                        </motion.div>
                      )}
                  </div>
                </>
              ) : null}
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Link Confirmation Modal */}
      <AnimatePresence>
        {isLinkConfirmModalOpen && pendingLinkFacility && (
          <motion.div key="link-confirmation-modal">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCancelLink}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[70]"
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-2xl shadow-2xl z-[70] p-6"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <Link2 className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">
                      Link Facility to Lead?
                    </h3>
                  </div>
                </div>
                <button
                  onClick={handleCancelLink}
                  className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* Body */}
              <div className="mb-6">
                <p className="text-sm text-gray-600 mb-3">
                  You are about to link this facility to the current lead:
                </p>
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="font-bold text-gray-900 mb-1">
                    {pendingLinkFacility.facilityName}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <span className="font-semibold">Match Quality:</span>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                        pendingLinkFacility.confidence === 5
                          ? "bg-green-100 text-green-800"
                          : pendingLinkFacility.confidence === 4
                            ? "bg-blue-100 text-blue-800"
                            : pendingLinkFacility.confidence === 3
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-orange-100 text-orange-800"
                      }`}
                    >
                      {pendingLinkFacility.matchReason}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={handleCancelLink}
                  disabled={createLinkMutation.isPending}
                  className="flex-1 px-4 py-2.5 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmLink}
                  disabled={createLinkMutation.isPending}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Link2 className="w-4 h-4" />
                  {createLinkMutation.isPending ? "Linking..." : "Link to Lead"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AnimatePresence>
  );
}
