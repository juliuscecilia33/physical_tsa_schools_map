'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  Clock,
  DollarSign,
  User,
  Building2,
  Calendar,
  Play,
  FileText,
  AlertCircle,
  MapPin,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Link2,
  Search,
} from 'lucide-react';
import { useCloseCall, useCloseLead, useCloseUser, useCloseCalls } from '@/hooks/useCloseCRM';
import { useFacilityLeadLinks, useCreateFacilityLeadLink, useDeleteFacilityLeadLink } from '@/hooks/useFacilityLeadLinks';
import { Facility } from '@/types/facility';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { updateFacilityTags } from '@/utils/facilityCache';

const CLOSE_DATA_TAG_ID = 'ef3537b6-4d83-4eb8-84a5-9bc74e776c72';

const SPORT_EMOJIS: { [key: string]: string } = {
  Basketball: '🏀', Soccer: '⚽', Baseball: '⚾', Football: '🏈',
  Tennis: '🎾', Volleyball: '🏐', Swimming: '🏊', 'Track & Field': '🏃',
  Golf: '⛳', Hockey: '🏒', Lacrosse: '🥍', Softball: '🥎',
  Wrestling: '🤼', Gymnastics: '🤸', Pickleball: '🏓', Badminton: '🏸',
  'Gym/Fitness': '💪', CrossFit: '🏋️', Yoga: '🧘', 'Martial Arts': '🥋',
  Boxing: '🥊', Bowling: '🎳', Skating: '⛸️', Climbing: '🧗',
};

interface CallDetailsSidebarProps {
  callId: string | null;
  leadId?: string | null;
  onClose: () => void;
  facilities?: Facility[];
}

