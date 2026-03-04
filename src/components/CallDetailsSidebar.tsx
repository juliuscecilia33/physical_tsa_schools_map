'use client';

import React, { useState } from 'react';
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
} from 'lucide-react';
import { useCloseCall, useCloseLead, useCloseUser, useCloseCalls } from '@/hooks/useCloseCRM';

interface CallDetailsSidebarProps {
  callId: string | null;
  leadId?: string | null;
  onClose: () => void;
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

export function CallDetailsSidebar({ callId, leadId, onClose }: CallDetailsSidebarProps) {
  const { data: call, isLoading: callLoading, error: callError } = useCloseCall(callId);
  const { data: lead, isLoading: leadLoading, error: leadError } = useCloseLead(leadId || call?.lead_id || null);
  const { data: user } = useCloseUser(); // Get current user for now

  // Get related calls for the same lead
  const { data: relatedCallsData } = useCloseCalls(
    call?.lead_id ? { lead_id: call.lead_id, _limit: 10 } : undefined
  );

  const [isSummaryExpanded, setIsSummaryExpanded] = useState(false);

  const isOpen = !!callId;

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
    <AnimatePresence>
      {isOpen && (
        <>
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
                          {lead.status_label && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mt-2">
                              {lead.status_label}
                            </span>
                          )}
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
                              className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors mt-3"
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
                        {call.recording_transcript.utterances.map((utterance, idx) => {
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
        </>
      )}
    </AnimatePresence>
  );
}
