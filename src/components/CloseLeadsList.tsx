'use client';

import { useCloseLeads, useCloseLeadStatuses } from '@/hooks/useCloseCRM';
import { Building2, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';

interface CloseLeadsListProps {
  onLeadClick?: (leadId: string) => void;
}

export function CloseLeadsList({ onLeadClick }: CloseLeadsListProps) {
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50; // Show 50 leads per page

  // Calculate skip for server-side pagination
  const skip = (currentPage - 1) * itemsPerPage;

  // Fetch leads with server-side pagination
  const { data: leadsData, isLoading: leadsLoading, error: leadsError } = useCloseLeads({
    _limit: itemsPerPage,
    _skip: skip,
  });
  const { data: statuses } = useCloseLeadStatuses();

  // Create a map of status_id to status_label for quick lookup
  const statusMap = useMemo(() => {
    if (!statuses) return new Map();
    return new Map(statuses.map((s) => [s.id, s.label]));
  }, [statuses]);

  // Get leads directly from API response (no client-side slicing)
  const leads = leadsData?.leads || [];
  const hasMore = leadsData?.hasMore || false;
  const totalLeads = leads.length;
  const startIndex = skip + 1;
  const endIndex = skip + totalLeads;

  if (leadsLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (leadsError) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-800 text-sm">Error loading leads: {leadsError.message}</p>
      </div>
    );
  }

  if (!leadsData?.leads || leadsData.leads.length === 0) {
    return (
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <p className="text-gray-600 text-sm">No leads found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with count */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Building2 className="w-5 h-5" />
          Leads {totalLeads > 0 && `(${startIndex}-${endIndex}${hasMore ? '+' : ''})`}
        </h3>
      </div>

      {/* Grid of lead cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {leads.map((lead) => {
          const statusLabel = statusMap.get(lead.status_id) || lead.status_label || 'Unknown';

          return (
            <div
              key={lead.id}
              onClick={() => onLeadClick?.(lead.id)}
              className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer flex flex-col"
            >
              {/* Lead header */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <h4 className="font-semibold text-gray-900 flex-1 line-clamp-1">
                  {lead.display_name || lead.name}
                </h4>
                {lead.url && (
                  <a
                    href={lead.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-blue-600 hover:text-blue-800 flex-shrink-0"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>

              {/* Status badge */}
              <div className="mb-3">
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {statusLabel}
                </span>
              </div>

              {/* Description */}
              {lead.description && (
                <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                  {lead.description}
                </p>
              )}

              {/* Address */}
              {lead.addresses && lead.addresses.length > 0 && lead.addresses[0].address_1 && (
                <p className="text-xs text-gray-500 mb-2 line-clamp-1">
                  {lead.addresses[0].city && `${lead.addresses[0].city}, `}
                  {lead.addresses[0].state}
                </p>
              )}

              {/* Contacts count */}
              {lead.contacts && lead.contacts.length > 0 && (
                <p className="text-xs text-gray-500 mb-2">
                  {lead.contacts.length} contact{lead.contacts.length !== 1 ? 's' : ''}
                </p>
              )}

              {/* Created date */}
              <p className="text-xs text-gray-400 mt-auto pt-2 border-t border-gray-100">
                Created: {new Date(lead.date_created).toLocaleDateString()}
              </p>
            </div>
          );
        })}
      </div>

      {/* Pagination Controls */}
      {totalLeads > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-gray-200">
          {/* Results info */}
          <div className="text-sm text-gray-600 font-medium">
            Showing {startIndex}-{endIndex} {hasMore && 'of many more'} leads
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
