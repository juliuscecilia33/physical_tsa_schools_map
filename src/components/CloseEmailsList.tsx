'use client';

import { useState, useEffect } from 'react';
import { useCloseEmails } from '@/hooks/useCloseCRM';
import { Mail, ArrowDownToLine, ArrowUpFromLine, LayoutGrid, Table, Filter } from 'lucide-react';
import { CloseEmailsTable } from './CloseEmailsTable';

interface CloseEmailsListProps {
  onEmailClick?: (emailThreadId: string, leadId: string | null) => void;
}

export function CloseEmailsList({ onEmailClick }: CloseEmailsListProps) {
  // View mode state (table or card)
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');

  // Sidebar and filter state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeFilterCount, setActiveFilterCount] = useState(0);

  // Load view preference from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedView = localStorage.getItem('emails-view-mode');
      if (savedView === 'table' || savedView === 'card') {
        setViewMode(savedView);
      }
    }
  }, []);

  // Save view preference to localStorage when it changes
  const handleViewChange = (mode: 'table' | 'card') => {
    setViewMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('emails-view-mode', mode);
    }
  };

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;
  const skip = (currentPage - 1) * itemsPerPage;

  // Fetch emails with server-side pagination
  const { data, isLoading, error } = useCloseEmails({
    _limit: itemsPerPage,
    _skip: skip,
  });

  const emails = data?.emails || [];
  const hasMore = data?.hasMore || false;
  const totalEmails = emails.length;
  const startIndex = skip + 1;
  const endIndex = skip + totalEmails;

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
        <p className="text-red-800 text-sm">Error loading emails: {error.message}</p>
      </div>
    );
  }

  if (!emails || emails.length === 0) {
    return (
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <p className="text-gray-600 text-sm">No email threads found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Mail className="w-5 h-5" />
          Email Threads {totalEmails > 0 && `(${startIndex}-${endIndex}${hasMore ? '+' : ''})`}
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
              onClick={() => handleViewChange('card')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                viewMode === 'card'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              title="Card view"
            >
              <LayoutGrid className="w-4 h-4" />
              Cards
            </button>
          </div>
        </div>
      </div>

      {/* Conditional view rendering */}
      {viewMode === 'table' ? (
        <CloseEmailsTable
          emails={emails}
          onEmailClick={onEmailClick}
          isLoading={false}
          isSidebarOpen={isSidebarOpen}
          setIsSidebarOpen={setIsSidebarOpen}
          onFilterCountChange={setActiveFilterCount}
        />
      ) : (
        /* Card view */
        <div className="space-y-2">
          {emails.map((email) => {
            const latestEmail = email.latest_emails?.[0];
            const direction = latestEmail?.direction;
            const subject = email.latest_normalized_subject || email.subject || '(No Subject)';
            const preview = latestEmail?.body_preview;
            const hasAttachments = latestEmail?.has_attachments;

            return (
              <div
                key={email.id}
                onClick={() => onEmailClick?.(email.id, email.lead_id || null)}
                className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer"
              >
                <div className="flex items-start gap-3">
                  {/* Direction Icon */}
                  <div className="mt-1">
                    {direction === 'incoming' ? (
                      <ArrowDownToLine className="w-5 h-5 text-blue-600" />
                    ) : direction === 'outgoing' ? (
                      <ArrowUpFromLine className="w-5 h-5 text-green-600" />
                    ) : (
                      <Mail className="w-5 h-5 text-gray-600" />
                    )}
                  </div>

                  {/* Email Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-gray-900 truncate">
                          {subject}
                        </h4>
                        {direction && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 mt-1 capitalize">
                            {direction}
                          </span>
                        )}
                      </div>
                    </div>

                    {preview && (
                      <p className="mt-2 text-sm text-gray-600 line-clamp-2">
                        {preview}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-3 mt-2">
                      <span className="text-xs text-gray-400">
                        {new Date(email.activity_at || email.date_created).toLocaleString()}
                      </span>
                      {email.user_name && (
                        <span className="text-xs text-gray-500">by {email.user_name}</span>
                      )}
                      {latestEmail?.status && (
                        <span className="text-xs text-gray-500 capitalize">{latestEmail.status}</span>
                      )}
                      {email.n_emails && email.n_emails > 1 && (
                        <span className="text-xs text-gray-500">{email.n_emails} emails</span>
                      )}
                      {hasAttachments && (
                        <span className="text-xs text-gray-500">Has attachments</span>
                      )}
                    </div>

                    {email.participants && email.participants.length > 0 && (
                      <div className="mt-2 text-xs text-gray-400">
                        <span>Participants: {email.participants.map(p => p.email).join(', ')}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {(currentPage > 1 || hasMore) && (
        <div className="flex items-center justify-between border-t border-gray-200 pt-4">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {currentPage}
          </span>
          <button
            onClick={() => setCurrentPage((p) => p + 1)}
            disabled={!hasMore}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
