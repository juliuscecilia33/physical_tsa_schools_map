'use client';

import { useCloseLeads, useCloseLeadStatuses, useSearchCloseLeads } from '@/hooks/useCloseCRM';
import { Building2, ExternalLink, ChevronLeft, ChevronRight, LayoutGrid, Table, Filter, Search, X, Loader2 } from 'lucide-react';
import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { CloseLeadsTable } from './CloseLeadsTable';

interface CloseLeadsListProps {
  onLeadClick?: (leadId: string) => void;
}

export function CloseLeadsList({ onLeadClick }: CloseLeadsListProps) {
  // View mode state (table or grid)
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  // Search state
  const [searchInput, setSearchInput] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedQuery(value.trim());
    }, 400);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  const isSearchActive = debouncedQuery.length >= 2;
  const { data: searchData, isLoading: searchLoading, error: searchError } = useSearchCloseLeads(debouncedQuery);

  // Sidebar and filter state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeFilterCount, setActiveFilterCount] = useState(0);

  // Load view preference from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedView = localStorage.getItem('leads-view-mode');
      if (savedView === 'table' || savedView === 'grid') {
        setViewMode(savedView);
      }
    }
  }, []);

  // Save view preference to localStorage when it changes
  const handleViewChange = (mode: 'table' | 'grid') => {
    setViewMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('leads-view-mode', mode);
    }
  };

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
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={searchInput}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search all leads by name..."
          className="w-full pl-10 pr-10 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
        />
        {searchInput && (
          <button
            onClick={() => { setSearchInput(''); setDebouncedQuery(''); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Header with count and view toggle */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Building2 className="w-5 h-5" />
          Leads {totalLeads > 0 && `(${startIndex}-${endIndex}${hasMore ? '+' : ''})`}
        </h3>

        {/* Filters and View Toggle */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            <Filter className="w-4 h-4" />
            Filters
            {activeFilterCount > 0 && (
              <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold text-white bg-blue-600 rounded-full">
                {activeFilterCount}
              </span>
            )}
          </button>

          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => handleViewChange('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                viewMode === 'table'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              title="Table view"
            >
              <Table className="w-4 h-4" />
              Table
            </button>
            <button
              onClick={() => handleViewChange('grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                viewMode === 'grid'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              title="Grid view"
            >
              <LayoutGrid className="w-4 h-4" />
              Grid
            </button>
          </div>
        </div>
      </div>

      {/* Search Results */}
      {isSearchActive ? (
        <div>
          {searchLoading ? (
            <div className="flex items-center justify-center p-8 gap-2 text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Searching leads...</span>
            </div>
          ) : searchError ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 text-sm">Search error: {searchError.message}</p>
            </div>
          ) : searchData && searchData.leads.length > 0 ? (
            <div>
              <p className="text-sm text-gray-500 mb-3">
                {searchData.totalResults} result{searchData.totalResults !== 1 ? 's' : ''} found
              </p>
              <div className="divide-y divide-gray-200 border border-gray-200 rounded-lg overflow-hidden">
                {searchData.leads.map((lead) => {
                  const statusLabel = statusMap.get(lead.status_id) || lead.status_label || 'Unknown';
                  return (
                    <div
                      key={lead.id}
                      onClick={() => onLeadClick?.(lead.id)}
                      className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900 truncate">{lead.display_name || lead.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                            {statusLabel}
                          </span>
                          {lead.addresses?.[0]?.city && (
                            <span className="text-xs text-gray-500">{lead.addresses[0].city}{lead.addresses[0].state ? `, ${lead.addresses[0].state}` : ''}</span>
                          )}
                        </div>
                      </div>
                      {lead.contacts && lead.contacts.length > 0 && (
                        <span className="text-xs text-gray-400 ml-4 flex-shrink-0">
                          {lead.contacts.length} contact{lead.contacts.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-center">
              <p className="text-gray-500 text-sm">No leads found for &ldquo;{debouncedQuery}&rdquo;</p>
            </div>
          )}
        </div>
      ) : (
      <>
      {/* Conditional view rendering */}
      {viewMode === 'table' ? (
        <CloseLeadsTable
          leads={leads}
          statusMap={statusMap}
          onLeadClick={onLeadClick}
          isLoading={false}
          isSidebarOpen={isSidebarOpen}
          setIsSidebarOpen={setIsSidebarOpen}
          onFilterCountChange={setActiveFilterCount}
        />
      ) : (
        /* Grid of lead cards */
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
      )}

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
      </>
      )}
    </div>
  );
}
