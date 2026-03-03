'use client';

import { useMemo, useState } from 'react';
import { CloseLead } from '@/types/close';
import {
  Building2,
  Mail,
  Phone,
  MapPin,
  ExternalLink,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  User,
  DollarSign,
  Calendar,
} from 'lucide-react';

interface CloseLeadsTableProps {
  leads: CloseLead[];
  statusMap: Map<string, string>;
  onLeadClick?: (leadId: string) => void;
  isLoading?: boolean;
}

type SortField =
  | 'name'
  | 'status'
  | 'city'
  | 'sport'
  | 'zoning'
  | 'opportunities'
  | 'created'
  | 'updated';
type SortDirection = 'asc' | 'desc' | null;

export function CloseLeadsTable({
  leads,
  statusMap,
  onLeadClick,
  isLoading,
}: CloseLeadsTableProps) {
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sportFilter, setSportFilter] = useState<string>('all');
  const [zoningFilter, setZoningFilter] = useState<string>('all');

  // Extract unique values for filters
  const { uniqueStatuses, uniqueSports, uniqueZonings } = useMemo(() => {
    const statuses = new Set<string>();
    const sports = new Set<string>();
    const zonings = new Set<string>();

    leads.forEach((lead) => {
      const status = statusMap.get(lead.status_id) || lead.status_label;
      if (status) statuses.add(status);

      const sport = lead.custom?.['Sport'];
      if (sport) sports.add(sport);

      const zoning = lead.custom?.['Zoning'];
      if (zoning) zonings.add(zoning);
    });

    return {
      uniqueStatuses: Array.from(statuses).sort(),
      uniqueSports: Array.from(sports).sort(),
      uniqueZonings: Array.from(zonings).sort(),
    };
  }, [leads, statusMap]);

  // Filter and sort leads
  const filteredAndSortedLeads = useMemo(() => {
    let filtered = leads;

    // Apply search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter((lead) => {
        const name = (lead.display_name || lead.name || '').toLowerCase();
        const city = lead.addresses?.[0]?.city?.toLowerCase() || '';
        const email = lead.contacts?.[0]?.emails?.[0]?.email?.toLowerCase() || '';
        return name.includes(search) || city.includes(search) || email.includes(search);
      });
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((lead) => {
        const status = statusMap.get(lead.status_id) || lead.status_label;
        return status === statusFilter;
      });
    }

    // Apply sport filter
    if (sportFilter !== 'all') {
      filtered = filtered.filter((lead) => lead.custom?.['Sport'] === sportFilter);
    }

    // Apply zoning filter
    if (zoningFilter !== 'all') {
      filtered = filtered.filter((lead) => lead.custom?.['Zoning'] === zoningFilter);
    }

    // Apply sorting
    if (sortField && sortDirection) {
      filtered = [...filtered].sort((a, b) => {
        let aVal: any;
        let bVal: any;

        switch (sortField) {
          case 'name':
            aVal = (a.display_name || a.name || '').toLowerCase();
            bVal = (b.display_name || b.name || '').toLowerCase();
            break;
          case 'status':
            aVal = statusMap.get(a.status_id) || a.status_label || '';
            bVal = statusMap.get(b.status_id) || b.status_label || '';
            break;
          case 'city':
            aVal = a.addresses?.[0]?.city || '';
            bVal = b.addresses?.[0]?.city || '';
            break;
          case 'sport':
            aVal = a.custom?.['Sport'] || '';
            bVal = b.custom?.['Sport'] || '';
            break;
          case 'zoning':
            aVal = a.custom?.['Zoning'] || '';
            bVal = b.custom?.['Zoning'] || '';
            break;
          case 'opportunities':
            aVal = a.opportunities?.length || 0;
            bVal = b.opportunities?.length || 0;
            break;
          case 'created':
            aVal = new Date(a.date_created).getTime();
            bVal = new Date(b.date_created).getTime();
            break;
          case 'updated':
            aVal = new Date(a.date_updated).getTime();
            bVal = new Date(b.date_updated).getTime();
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
  }, [leads, searchTerm, statusFilter, sportFilter, zoningFilter, sortField, sortDirection, statusMap]);

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
    setStatusFilter('all');
    setSportFilter('all');
    setZoningFilter('all');
  };

  const hasActiveFilters = searchTerm || statusFilter !== 'all' || sportFilter !== 'all' || zoningFilter !== 'all';

  if (isLoading) {
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div>
            <label htmlFor="search" className="block text-xs font-medium text-gray-700 mb-1">
              Search
            </label>
            <input
              id="search"
              type="text"
              placeholder="Name, city, email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
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

          {/* Sport Filter */}
          <div>
            <label htmlFor="sport" className="block text-xs font-medium text-gray-700 mb-1">
              Sport
            </label>
            <select
              id="sport"
              value={sportFilter}
              onChange={(e) => setSportFilter(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Sports</option>
              {uniqueSports.map((sport) => (
                <option key={sport} value={sport}>
                  {sport}
                </option>
              ))}
            </select>
          </div>

          {/* Zoning Filter */}
          <div>
            <label htmlFor="zoning" className="block text-xs font-medium text-gray-700 mb-1">
              Zoning
            </label>
            <select
              id="zoning"
              value={zoningFilter}
              onChange={(e) => setZoningFilter(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Zoning</option>
              {uniqueZonings.map((zoning) => (
                <option key={zoning} value={zoning}>
                  {zoning}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <div className="mt-3">
            <button
              onClick={clearFilters}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              Clear all filters
            </button>
          </div>
        )}

        {/* Results count */}
        <div className="mt-3 text-sm text-gray-600">
          Showing {filteredAndSortedLeads.length} of {leads.length} leads
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 uppercase tracking-wider border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 font-semibold">
                <button
                  onClick={() => handleSort('name')}
                  className="flex items-center gap-1.5 hover:text-gray-700 transition-colors"
                >
                  <Building2 className="w-4 h-4" />
                  Lead Name
                  {getSortIcon('name')}
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
              <th className="px-4 py-3 font-semibold">Contacts</th>
              <th className="px-4 py-3 font-semibold">
                <button
                  onClick={() => handleSort('city')}
                  className="flex items-center gap-1.5 hover:text-gray-700 transition-colors"
                >
                  <MapPin className="w-4 h-4" />
                  Location
                  {getSortIcon('city')}
                </button>
              </th>
              <th className="px-4 py-3 font-semibold">
                <button
                  onClick={() => handleSort('sport')}
                  className="flex items-center gap-1.5 hover:text-gray-700 transition-colors"
                >
                  Sport
                  {getSortIcon('sport')}
                </button>
              </th>
              <th className="px-4 py-3 font-semibold">
                <button
                  onClick={() => handleSort('zoning')}
                  className="flex items-center gap-1.5 hover:text-gray-700 transition-colors"
                >
                  Zoning
                  {getSortIcon('zoning')}
                </button>
              </th>
              <th className="px-4 py-3 font-semibold">
                <button
                  onClick={() => handleSort('opportunities')}
                  className="flex items-center gap-1.5 hover:text-gray-700 transition-colors"
                >
                  <DollarSign className="w-4 h-4" />
                  Opps
                  {getSortIcon('opportunities')}
                </button>
              </th>
              <th className="px-4 py-3 font-semibold">
                <button
                  onClick={() => handleSort('created')}
                  className="flex items-center gap-1.5 hover:text-gray-700 transition-colors"
                >
                  <Calendar className="w-4 h-4" />
                  Dates
                  {getSortIcon('created')}
                </button>
              </th>
              <th className="px-4 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredAndSortedLeads.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                  No leads found matching your filters
                </td>
              </tr>
            ) : (
              filteredAndSortedLeads.map((lead) => {
                const statusLabel = statusMap.get(lead.status_id) || lead.status_label || 'Unknown';
                const primaryContact = lead.contacts?.[0];
                const primaryEmail = primaryContact?.emails?.[0]?.email;
                const primaryPhone = primaryContact?.phones?.[0]?.phone;
                const address = lead.addresses?.[0];
                const location = address?.city && address?.state
                  ? `${address.city}, ${address.state}`
                  : address?.city || address?.state || null;
                const sport = lead.custom?.['Sport'];
                const zoning = lead.custom?.['Zoning'];
                const opportunities = lead.opportunities || [];
                const activeOpportunity = opportunities.find(opp => opp.status_type === 'active');

                return (
                  <tr
                    key={lead.id}
                    onClick={() => onLeadClick?.(lead.id)}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    {/* Lead Name */}
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <span className="font-medium text-gray-900">
                          {lead.display_name || lead.name}
                        </span>
                        {lead.url && (
                          <a
                            href={lead.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 w-fit"
                          >
                            Website
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 whitespace-nowrap">
                        {statusLabel}
                      </span>
                    </td>

                    {/* Contacts */}
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1 min-w-[180px]">
                        {primaryContact?.name && (
                          <div className="flex items-center gap-1.5 text-gray-700">
                            <User className="w-3 h-3 text-gray-400" />
                            <span className="text-xs font-medium">{primaryContact.name}</span>
                          </div>
                        )}
                        {primaryEmail && (
                          <a
                            href={`mailto:${primaryEmail}`}
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1.5 text-blue-600 hover:text-blue-800 hover:underline w-fit"
                          >
                            <Mail className="w-3 h-3" />
                            <span className="text-xs">{primaryEmail}</span>
                          </a>
                        )}
                        {primaryPhone && (
                          <a
                            href={`tel:${primaryPhone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1.5 text-blue-600 hover:text-blue-800 hover:underline w-fit"
                          >
                            <Phone className="w-3 h-3" />
                            <span className="text-xs">{primaryPhone}</span>
                          </a>
                        )}
                        {lead.contacts && lead.contacts.length > 1 && (
                          <span className="text-xs text-gray-500">
                            +{lead.contacts.length - 1} more
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Location */}
                    <td className="px-4 py-3">
                      {location ? (
                        <span className="text-gray-700 text-xs">{location}</span>
                      ) : (
                        <span className="text-gray-400 italic text-xs">No location</span>
                      )}
                    </td>

                    {/* Sport */}
                    <td className="px-4 py-3">
                      {sport ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 whitespace-nowrap">
                          {sport}
                        </span>
                      ) : (
                        <span className="text-gray-400 italic text-xs">-</span>
                      )}
                    </td>

                    {/* Zoning */}
                    <td className="px-4 py-3">
                      {zoning ? (
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                            zoning.toLowerCase().includes('can place')
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {zoning}
                        </span>
                      ) : (
                        <span className="text-gray-400 italic text-xs">-</span>
                      )}
                    </td>

                    {/* Opportunities */}
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        {opportunities.length > 0 ? (
                          <>
                            <span className="text-xs font-medium text-gray-900">
                              {opportunities.length} opp{opportunities.length !== 1 ? 's' : ''}
                            </span>
                            {activeOpportunity && (
                              <span className="text-xs text-gray-600">
                                {activeOpportunity.status_display_name || activeOpportunity.status_label}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-gray-400 italic text-xs">None</span>
                        )}
                      </div>
                    </td>

                    {/* Dates */}
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5 text-xs">
                        <span className="text-gray-700">
                          {new Date(lead.date_created).toLocaleDateString()}
                        </span>
                        <span className="text-gray-500 text-[10px]">
                          Updated: {new Date(lead.date_updated).toLocaleDateString()}
                        </span>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-right">
                      {lead.html_url && (
                        <a
                          href={lead.html_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          Open in Close
                          <ExternalLink className="w-3 h-3" />
                        </a>
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
