'use client';

import { useMemo, useState, useEffect } from 'react';
import { CloseCallActivity } from '@/types/close';
import {
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  Play,
  Clock,
  User,
  Building2,
  Calendar,
  FileText,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Voicemail,
  DollarSign,
} from 'lucide-react';

interface CloseCallsTableProps {
  calls: CloseCallActivity[];
  onCallClick?: (callId: string) => void;
  isLoading?: boolean;
}

type SortField =
  | 'date'
  | 'direction'
  | 'lead'
  | 'phone'
  | 'duration'
  | 'disposition'
  | 'user'
  | 'cost';
type SortDirection = 'asc' | 'desc' | null;

// Utility functions
function formatDuration(seconds: number | undefined | null): string {
  if (!seconds || seconds === 0) return '-';
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

function getDurationColor(seconds: number | undefined | null): string {
  if (!seconds || seconds === 0) return '';
  if (seconds < 30) return 'text-yellow-600';
  if (seconds > 300) return 'text-green-600 font-semibold';
  return '';
}

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

// Type for enriched call with lead data
interface EnrichedCall extends CloseCallActivity {
  lead_name?: string;
  contact_name?: string;
}

export function CloseCallsTable({ calls, onCallClick, isLoading }: CloseCallsTableProps) {
  const [sortField, setSortField] = useState<SortField | null>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [directionFilter, setDirectionFilter] = useState<string>('all');
  const [dispositionFilter, setDispositionFilter] = useState<string>('all');
  const [userFilter, setUserFilter] = useState<string>('all');
  const [recordingFilter, setRecordingFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [enrichedCalls, setEnrichedCalls] = useState<EnrichedCall[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);

  // Fetch lead data for calls
  useEffect(() => {
    async function fetchLeadData() {
      if (calls.length === 0) return;

      setLoadingLeads(true);
      try {
        // Extract unique lead IDs
        const leadIds = [...new Set(calls.map((c) => c.lead_id).filter(Boolean))];

        if (leadIds.length === 0) {
          setEnrichedCalls(calls);
          return;
        }

        // Fetch leads data
        const leadsPromises = leadIds.map(async (leadId) => {
          try {
            const response = await fetch(`/api/close/leads/${leadId}`);
            if (!response.ok) return null;
            const data = await response.json();
            return data.success ? data.data : null;
          } catch {
            return null;
          }
        });

        const leadsData = await Promise.all(leadsPromises);
        const leadsMap = new Map(
          leadsData.filter(Boolean).map((lead) => [lead.id, lead])
        );

        // Enrich calls with lead data
        const enriched = calls.map((call) => {
          const lead = call.lead_id ? leadsMap.get(call.lead_id) : null;
          const contact = lead?.contacts?.find((c: any) =>
            c.phones?.some((p: any) => p.phone === call.phone || p.phone === call.remote_phone)
          );

          return {
            ...call,
            lead_name: lead?.display_name || lead?.name,
            contact_name: contact?.name,
          };
        });

        setEnrichedCalls(enriched);
      } catch (error) {
        console.error('Error fetching lead data:', error);
        setEnrichedCalls(calls);
      } finally {
        setLoadingLeads(false);
      }
    }

    fetchLeadData();
  }, [calls]);

  // Extract unique values for filters
  const { uniqueDispositions, uniqueUsers } = useMemo(() => {
    const dispositions = new Set<string>();
    const users = new Set<string>();

    enrichedCalls.forEach((call) => {
      if (call.disposition) dispositions.add(call.disposition);
      if (call.user_name) users.add(call.user_name);
    });

    return {
      uniqueDispositions: Array.from(dispositions).sort(),
      uniqueUsers: Array.from(users).sort(),
    };
  }, [enrichedCalls]);

  // Filter and sort calls
  const filteredAndSortedCalls = useMemo(() => {
    let filtered = enrichedCalls;

    // Apply search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter((call) => {
        const phone = (call.phone || call.remote_phone || '').toLowerCase();
        const note = (call.note || '').toLowerCase();
        const leadName = (call.lead_name || '').toLowerCase();
        const contactName = (call.contact_name || '').toLowerCase();
        return (
          phone.includes(search) ||
          note.includes(search) ||
          leadName.includes(search) ||
          contactName.includes(search)
        );
      });
    }

    // Apply direction filter
    if (directionFilter !== 'all') {
      filtered = filtered.filter((call) => call.direction === directionFilter);
    }

    // Apply disposition filter
    if (dispositionFilter !== 'all') {
      filtered = filtered.filter((call) => call.disposition === dispositionFilter);
    }

    // Apply user filter
    if (userFilter !== 'all') {
      filtered = filtered.filter((call) => call.user_name === userFilter);
    }

    // Apply recording filter
    if (recordingFilter !== 'all') {
      filtered = filtered.filter((call) => {
        if (recordingFilter === 'recording') return call.recording_url;
        if (recordingFilter === 'voicemail') return call.voicemail_url;
        if (recordingFilter === 'none') return !call.recording_url && !call.voicemail_url;
        return true;
      });
    }

    // Apply date range filter
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      filtered = filtered.filter((call) => new Date(call.date_created) >= fromDate);
    }
    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999); // Include entire day
      filtered = filtered.filter((call) => new Date(call.date_created) <= toDate);
    }

    // Apply sorting
    if (sortField && sortDirection) {
      filtered = [...filtered].sort((a, b) => {
        let aVal: any;
        let bVal: any;

        switch (sortField) {
          case 'date':
            aVal = new Date(a.date_created).getTime();
            bVal = new Date(b.date_created).getTime();
            break;
          case 'direction':
            aVal = a.direction || '';
            bVal = b.direction || '';
            break;
          case 'lead':
            aVal = (a.lead_name || a.contact_name || '').toLowerCase();
            bVal = (b.lead_name || b.contact_name || '').toLowerCase();
            break;
          case 'phone':
            aVal = a.phone || a.remote_phone || '';
            bVal = b.phone || b.remote_phone || '';
            break;
          case 'duration':
            aVal = a.duration || 0;
            bVal = b.duration || 0;
            break;
          case 'disposition':
            aVal = a.disposition || '';
            bVal = b.disposition || '';
            break;
          case 'user':
            aVal = a.user_name || '';
            bVal = b.user_name || '';
            break;
          case 'cost':
            aVal = a.cost ? parseInt(a.cost) : 0;
            bVal = b.cost ? parseInt(b.cost) : 0;
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
    enrichedCalls,
    searchTerm,
    directionFilter,
    dispositionFilter,
    userFilter,
    recordingFilter,
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
    setDispositionFilter('all');
    setUserFilter('all');
    setRecordingFilter('all');
    setDateFrom('');
    setDateTo('');
  };

  const hasActiveFilters =
    searchTerm ||
    directionFilter !== 'all' ||
    dispositionFilter !== 'all' ||
    userFilter !== 'all' ||
    recordingFilter !== 'all' ||
    dateFrom ||
    dateTo;

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

  if (isLoading || loadingLeads) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {/* Search */}
          <div>
            <label htmlFor="search" className="block text-xs font-medium text-gray-700 mb-1">
              Search
            </label>
            <input
              id="search"
              type="text"
              placeholder="Phone, notes, contact..."
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
              <option value="inbound">Inbound</option>
              <option value="outbound">Outbound</option>
            </select>
          </div>

          {/* Disposition Filter */}
          <div>
            <label htmlFor="disposition" className="block text-xs font-medium text-gray-700 mb-1">
              Disposition
            </label>
            <select
              id="disposition"
              value={dispositionFilter}
              onChange={(e) => setDispositionFilter(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Dispositions</option>
              {uniqueDispositions.map((disp) => (
                <option key={disp} value={disp}>
                  {disp.replace('-', ' ')}
                </option>
              ))}
            </select>
          </div>

          {/* User Filter */}
          <div>
            <label htmlFor="user" className="block text-xs font-medium text-gray-700 mb-1">
              User/Agent
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

          {/* Recording Filter */}
          <div>
            <label htmlFor="recording" className="block text-xs font-medium text-gray-700 mb-1">
              Recording
            </label>
            <select
              id="recording"
              value={recordingFilter}
              onChange={(e) => setRecordingFilter(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All</option>
              <option value="recording">Has Recording</option>
              <option value="voicemail">Has Voicemail</option>
              <option value="none">No Recording</option>
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
            <div className="flex gap-1">
              <button
                onClick={() => setDateRange('today')}
                className="px-2 py-1.5 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
              >
                Today
              </button>
              <button
                onClick={() => setDateRange('7days')}
                className="px-2 py-1.5 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
              >
                7d
              </button>
              <button
                onClick={() => setDateRange('30days')}
                className="px-2 py-1.5 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
              >
                30d
              </button>
            </div>
          </div>
        </div>

        {/* Clear Filters and Results */}
        <div className="mt-3 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Showing {filteredAndSortedCalls.length} of {enrichedCalls.length} calls
          </div>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              Clear all filters
            </button>
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
                  onClick={() => handleSort('direction')}
                  className="flex items-center gap-1.5 hover:text-gray-700 transition-colors"
                >
                  <Phone className="w-4 h-4" />
                  Direction
                  {getSortIcon('direction')}
                </button>
              </th>
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
                  onClick={() => handleSort('phone')}
                  className="flex items-center gap-1.5 hover:text-gray-700 transition-colors"
                >
                  Phone
                  {getSortIcon('phone')}
                </button>
              </th>
              <th className="px-4 py-3 font-semibold">
                <button
                  onClick={() => handleSort('duration')}
                  className="flex items-center gap-1.5 hover:text-gray-700 transition-colors"
                >
                  <Clock className="w-4 h-4" />
                  Duration
                  {getSortIcon('duration')}
                </button>
              </th>
              <th className="px-4 py-3 font-semibold">
                <button
                  onClick={() => handleSort('disposition')}
                  className="flex items-center gap-1.5 hover:text-gray-700 transition-colors"
                >
                  Disposition
                  {getSortIcon('disposition')}
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
              <th className="px-4 py-3 font-semibold text-center">Recording</th>
              <th className="px-4 py-3 font-semibold">
                <FileText className="w-4 h-4" />
              </th>
              <th className="px-4 py-3 font-semibold text-right">
                <button
                  onClick={() => handleSort('cost')}
                  className="flex items-center gap-1.5 hover:text-gray-700 transition-colors ml-auto"
                >
                  <DollarSign className="w-4 h-4" />
                  Cost
                  {getSortIcon('cost')}
                </button>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredAndSortedCalls.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                  No calls found matching your filters
                </td>
              </tr>
            ) : (
              filteredAndSortedCalls.map((call) => {
                const phone = call.phone || call.remote_phone_formatted || call.remote_phone;
                const hasNote = call.note && call.note.trim().length > 0;

                return (
                  <tr
                    key={call.id}
                    onClick={() => onCallClick?.(call.id)}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    {/* Date/Time */}
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs text-gray-900">
                          {new Date(call.date_created).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </span>
                        <span className="text-[10px] text-gray-500">
                          {getRelativeTime(call.date_created)}
                        </span>
                      </div>
                    </td>

                    {/* Direction */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {call.direction === 'inbound' ? (
                          <PhoneIncoming className="w-4 h-4 text-blue-600" />
                        ) : (
                          <PhoneOutgoing className="w-4 h-4 text-green-600" />
                        )}
                        <span className="text-xs capitalize">{call.direction}</span>
                      </div>
                    </td>

                    {/* Contact/Lead */}
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5 min-w-[150px]">
                        {call.contact_name && (
                          <span className="text-xs font-medium text-gray-900">
                            {call.contact_name}
                          </span>
                        )}
                        {call.lead_name ? (
                          <span className="text-xs text-gray-600">{call.lead_name}</span>
                        ) : (
                          <span className="text-xs text-gray-400 italic">Unknown</span>
                        )}
                      </div>
                    </td>

                    {/* Phone */}
                    <td className="px-4 py-3">
                      {phone ? (
                        <a
                          href={`tel:${phone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {phone}
                        </a>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>

                    {/* Duration */}
                    <td className="px-4 py-3 text-right">
                      <span className={`text-xs font-mono ${getDurationColor(call.duration)}`}>
                        {formatDuration(call.duration)}
                      </span>
                    </td>

                    {/* Disposition */}
                    <td className="px-4 py-3">
                      {call.disposition ? (
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${getDispositionColor(
                            call.disposition
                          )}`}
                        >
                          {call.disposition.replace('-', ' ')}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>

                    {/* User */}
                    <td className="px-4 py-3">
                      {call.user_name ? (
                        <span className="text-xs text-gray-700">{call.user_name}</span>
                      ) : (
                        <span className="text-xs text-gray-400 italic">System</span>
                      )}
                    </td>

                    {/* Recording */}
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {call.recording_url && (
                          <a
                            href={call.recording_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-blue-600 hover:text-blue-800"
                            title="Play recording"
                          >
                            <Play className="w-4 h-4" />
                          </a>
                        )}
                        {call.voicemail_url && (
                          <a
                            href={call.voicemail_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-purple-600 hover:text-purple-800"
                            title="Play voicemail"
                          >
                            <Voicemail className="w-4 h-4" />
                          </a>
                        )}
                        {!call.recording_url && !call.voicemail_url && (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </div>
                    </td>

                    {/* Notes Indicator */}
                    <td className="px-4 py-3 text-center">
                      {hasNote ? (
                        <div className="relative group">
                          <FileText className="w-4 h-4 text-gray-600 mx-auto" />
                          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                            {call.note}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>

                    {/* Cost */}
                    <td className="px-4 py-3 text-right">
                      {call.cost ? (
                        <span className="text-xs text-gray-700">${(parseInt(call.cost) / 100).toFixed(2)}</span>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
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
