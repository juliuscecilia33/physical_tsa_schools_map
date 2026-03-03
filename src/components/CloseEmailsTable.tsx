'use client';

import { useMemo, useState, useEffect } from 'react';
import { CloseEmailThread } from '@/types/close';
import { useCloseLeadsBatch } from '@/hooks/useCloseCRM';
import {
  Mail,
  ArrowDownToLine,
  ArrowUpFromLine,
  User,
  Building2,
  Calendar,
  ExternalLink,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  Paperclip,
} from 'lucide-react';

interface CloseEmailsTableProps {
  emails: CloseEmailThread[];
  onEmailClick?: (emailThreadId: string) => void;
  isLoading?: boolean;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  onFilterCountChange?: (count: number) => void;
}

type SortField =
  | 'date'
  | 'subject'
  | 'direction'
  | 'lead'
  | 'user'
  | 'count'
  | 'status';
type SortDirection = 'asc' | 'desc' | null;

// Utility functions
function getRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

// Type for enriched email with lead data
interface EnrichedEmailThread extends CloseEmailThread {
  lead_name?: string;
  contact_name?: string;
}

export function CloseEmailsTable({
  emails,
  onEmailClick,
  isLoading,
  isSidebarOpen,
  setIsSidebarOpen,
  onFilterCountChange,
}: CloseEmailsTableProps) {
  const [sortField, setSortField] = useState<SortField | null>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [directionFilter, setDirectionFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [userFilter, setUserFilter] = useState<string>('all');
  const [attachmentFilter, setAttachmentFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Extract unique lead IDs from emails
  const uniqueLeadIds = useMemo(
    () => [...new Set(emails.map((e) => e.lead_id).filter(Boolean) as string[])],
    [emails]
  );

  // Fetch lead data using React Query batch hook
  const leadQueries = useCloseLeadsBatch(uniqueLeadIds);

  // Build enriched emails from cached query results
  const enrichedEmails = useMemo(() => {
    const leadsMap = new Map();

    // Build map from query results
    leadQueries.forEach((query, index) => {
      if (query.data) {
        leadsMap.set(uniqueLeadIds[index], query.data);
      }
    });

    // Enrich emails with lead data
    return emails.map((email) => {
      const lead = email.lead_id ? leadsMap.get(email.lead_id) : null;

      // Try to find contact from participants
      const participantEmail = email.participants?.[0]?.email;
      const contact = lead?.contacts?.find((c: any) =>
        c.emails?.some((e: any) => e.email === participantEmail)
      );

      return {
        ...email,
        lead_name: lead?.display_name || lead?.name,
        contact_name: contact?.name || email.participants?.[0]?.name,
      } as EnrichedEmailThread;
    });
  }, [emails, leadQueries, uniqueLeadIds]);

  // Check if any lead queries are still loading
  const loadingLeads = leadQueries.some((query) => query.isLoading);

  // Extract unique values for filters
  const { uniqueStatuses, uniqueUsers } = useMemo(() => {
    const statuses = new Set<string>();
    const users = new Set<string>();

    enrichedEmails.forEach((email) => {
      const latestEmail = email.latest_emails?.[0];
      if (latestEmail?.status) statuses.add(latestEmail.status);
      if (email.user_name) users.add(email.user_name);
    });

    return {
      uniqueStatuses: Array.from(statuses).sort(),
      uniqueUsers: Array.from(users).sort(),
    };
  }, [enrichedEmails]);

  // Filter and sort emails
  const filteredAndSortedEmails = useMemo(() => {
    let filtered = enrichedEmails;

    // Apply search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter((email) => {
        const subject = (email.latest_normalized_subject || email.subject || '').toLowerCase();
        const preview = (email.latest_emails?.[0]?.body_preview || '').toLowerCase();
        const leadName = (email.lead_name || '').toLowerCase();
        const contactName = (email.contact_name || '').toLowerCase();
        const participants = (email.participants?.map(p => p.email).join(' ') || '').toLowerCase();
        return (
          subject.includes(search) ||
          preview.includes(search) ||
          leadName.includes(search) ||
          contactName.includes(search) ||
          participants.includes(search)
        );
      });
    }

    // Apply direction filter
    if (directionFilter !== 'all') {
      filtered = filtered.filter((email) =>
        email.latest_emails?.[0]?.direction === directionFilter
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((email) =>
        email.latest_emails?.[0]?.status === statusFilter
      );
    }

    // Apply user filter
    if (userFilter !== 'all') {
      filtered = filtered.filter((email) => email.user_name === userFilter);
    }

    // Apply attachment filter
    if (attachmentFilter !== 'all') {
      filtered = filtered.filter((email) => {
        const hasAttachments = email.latest_emails?.[0]?.has_attachments;
        if (attachmentFilter === 'yes') return hasAttachments;
        if (attachmentFilter === 'no') return !hasAttachments;
        return true;
      });
    }

    // Apply date range filter
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      filtered = filtered.filter((email) => {
        const emailDate = new Date(email.activity_at || email.date_created);
        return emailDate >= fromDate;
      });
    }
    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999); // Include entire day
      filtered = filtered.filter((email) => {
        const emailDate = new Date(email.activity_at || email.date_created);
        return emailDate <= toDate;
      });
    }

    // Apply sorting
    if (sortField && sortDirection) {
      filtered = [...filtered].sort((a, b) => {
        let aVal: any;
        let bVal: any;

        switch (sortField) {
          case 'date':
            aVal = new Date(a.activity_at || a.date_created).getTime();
            bVal = new Date(b.activity_at || b.date_created).getTime();
            break;
          case 'subject':
            aVal = (a.latest_normalized_subject || a.subject || '').toLowerCase();
            bVal = (b.latest_normalized_subject || b.subject || '').toLowerCase();
            break;
          case 'direction':
            aVal = a.latest_emails?.[0]?.direction || '';
            bVal = b.latest_emails?.[0]?.direction || '';
            break;
          case 'lead':
            aVal = (a.lead_name || a.contact_name || '').toLowerCase();
            bVal = (b.lead_name || b.contact_name || '').toLowerCase();
            break;
          case 'user':
            aVal = a.user_name || '';
            bVal = b.user_name || '';
            break;
          case 'count':
            aVal = a.n_emails || 0;
            bVal = b.n_emails || 0;
            break;
          case 'status':
            aVal = a.latest_emails?.[0]?.status || '';
            bVal = b.latest_emails?.[0]?.status || '';
            break;
          default:
            return 0;
        }

        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [
    enrichedEmails,
    searchTerm,
    directionFilter,
    statusFilter,
    userFilter,
    attachmentFilter,
    dateFrom,
    dateTo,
    sortField,
    sortDirection,
  ]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Cycle through: asc -> desc -> null
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortDirection(null);
        setSortField(null);
      }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-4 h-4 text-gray-400" />;
    }
    if (sortDirection === 'asc') {
      return <ArrowUp className="w-4 h-4 text-blue-600" />;
    }
    return <ArrowDown className="w-4 h-4 text-blue-600" />;
  };

  const clearFilters = () => {
    setSearchTerm('');
    setDirectionFilter('all');
    setStatusFilter('all');
    setUserFilter('all');
    setAttachmentFilter('all');
    setDateFrom('');
    setDateTo('');
  };

  const hasActiveFilters =
    searchTerm ||
    directionFilter !== 'all' ||
    statusFilter !== 'all' ||
    userFilter !== 'all' ||
    attachmentFilter !== 'all' ||
    dateFrom ||
    dateTo;

  // Count active filters for badge
  const activeFilterCount = [
    searchTerm,
    directionFilter !== 'all',
    statusFilter !== 'all',
    userFilter !== 'all',
    attachmentFilter !== 'all',
    dateFrom,
    dateTo,
  ].filter(Boolean).length;

  // Notify parent of filter count changes
  useEffect(() => {
    onFilterCountChange?.(activeFilterCount);
  }, [activeFilterCount, onFilterCountChange]);

  // Handle ESC key to close sidebar
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isSidebarOpen) {
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isSidebarOpen, setIsSidebarOpen]);

  const setDateRange = (range: string) => {
    const now = new Date();
    switch (range) {
      case 'today':
        setDateFrom(now.toISOString().split('T')[0]);
        setDateTo(now.toISOString().split('T')[0]);
        break;
      case '7days':
        const last7Days = new Date(now);
        last7Days.setDate(now.getDate() - 7);
        setDateFrom(last7Days.toISOString().split('T')[0]);
        setDateTo(now.toISOString().split('T')[0]);
        break;
      case '30days':
        const last30Days = new Date(now);
        last30Days.setDate(now.getDate() - 30);
        setDateFrom(last30Days.toISOString().split('T')[0]);
        setDateTo(now.toISOString().split('T')[0]);
        break;
      case 'thisMonth':
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        setDateFrom(firstDay.toISOString().split('T')[0]);
        setDateTo(now.toISOString().split('T')[0]);
        break;
    }
  };

  // Skeleton row component
  const SkeletonRow = () => (
    <tr className="border-b border-gray-100">
      <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded animate-pulse w-24"></div></td>
      <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded animate-pulse w-48"></div></td>
      <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded animate-pulse w-20"></div></td>
      <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded animate-pulse w-32"></div></td>
      <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded animate-pulse w-28"></div></td>
      <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded animate-pulse w-24"></div></td>
      <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded animate-pulse w-12"></div></td>
      <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded animate-pulse w-20"></div></td>
      <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded animate-pulse w-16"></div></td>
    </tr>
  );

  return (
    <div className="space-y-4">
      {/* Results Count */}
      <div className="text-sm text-gray-600">
        Showing {filteredAndSortedEmails.length} of {enrichedEmails.length} email threads
      </div>

      {/* Backdrop Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Filters Sidebar */}
      <div
        className={`fixed top-0 right-0 h-full w-96 bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${
          isSidebarOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Sidebar Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Sidebar Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Search */}
            <div>
              <label htmlFor="search" className="block text-xs font-medium text-gray-700 mb-1">
                Search
              </label>
              <input
                id="search"
                type="text"
                placeholder="Subject, participants, preview..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Direction Filter */}
            <div>
              <label htmlFor="direction" className="block text-xs font-medium text-gray-700 mb-1">
                Direction
              </label>
              <select
                id="direction"
                value={directionFilter}
                onChange={(e) => setDirectionFilter(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Directions</option>
                <option value="incoming">Incoming</option>
                <option value="outgoing">Outgoing</option>
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label htmlFor="status" className="block text-xs font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                id="status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Statuses</option>
                {uniqueStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>

            {/* User Filter */}
            <div>
              <label htmlFor="user" className="block text-xs font-medium text-gray-700 mb-1">
                User
              </label>
              <select
                id="user"
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Users</option>
                {uniqueUsers.map((user) => (
                  <option key={user} value={user}>
                    {user}
                  </option>
                ))}
              </select>
            </div>

            {/* Attachment Filter */}
            <div>
              <label htmlFor="attachment" className="block text-xs font-medium text-gray-700 mb-1">
                Attachments
              </label>
              <select
                id="attachment"
                value={attachmentFilter}
                onChange={(e) => setAttachmentFilter(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All</option>
                <option value="yes">Has Attachments</option>
                <option value="no">No Attachments</option>
              </select>
            </div>

            {/* Date From */}
            <div>
              <label htmlFor="dateFrom" className="block text-xs font-medium text-gray-700 mb-1">
                Date From
              </label>
              <input
                id="dateFrom"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Date To */}
            <div>
              <label htmlFor="dateTo" className="block text-xs font-medium text-gray-700 mb-1">
                Date To
              </label>
              <input
                id="dateTo"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Date Range Presets */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Quick Range</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setDateRange('today')}
                  className="flex-1 px-3 py-2 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                >
                  Today
                </button>
                <button
                  onClick={() => setDateRange('7days')}
                  className="flex-1 px-3 py-2 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                >
                  7 days
                </button>
                <button
                  onClick={() => setDateRange('30days')}
                  className="flex-1 px-3 py-2 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                >
                  30 days
                </button>
              </div>
            </div>
          </div>

          {/* Sidebar Footer */}
          {hasActiveFilters && (
            <div className="p-4 border-t border-gray-200">
              <button
                onClick={clearFilters}
                className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 uppercase tracking-wider border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 font-semibold">
                <button
                  onClick={() => handleSort('date')}
                  className="flex items-center gap-1.5 hover:text-gray-700 transition-colors"
                >
                  <Calendar className="w-4 h-4" />
                  Date/Time
                  {getSortIcon('date')}
                </button>
              </th>
              <th className="px-4 py-3 font-semibold">
                <button
                  onClick={() => handleSort('subject')}
                  className="flex items-center gap-1.5 hover:text-gray-700 transition-colors"
                >
                  <Mail className="w-4 h-4" />
                  Subject
                  {getSortIcon('subject')}
                </button>
              </th>
              <th className="px-4 py-3 font-semibold">
                <button
                  onClick={() => handleSort('direction')}
                  className="flex items-center gap-1.5 hover:text-gray-700 transition-colors"
                >
                  Direction
                  {getSortIcon('direction')}
                </button>
              </th>
              <th className="px-4 py-3 font-semibold">From/To</th>
              <th className="px-4 py-3 font-semibold">
                <button
                  onClick={() => handleSort('lead')}
                  className="flex items-center gap-1.5 hover:text-gray-700 transition-colors"
                >
                  <Building2 className="w-4 h-4" />
                  Contact/Lead
                  {getSortIcon('lead')}
                </button>
              </th>
              <th className="px-4 py-3 font-semibold">
                <button
                  onClick={() => handleSort('user')}
                  className="flex items-center gap-1.5 hover:text-gray-700 transition-colors"
                >
                  <User className="w-4 h-4" />
                  User
                  {getSortIcon('user')}
                </button>
              </th>
              <th className="px-4 py-3 font-semibold">
                <button
                  onClick={() => handleSort('count')}
                  className="flex items-center gap-1.5 hover:text-gray-700 transition-colors"
                >
                  Emails
                  {getSortIcon('count')}
                </button>
              </th>
              <th className="px-4 py-3 font-semibold">
                <button
                  onClick={() => handleSort('status')}
                  className="flex items-center gap-1.5 hover:text-gray-700 transition-colors"
                >
                  Status
                  {getSortIcon('status')}
                </button>
              </th>
              <th className="px-4 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading || loadingLeads ? (
              // Show 15 skeleton rows while loading
              Array.from({ length: 15 }).map((_, index) => <SkeletonRow key={index} />)
            ) : filteredAndSortedEmails.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                  No email threads found matching your filters
                </td>
              </tr>
            ) : (
              filteredAndSortedEmails.map((email) => {
                const latestEmail = email.latest_emails?.[0];
                const direction = latestEmail?.direction;
                const subject = email.latest_normalized_subject || email.subject || '(No Subject)';
                const preview = latestEmail?.body_preview;
                const hasAttachments = latestEmail?.has_attachments;
                const status = latestEmail?.status;
                const emailDate = email.activity_at || email.date_created;

                // Get from/to info
                let fromTo = '';
                if (direction === 'outgoing') {
                  fromTo = latestEmail?.to?.join(', ') || email.participants?.map(p => p.email).join(', ') || '-';
                } else {
                  fromTo = latestEmail?.sender || email.participants?.[0]?.email || '-';
                }

                return (
                  <tr
                    key={email.id}
                    onClick={() => onEmailClick?.(email.id)}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    {/* Date/Time */}
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs text-gray-900">
                          {new Date(emailDate).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </span>
                        <span className="text-[10px] text-gray-500">
                          {getRelativeTime(emailDate)}
                        </span>
                      </div>
                    </td>

                    {/* Subject */}
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1 min-w-[200px]">
                        <span className="font-medium text-gray-900 line-clamp-1">
                          {subject}
                        </span>
                        {preview && (
                          <span className="text-xs text-gray-600 line-clamp-1">
                            {preview}
                          </span>
                        )}
                        {hasAttachments && (
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <Paperclip className="w-3 h-3" />
                            <span>Has attachments</span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Direction */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {direction === 'incoming' ? (
                          <>
                            <ArrowDownToLine className="w-4 h-4 text-blue-600" />
                            <span className="text-xs capitalize">Incoming</span>
                          </>
                        ) : direction === 'outgoing' ? (
                          <>
                            <ArrowUpFromLine className="w-4 h-4 text-green-600" />
                            <span className="text-xs capitalize">Outgoing</span>
                          </>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </div>
                    </td>

                    {/* From/To */}
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-700 line-clamp-2">
                        {fromTo.length > 40 ? fromTo.substring(0, 40) + '...' : fromTo}
                      </span>
                    </td>

                    {/* Contact/Lead */}
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5 min-w-[150px]">
                        {email.contact_name && (
                          <span className="text-xs font-medium text-gray-900">
                            {email.contact_name}
                          </span>
                        )}
                        {email.lead_name ? (
                          <span className="text-xs text-gray-600">{email.lead_name}</span>
                        ) : (
                          <span className="text-xs text-gray-400 italic">Unknown</span>
                        )}
                      </div>
                    </td>

                    {/* User */}
                    <td className="px-4 py-3">
                      {email.user_name ? (
                        <span className="text-xs text-gray-700">{email.user_name}</span>
                      ) : (
                        <span className="text-xs text-gray-400 italic">System</span>
                      )}
                    </td>

                    {/* Email Count */}
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium text-gray-900">
                        {email.n_emails || 1}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      {status ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 whitespace-nowrap capitalize">
                          {status}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-right">
                      <a
                        href={`https://app.close.com/activity/email/${email.id}/`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        Open in Close
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