function formatDuration(seconds: number | undefined): string {
  if (!seconds) return 'N/A';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getDispositionColor(disposition: string | undefined): string {
  switch (disposition) {
    case 'answered':
      return 'bg-green-100 text-green-800';
    case 'vm-left':
    case 'vm-answer':
      return 'bg-yellow-100 text-yellow-800';
    case 'no-answer':
    case 'busy':
      return 'bg-orange-100 text-orange-800';
    case 'blocked':
    case 'error':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

function renderFormattedSummary(summaryText: string) {
  const lines = summaryText.split('\n').filter(line => line.trim());
  const elements: React.JSX.Element[] = [];
  let currentList: string[] = [];
  let key = 0;

  const flushList = () => {
    if (currentList.length > 0) {
      elements.push(
        <ul key={`list-${key++}`} className="list-disc list-inside space-y-1 mb-3">
          {currentList.map((item, idx) => (
            <li key={idx} className="text-sm text-gray-700 leading-relaxed">
              {item}
            </li>
          ))}
        </ul>
      );
      currentList = [];
    }
  };

  lines.forEach((line) => {
    if (line.startsWith('###')) {
      flushList();
      const heading = line.replace(/^###\s*/, '');
      elements.push(
        <h4 key={`heading-${key++}`} className="font-semibold text-gray-900 mt-4 mb-2 text-base">
          {heading}
        </h4>
      );
    } else if (line.startsWith('-')) {
      const text = line.replace(/^-\s*/, '');
      currentList.push(text);
    } else if (line.trim()) {
      flushList();
      elements.push(
        <p key={`text-${key++}`} className="text-sm text-gray-700 mb-2 leading-relaxed">
          {line}
        </p>
      );
    }
  });

  flushList();
  return elements;
}

export function CallDetailsSidebar({ callId, leadId, onClose, facilities = [] }: CallDetailsSidebarProps) {
  const { data: call, isLoading: callLoading, error: callError } = useCloseCall(callId);
  const { data: lead, isLoading: leadLoading, error: leadError } = useCloseLead(leadId || call?.lead_id || null);
  const { data: user } = useCloseUser(); // Get current user for now
  const { data: facilityLeadLinks = [] } = useFacilityLeadLinks(leadId || call?.lead_id || null);
  const createLinkMutation = useCreateFacilityLeadLink();
  const deleteLinkMutation = useDeleteFacilityLeadLink();
  const queryClient = useQueryClient();
  const supabase = createClient();

  // Get related calls for the same lead
  const { data: relatedCallsData } = useCloseCalls(
    call?.lead_id ? { lead_id: call.lead_id, _limit: 10 } : undefined
  );

  const [isSummaryExpanded, setIsSummaryExpanded] = useState(false);
  const [isTranscriptExpanded, setIsTranscriptExpanded] = useState(false);
  const [showFacilityPicker, setShowFacilityPicker] = useState(false);
  const [facilitySearchQuery, setFacilitySearchQuery] = useState('');
  const [isLinkConfirmModalOpen, setIsLinkConfirmModalOpen] = useState(false);
  const [pendingLinkFacility, setPendingLinkFacility] = useState<{
    placeId: string;
    confidence: number;
    matchReason: string;
    facilityName: string;
  } | null>(null);

  const isOpen = !!callId;

  // Utility functions for facility matching
  const normalizePhone = (phone: string | undefined): string => {
    if (!phone) return '';
    return phone.replace(/\D/g, '');
  };

  const extractCity = (address: string): string => {
    const parts = address.split(',');
    if (parts.length >= 2) {
      return parts[parts.length - 2].trim().toLowerCase();
    }
    return '';
  };

  const levenshteinDistance = (str1: string, str2: string): number => {
    const len1 = str1.length;
    const len2 = str2.length;
    const matrix: number[][] = [];
    for (let i = 0; i <= len1; i++) matrix[i] = [i];
    for (let j = 0; j <= len2; j++) matrix[0][j] = j;
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

  const isFuzzyMatch = (str1: string, str2: string, threshold: number = 0.8): boolean => {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();
    const maxLen = Math.max(s1.length, s2.length);
    if (maxLen === 0) return false;
    const distance = levenshteinDistance(s1, s2);
    return 1 - distance / maxLen >= threshold;
  };

  // Facility matching logic
  const matchedFacilities = useMemo(() => {
    if (!facilities || facilities.length === 0 || !lead) return [];

    const leadName = (lead.display_name || lead.name || '').toLowerCase().trim();
    const leadPhone = lead.contacts?.length ? normalizePhone(lead.contacts[0].phones?.[0]?.phone) : '';
    const leadAddress = lead.addresses?.length ? lead.addresses[0].address_1?.toLowerCase() || '' : '';
    const leadCity = lead.addresses?.length ? (lead.addresses[0].city || '').toLowerCase() : '';

    interface MatchResult extends Facility {
      confidence: number;
      matchReason: string;
    }

    const results: MatchResult[] = facilities
      .map((facility) => {
        let confidence = 0;
        let matchReason = '';

        if (leadPhone && facility.phone) {
          if (normalizePhone(facility.phone) === leadPhone) {
            return { ...facility, confidence: 5, matchReason: 'Phone match' };
          }
        }
        if (leadAddress && facility.address) {
          const fa = facility.address.toLowerCase();
          if (fa.includes(leadAddress) || leadAddress.includes(fa) || isFuzzyMatch(leadAddress, fa, 0.85)) {
            return { ...facility, confidence: 5, matchReason: 'Address match' };
          }
        }
        if (leadName && leadCity && facility.name && facility.address) {
          if (facility.name.toLowerCase() === leadName && extractCity(facility.address) === leadCity) {
            return { ...facility, confidence: 4, matchReason: 'Name + City match' };
          }
        }
        if (leadName && facility.name) {
          if (facility.name.toLowerCase() === leadName) {
            return { ...facility, confidence: 3, matchReason: 'Exact name match' };
          }
        }
        if (leadName && facility.name) {
          if (isFuzzyMatch(leadName, facility.name.toLowerCase(), 0.75)) {
            return { ...facility, confidence: 2, matchReason: 'Fuzzy name match' };
          }
        }

        return { ...facility, confidence, matchReason };
      })
      .filter((r) => r.confidence > 0);

    let filtered = results;
    if (facilitySearchQuery.trim()) {
      const q = facilitySearchQuery.toLowerCase();
      filtered = results.filter((f) => {
        return f.name.toLowerCase().includes(q) || f.address.toLowerCase().includes(q) ||
          f.identified_sports?.some((s) => s.toLowerCase().includes(q));
      });
    }

    return filtered
      .sort((a, b) => b.confidence !== a.confidence ? b.confidence - a.confidence : a.name.localeCompare(b.name))
      .slice(0, 50);
  }, [facilities, lead, facilitySearchQuery]);

  const linkedFacilities = useMemo(() => {
    if (!facilityLeadLinks || !facilities) return [];
    return facilityLeadLinks
      .map((link) => {
        const facility = facilities.find((f) => f.place_id === link.place_id);
        if (!facility) return null;
        return { ...facility, link, confidence: link.confidence, matchReason: link.match_reason };
      })
      .filter(Boolean) as ((typeof matchedFacilities)[0] & { link: (typeof facilityLeadLinks)[0] })[];
  }, [facilityLeadLinks, facilities]);

  const unmatchedFacilities = useMemo(() => {
    if (!linkedFacilities.length) return matchedFacilities;
    const linkedIds = new Set(linkedFacilities.map((f) => f.place_id));
    return matchedFacilities.filter((f) => !linkedIds.has(f.place_id));
  }, [matchedFacilities, linkedFacilities]);

  // Facility link handlers
  const handleLinkFacility = (placeId: string, confidence: number, matchReason: string, facilityName: string) => {
    setPendingLinkFacility({ placeId, confidence, matchReason, facilityName });
    setIsLinkConfirmModalOpen(true);
  };

  const assignCloseDataTag = async (placeId: string) => {
    try {
      const { error: insertError } = await supabase
        .from('facility_tag_assignments')
        .insert({ place_id: placeId, tag_id: CLOSE_DATA_TAG_ID });
      if (insertError && insertError.code !== '23505') return;

      const { data: tagData, error: tagError } = await supabase
        .from('facility_tags')
        .select('id, name, color, description')
        .eq('id', CLOSE_DATA_TAG_ID)
        .single();
      if (tagError || !tagData) return;

      const facility = facilities.find((f) => f.place_id === placeId);
      const currentTags = facility?.tags ?? [];
      if (!currentTags.some((t) => t.id === CLOSE_DATA_TAG_ID)) {
        updateFacilityTags(queryClient, placeId, [...currentTags, tagData]);
      }
    } catch (error) {
      console.error('Error in assignCloseDataTag:', error);
    }
  };

  const handleConfirmLink = async () => {
    if (!lead?.id || !pendingLinkFacility) return;
    try {
      await createLinkMutation.mutateAsync({
        place_id: pendingLinkFacility.placeId,
        close_lead_id: lead.id,
        confidence: pendingLinkFacility.confidence,
        match_reason: pendingLinkFacility.matchReason,
      });
      await assignCloseDataTag(pendingLinkFacility.placeId);
      setIsLinkConfirmModalOpen(false);
      setPendingLinkFacility(null);
      setShowFacilityPicker(false);
    } catch (error) {
      console.error('Error linking facility:', error);
      alert('Failed to link facility. Please try again.');
    }
  };

  const handleCancelLink = () => {
    setIsLinkConfirmModalOpen(false);
    setPendingLinkFacility(null);
  };

  // Filter out the current call from related calls
  const relatedCalls = relatedCallsData?.calls?.filter((c) => c.id !== callId) || [];

  // Helper function to get speaker name from speaker_label
  const getSpeakerName = (speakerLabel: string): string => {
    // Try to match phone number to contact
    if (lead?.contacts && speakerLabel.startsWith('+')) {
      for (const contact of lead.contacts) {
        if (contact.phones) {
          for (const phone of contact.phones) {
            // Normalize phone numbers for comparison
            const normalizedLabel = speakerLabel.replace(/\D/g, '');
            const normalizedPhone = phone.phone.replace(/\D/g, '');
            if (normalizedLabel === normalizedPhone) {
              return contact.name || speakerLabel;
            }
          }
        }
      }
    }
    // If no match found, return the original label
    return speakerLabel;
  };

  // Find the contact this call was with
  const callContact = lead?.contacts?.find((contact) => {
    if (!call?.phone || !contact.phones) return false;
    const normalizedCallPhone = call.phone.replace(/\D/g, '');
    return contact.phones.some(
      (phone) => phone.phone.replace(/\D/g, '') === normalizedCallPhone
    );
  });

  return (
    <>
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="call-details-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
        />
      )}
      {isOpen && (
        <motion.div
          key="call-details-sidebar"
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className="fixed right-0 top-0 h-full w-full max-w-2xl bg-white shadow-2xl z-50 overflow-hidden flex flex-col"
        >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-white">
              <div className="flex-1 min-w-0 flex items-center gap-3">
                {call?.direction === 'inbound' ? (
                  <PhoneIncoming className="w-6 h-6 text-blue-600" />
                ) : (
                  <PhoneOutgoing className="w-6 h-6 text-green-600" />
                )}
                <div>
                  <h2 className="text-xl font-bold text-gray-900 capitalize">
                    {callLoading ? 'Loading...' : `${call?.direction || ''} Call`}
                  </h2>
                  {call?.phone && (
                    <p className="text-sm text-gray-600 mt-1">{call.phone}</p>
                  )}
                </div>
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
              {callError && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-red-900">Failed to load call</p>
                    <p className="text-sm text-red-700 mt-1">{callError.message}</p>
                  </div>
                </div>
              )}

              {callLoading ? (
                <div className="flex items-center justify-center p-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                </div>
              ) : call ? (
                <>
                  {/* Contact Information Section */}
                  {callContact && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 space-y-3">
                      <h3 className="text-sm font-semibold text-blue-900 uppercase tracking-wider flex items-center gap-2">
                        <User className="w-4 h-4" />
                        Contact
                      </h3>
                      <div>
                        <p className="font-medium text-gray-900 text-base">{callContact.name || 'Unknown'}</p>
                        {callContact.title && (
                          <p className="text-sm text-gray-600 mt-1">{callContact.title}</p>
                        )}
                      </div>
                      {callContact.emails && callContact.emails.length > 0 && (
                        <div className="text-sm text-gray-700">
                          <span className="text-gray-500">Email: </span>
                          <a
                            href={`mailto:${callContact.emails[0].email}`}
                            className="text-blue-600 hover:underline"
                          >
                            {callContact.emails[0].email}
                          </a>
                        </div>
                      )}
                      {call.phone && (
                        <div className="text-sm text-gray-700">
                          <span className="text-gray-500">Phone: </span>
                          <a
                            href={`tel:${call.phone}`}
                            className="text-blue-600 hover:underline"
                          >
                            {call.phone}
                          </a>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Lead Information Section */}
                  <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-3">
                    <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                      <Building2 className="w-4 h-4" />
                      Lead Information
                    </h3>

                    {leadLoading ? (
                      <div className="space-y-3">
                        <div className="h-5 bg-gray-200 rounded animate-pulse w-3/4"></div>
                        <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2"></div>
                        <div className="h-4 bg-gray-200 rounded animate-pulse w-2/3"></div>
                      </div>
                    ) : leadError ? (
                      <div className="flex items-start gap-2 text-red-600">
                        <AlertCircle className="w-4 h-4 mt-0.5" />
                        <div className="text-sm">
                          <p className="font-medium">Failed to load lead information</p>
                          <p className="text-xs text-red-500 mt-1">{leadError.message}</p>
                        </div>
                      </div>
                    ) : lead ? (
                      <div className="space-y-3">
                        <div>
                          <p className="font-medium text-gray-900 text-base">{lead.display_name || lead.name}</p>
                          <div className="flex items-center gap-2 flex-wrap mt-2">
                            {lead.status_label && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                {lead.status_label}
                              </span>
                            )}
                            {facilityLeadLinks.length > 0 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                <Link2 className="w-3 h-3" />
                                Linked to Facility
                              </span>
                            ) : (
                              <button
                                onClick={() => setShowFacilityPicker(!showFacilityPicker)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors cursor-pointer"
                              >
                                <Link2 className="w-3 h-3" />
                                Link Lead to Facility
                              </button>
                            )}
                          </div>
                        </div>

                        {lead.addresses && lead.addresses.length > 0 && lead.addresses[0].address_1 && (
                          <div className="flex items-start gap-3">
                            <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                            <div className="text-sm text-gray-700">
                              {lead.addresses[0].address_1}
                              {lead.addresses[0].city && (
                                <div>
                                  {lead.addresses[0].city}
                                  {lead.addresses[0].state && `, ${lead.addresses[0].state}`}
                                  {lead.addresses[0].zipcode && ` ${lead.addresses[0].zipcode}`}
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {lead.contacts && lead.contacts.length > 0 && lead.contacts[0] && (
                          <div className="pt-2 border-t border-gray-200">
                            <p className="text-xs text-gray-500 mb-1">Primary Contact</p>
                            <p className="text-sm font-medium text-gray-900">{lead.contacts[0].name}</p>
                            {lead.contacts[0].emails && lead.contacts[0].emails.length > 0 && (
                              <a
                                href={`mailto:${lead.contacts[0].emails[0].email}`}
                                className="text-sm text-blue-600 hover:underline"
                              >
                                {lead.contacts[0].emails[0].email}
                              </a>
                            )}
                          </div>
                        )}

                        <div className="pt-2">
                          <a
                            href={`https://app.close.com/lead/${leadId || call.lead_id}/`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            View in Close CRM
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    ) : (leadId || call.lead_id) ? (
                      <p className="text-sm text-gray-500 italic">No lead data available</p>
                    ) : (
                      <p className="text-sm text-gray-500 italic">No lead associated with this call</p>
                    )}
                  </div>

                  {/* Facility Picker Section */}
                  {showFacilityPicker && facilityLeadLinks.length === 0 && lead && (
                    <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                          <Building2 className="w-4 h-4" />
                          Match Facility
                          {unmatchedFacilities.length > 0 && (
                            <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold text-white bg-blue-600 rounded-full">
                              {unmatchedFacilities.length}
                            </span>
                          )}
                        </h3>
                        <button
                          onClick={() => setShowFacilityPicker(false)}
                          className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          <X className="w-4 h-4 text-gray-400" />
                        </button>
                      </div>

                      {/* Search */}
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          value={facilitySearchQuery}
                          onChange={(e) => setFacilitySearchQuery(e.target.value)}
                          placeholder="Search by name, location, or sport..."
                          className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>

                      {/* Matched Facilities */}
                      {unmatchedFacilities.length > 0 ? (
                        <div className="space-y-3 max-h-[400px] overflow-y-auto">
                          {unmatchedFacilities.map((facility, idx) => {
                            const getConfidenceBadge = () => {
                              switch (facility.confidence) {
                                case 5: return { label: 'High Match', className: 'bg-gradient-to-r from-green-50 to-green-100 text-green-800 border-green-300', dotColor: 'bg-green-500' };
                                case 4: return { label: 'Name + City', className: 'bg-gradient-to-r from-blue-50 to-blue-100 text-blue-800 border-blue-300', dotColor: 'bg-blue-500' };
                                case 3: return { label: 'Name Match', className: 'bg-gradient-to-r from-yellow-50 to-yellow-100 text-yellow-800 border-yellow-300', dotColor: 'bg-yellow-500' };
                                case 2: return { label: 'Fuzzy Match', className: 'bg-gradient-to-r from-orange-50 to-orange-100 text-orange-800 border-orange-300', dotColor: 'bg-orange-500' };
                                default: return { label: 'Match', className: 'bg-gradient-to-r from-gray-50 to-gray-100 text-gray-800 border-gray-300', dotColor: 'bg-gray-500' };
                              }
                            };
                            const badge = getConfidenceBadge();

                            return (
                              <motion.div
                                key={facility.place_id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.04, duration: 0.3 }}
                                className="p-4 rounded-xl bg-gradient-to-br from-white to-gray-50/50 border-2 border-gray-200 hover:border-blue-300 shadow-sm hover:shadow-md transition-all duration-300"
                              >
                                <div className="space-y-2">
                                  <div className="flex items-start justify-between gap-2">
                                    <h4 className="font-bold text-gray-900 text-sm leading-tight flex-1">
                                      {facility.name}
                                    </h4>
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border shadow-sm flex-shrink-0 ${badge.className}`}>
                                      <span className={`w-1.5 h-1.5 rounded-full ${badge.dotColor}`}></span>
                                      {badge.label}
                                    </span>
                                  </div>

                                  <div className="flex items-start gap-2">
                                    <MapPin className="w-3.5 h-3.5 text-blue-600 flex-shrink-0 mt-0.5" />
                                    <p className="text-xs text-gray-600">{facility.address}</p>
                                  </div>

                                  {facility.phone && (
                                    <div className="flex items-center gap-2">
                                      <Phone className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                                      <p className="text-xs text-gray-700 font-medium">{facility.phone}</p>
                                    </div>
                                  )}

                                  {facility.identified_sports && facility.identified_sports.length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                      {facility.identified_sports.slice(0, 4).map((sport) => (
                                        <span key={sport} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded-md text-[10px] font-semibold border border-blue-200">
                                          <span>{SPORT_EMOJIS[sport] || '🏅'}</span>
                                          {sport}
                                        </span>
                                      ))}
                                      {facility.identified_sports.length > 4 && (
                                        <span className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-600 rounded-md text-[10px] font-semibold border border-gray-200">
                                          +{facility.identified_sports.length - 4} more
                                        </span>
                                      )}
                                    </div>
                                  )}

                                  <div className="pt-2 border-t border-gray-200">
                                    <button
                                      onClick={() => handleLinkFacility(facility.place_id, facility.confidence, facility.matchReason, facility.name)}
                                      disabled={createLinkMutation.isPending}
                                      className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 hover:border-blue-300 rounded-lg transition-all duration-200 hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                    >
                                      <Link2 className="w-3.5 h-3.5" />
                                      {createLinkMutation.isPending ? 'Linking...' : 'Link to Lead'}
                                    </button>
                                  </div>
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <Building2 className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                          <p className="text-sm font-medium text-gray-600">
                            {facilitySearchQuery.trim() ? 'No facilities match your search' : 'No matching facilities found'}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            Try adjusting your search or check if the lead details are correct
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Call Summary Section */}
                  {call.recording_transcript?.summary_text && (() => {
                    const fullSummary = renderFormattedSummary(call.recording_transcript.summary_text);
                    const previewLength = 3; // Show first 3 elements in preview
                    const summaryPreview = fullSummary.slice(0, previewLength);
                    const hasMore = fullSummary.length > previewLength;

                    return (
                      <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-3">
                        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                          <FileText className="w-4 h-4" />
                          Call Summary
                        </h3>
                        <div className="space-y-2">
                          <div className={`overflow-hidden transition-all duration-300 ${
                            isSummaryExpanded ? 'max-h-[5000px]' : 'max-h-[300px]'
                          }`}>
                            {isSummaryExpanded ? fullSummary : summaryPreview}
                            {!isSummaryExpanded && hasMore && (
                              <div className="mt-2 text-gray-400 text-sm">...</div>
                            )}
                          </div>
                          {hasMore && (
                            <button
                              onClick={() => setIsSummaryExpanded(!isSummaryExpanded)}
                              className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors mt-3 cursor-pointer"
                            >
                              {isSummaryExpanded ? (
                                <>
                                  <ChevronUp className="w-4 h-4" />
                                  Show less
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="w-4 h-4" />
                                  Show more
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Call Details Section */}
                  {(() => {
                    // Check if we have any valid data to show in Call Details
                    const hasValidDate = call.date_created && !isNaN(new Date(call.date_created).getTime());
                    const hasCallDetails =
                      call.disposition ||
                      call.duration !== undefined ||
                      hasValidDate ||
                      call.call_method ||
                      call.cost !== undefined ||
                      call.user_name;

                    if (!hasCallDetails) return null;

                    return (
                      <div className="bg-gray-50 rounded-lg p-5 space-y-4">
                        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                          <Phone className="w-4 h-4" />
                          Call Details
                        </h3>

                        {/* Disposition Badge */}
                        {call.disposition && (
                          <div>
                            <span
                              className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getDispositionColor(
                                call.disposition
                              )}`}
                            >
                              {call.disposition.replace('-', ' ')}
                            </span>
                          </div>
                        )}

                        {/* Duration */}
                        {call.duration !== undefined && (
                          <div className="flex items-center gap-3">
                            <Clock className="w-4 h-4 text-gray-400" />
                            <div className="text-sm">
                              <span className="text-gray-600">Duration: </span>
                              <span className="font-medium text-gray-900">
                                {formatDuration(call.duration)}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Date/Time */}
                        {hasValidDate && (
                          <div className="flex items-center gap-3">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <div className="text-sm text-gray-700">
                              {new Date(call.date_created).toLocaleString()}
                            </div>
                          </div>
                        )}

                        {/* Call Method */}
                        {call.call_method && (
                          <div className="text-sm">
                            <span className="text-gray-600">Method: </span>
                            <span className="font-medium text-gray-900 capitalize">
                              {call.call_method.replace('_', ' ')}
                            </span>
                          </div>
                        )}

                        {/* Cost */}
                        {call.cost !== undefined && (
                          <div className="flex items-center gap-3">
                            <DollarSign className="w-4 h-4 text-gray-400" />
                            <div className="text-sm">
                              <span className="text-gray-600">Cost: </span>
                              <span className="font-medium text-gray-900">
                                ${(parseInt(call.cost || '0') / 100).toFixed(2)}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* User */}
                        {call.user_name && (
                          <div className="flex items-center gap-3">
                            <User className="w-4 h-4 text-gray-400" />
                            <div className="text-sm">
                              <span className="text-gray-600">Made by: </span>
                              <span className="font-medium text-gray-900">{call.user_name}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Notes Section */}
                  {call.note && (
                    <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-3">
                      <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        Notes
                      </h3>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{call.note}</p>
                    </div>
                  )}

                  {/* Recording Section */}
                  {(call.recording_url || call.voicemail_url) && (
                    <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-3">
                      <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                        <Play className="w-4 h-4" />
                        Recording
                      </h3>
                      {call.recording_url && (
                        <a
                          href={call.recording_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                        >
                          <Play className="w-4 h-4" />
                          Play Call Recording
                        </a>
                      )}
                      {call.voicemail_url && (
                        <a
                          href={call.voicemail_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
                        >
                          <Play className="w-4 h-4" />
                          Play Voicemail
                        </a>
                      )}
                    </div>
                  )}

                  {/* Transcript Section */}
                  {call.recording_transcript && call.recording_transcript.utterances && (
                    <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
                      <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        Full Transcript
                      </h3>
                      <div className="space-y-4">
                        {(isTranscriptExpanded
                          ? call.recording_transcript.utterances
                          : call.recording_transcript.utterances.slice(0, 6)
                        ).map((utterance, idx) => {
                          const speakerName = getSpeakerName(utterance.speaker_label);
                          const speakerSide = utterance.speaker_side;
                          const isCloseUser = speakerSide === 'close-user';

                          return (
                            <div
                              key={idx}
                              className={`flex ${isCloseUser ? 'justify-end' : 'justify-start'}`}
                            >
                              <div className={`max-w-[75%] ${isCloseUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                                <div className="flex items-center gap-2 px-1">
                                  <span className="text-xs font-medium text-gray-600">
                                    {speakerName}
                                  </span>
                                  {isCloseUser && (
                                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                                      You
                                    </span>
                                  )}
                                </div>
                                <div
                                  className={`rounded-2xl px-4 py-3 text-sm shadow-sm ${
                                    isCloseUser
                                      ? 'bg-blue-600 text-white rounded-tr-sm'
                                      : 'bg-gray-100 text-gray-900 rounded-tl-sm'
                                  }`}
                                >
                                  <p className="leading-relaxed">{utterance.text}</p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {call.recording_transcript.utterances.length > 6 && (
                        <button
                          onClick={() => setIsTranscriptExpanded(!isTranscriptExpanded)}
                          className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors mt-3 cursor-pointer"
                        >
                          {isTranscriptExpanded ? (
                            <>
                              <ChevronUp className="w-4 h-4" />
                              Show less
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-4 h-4" />
                              Show more ({call.recording_transcript.utterances.length - 6} more messages)
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Related Calls Section */}
                  {relatedCalls.length > 0 && (
                    <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-3">
                      <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                        <Phone className="w-4 h-4" />
                        Call History ({relatedCalls.length} other calls)
                      </h3>
                      <div className="space-y-2">
                        {relatedCalls.slice(0, 5).map((relatedCall) => (
                          <div
                            key={relatedCall.id}
                            className="p-3 bg-gray-50 rounded-lg text-sm"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {relatedCall.direction === 'inbound' ? (
                                  <PhoneIncoming className="w-4 h-4 text-blue-600" />
                                ) : (
                                  <PhoneOutgoing className="w-4 h-4 text-green-600" />
                                )}
                                <span className="font-medium text-gray-900 capitalize">
                                  {relatedCall.direction}
                                </span>
                              </div>
                              <span className="text-xs text-gray-500">
                                {new Date(relatedCall.date_created).toLocaleDateString()}
                              </span>
                            </div>
                            {relatedCall.disposition && (
                              <p className="text-xs text-gray-600 mt-1">
                                {relatedCall.disposition.replace('-', ' ')}
                              </p>
                            )}
                          </div>
                        ))}
                        {relatedCalls.length > 5 && (
                          <p className="text-xs text-gray-500 text-center pt-2">
                            +{relatedCalls.length - 5} more calls
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </>
              ) : null}
            </div>
          </motion.div>
      )}
    </AnimatePresence>

    <AnimatePresence>
        {isLinkConfirmModalOpen && pendingLinkFacility && (
          <motion.div key="link-confirmation-modal">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCancelLink}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[70]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-2xl shadow-2xl z-[70] p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <Link2 className="w-5 h-5 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">Link Facility to Lead?</h3>
                </div>
                <button onClick={handleCancelLink} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="mb-6">
                <p className="text-sm text-gray-600 mb-3">You are about to link this facility to the current lead:</p>
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="font-bold text-gray-900 mb-1">{pendingLinkFacility.facilityName}</p>
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <span className="font-semibold">Match Quality:</span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                      pendingLinkFacility.confidence === 5 ? 'bg-green-100 text-green-800'
                        : pendingLinkFacility.confidence === 4 ? 'bg-blue-100 text-blue-800'
                        : pendingLinkFacility.confidence === 3 ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-orange-100 text-orange-800'
                    }`}>
                      {pendingLinkFacility.matchReason}
                    </span>
                  </div>
                </div>
              </div>

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
                  {createLinkMutation.isPending ? 'Linking...' : 'Link to Lead'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
