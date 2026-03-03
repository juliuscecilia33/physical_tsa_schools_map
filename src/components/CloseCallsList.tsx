'use client';

import { useState } from 'react';
import { useCloseCalls } from '@/hooks/useCloseCRM';
import { Phone, PhoneIncoming, PhoneOutgoing, Play, Clock, ChevronLeft, ChevronRight } from 'lucide-react';

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

interface CloseCallsListProps {
  onCallClick?: (callId: string) => void;
}

export function CloseCallsList({ onCallClick }: CloseCallsListProps) {
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;
  const skip = (currentPage - 1) * itemsPerPage;

  // Fetch calls with server-side pagination
  const { data, isLoading, error } = useCloseCalls({
    _limit: itemsPerPage,
    _skip: skip,
  });

  const calls = data?.calls || [];
  const hasMore = data?.hasMore || false;
  const totalCalls = calls.length;
  const startIndex = skip + 1;
  const endIndex = skip + totalCalls;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-800 text-sm">Error loading calls: {error.message}</p>
      </div>
    );
  }

  if (!calls || calls.length === 0) {
    return (
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <p className="text-gray-600 text-sm">No calls found</p>
      </div>
    );
  }

  const callsWithRecordings = calls.filter((c) => c.recording_url).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Phone className="w-5 h-5" />
          Calls {totalCalls > 0 && `(${startIndex}-${endIndex}${hasMore ? '+' : ''})`}
        </h3>
        {callsWithRecordings > 0 && (
          <span className="text-sm text-gray-600">
            {callsWithRecordings} with recordings
          </span>
        )}
      </div>

      <div className="space-y-2">
        {calls.map((call) => (
          <div
            key={call.id}
            onClick={() => onCallClick?.(call.id)}
            className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer"
          >
            <div className="flex items-start gap-3">
              {/* Direction Icon */}
              <div className="mt-1">
                {call.direction === 'inbound' ? (
                  <PhoneIncoming className="w-5 h-5 text-blue-600" />
                ) : (
                  <PhoneOutgoing className="w-5 h-5 text-green-600" />
                )}
              </div>

              {/* Call Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-gray-900 capitalize">
                    {call.direction} Call
                  </span>
                  {call.phone && (
                    <span className="text-sm text-gray-600">{call.phone}</span>
                  )}
                  {call.disposition && (
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getDispositionColor(
                        call.disposition
                      )}`}
                    >
                      {call.disposition.replace('-', ' ')}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-gray-600">
                  {call.duration !== undefined && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {formatDuration(call.duration)}
                    </span>
                  )}
                  <span className="text-xs text-gray-400">
                    {new Date(call.date_created).toLocaleString()}
                  </span>
                  {call.user_name && (
                    <span className="text-xs text-gray-500">by {call.user_name}</span>
                  )}
                </div>

                {call.note && (
                  <p className="mt-2 text-sm text-gray-700 line-clamp-2">{call.note}</p>
                )}

                {/* Recording Link */}
                {call.recording_url && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <a
                      href={call.recording_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      <Play className="w-4 h-4" />
                      Play Recording
                    </a>
                  </div>
                )}

                {call.voicemail_url && (
                  <div className="mt-2">
                    <a
                      href={call.voicemail_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-2 text-sm text-purple-600 hover:text-purple-800 font-medium"
                    >
                      <Play className="w-4 h-4" />
                      Play Voicemail
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination Controls */}
      {totalCalls > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-gray-200">
          {/* Results info */}
          <div className="text-sm text-gray-600 font-medium">
            Showing {startIndex}-{endIndex} {hasMore && 'of many more'} calls
          </div>

          {/* Page controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg border border-gray-200 text-gray-700 bg-white hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </button>

            <div className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700">
              Page <span className="font-bold text-gray-900">{currentPage}</span>
              {hasMore && <span className="text-gray-500">(more available)</span>}
            </div>

            <button
              onClick={() => setCurrentPage((p) => p + 1)}
              disabled={!hasMore}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg border border-gray-200 text-gray-700 bg-white hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
