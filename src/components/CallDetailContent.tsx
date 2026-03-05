'use client';

import React, { useState } from 'react';
import {
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  Clock,
  DollarSign,
  User,
  Calendar,
  Play,
  FileText,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useCloseCall, useCloseLead, useCloseCalls } from '@/hooks/useCloseCRM';

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

interface CallDetailContentProps {
  callId: string;
  leadId?: string;
}

export function CallDetailContent({ callId, leadId }: CallDetailContentProps) {
  const { data: call, isLoading: callLoading, error: callError } = useCloseCall(callId);
  const { data: lead } = useCloseLead(leadId || call?.lead_id || null);
  const { data: relatedCallsData } = useCloseCalls(
    call?.lead_id ? { lead_id: call.lead_id, _limit: 10 } : undefined
  );

  const [isSummaryExpanded, setIsSummaryExpanded] = useState(false);
  const [isTranscriptExpanded, setIsTranscriptExpanded] = useState(false);

  const relatedCalls = relatedCallsData?.calls?.filter((c) => c.id !== callId) || [];

  const getSpeakerName = (speakerLabel: string): string => {
    if (lead?.contacts && speakerLabel.startsWith('+')) {
      for (const contact of lead.contacts) {
        if (contact.phones) {
          for (const phone of contact.phones) {
            const normalizedLabel = speakerLabel.replace(/\D/g, '');
            const normalizedPhone = phone.phone.replace(/\D/g, '');
            if (normalizedLabel === normalizedPhone) {
              return contact.name || speakerLabel;
            }
          }
        }
      }
    }
    return speakerLabel;
  };

  const callContact = lead?.contacts?.find((contact) => {
    if (!call?.phone || !contact.phones) return false;
    const normalizedCallPhone = call.phone.replace(/\D/g, '');
    return contact.phones.some(
      (phone) => phone.phone.replace(/\D/g, '') === normalizedCallPhone
    );
  });

  if (callError) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
        <div>
          <p className="font-medium text-red-900">Failed to load call</p>
          <p className="text-sm text-red-700 mt-1">{callError.message}</p>
        </div>
      </div>
    );
  }

  if (callLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!call) return null;

  return (
    <div className="space-y-6">
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

      {/* Call Summary Section */}
      {call.recording_transcript?.summary_text && (() => {
        const fullSummary = renderFormattedSummary(call.recording_transcript.summary_text);
        const previewLength = 3;
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

            {hasValidDate && (
              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4 text-gray-400" />
                <div className="text-sm text-gray-700">
                  {new Date(call.date_created).toLocaleString()}
                </div>
              </div>
            )}

            {call.call_method && (
              <div className="text-sm">
                <span className="text-gray-600">Method: </span>
                <span className="font-medium text-gray-900 capitalize">
                  {call.call_method.replace('_', ' ')}
                </span>
              </div>
            )}

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
    </div>
  );
}
