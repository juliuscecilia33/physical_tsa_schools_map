'use client';

import { useState, useMemo } from 'react';
import { useCloseLeads } from '@/hooks/useCloseCRM';
import { User, Mail, Phone, Building2, ChevronLeft, ChevronRight } from 'lucide-react';
import { CloseContact } from '@/types/close';

interface CloseContactsListProps {
  onContactClick?: (contactId: string) => void;
}

// Extended contact type with lead information
interface ContactWithLead extends CloseContact {
  lead_name?: string;
  lead_status?: string;
}

export function CloseContactsList({ onContactClick }: CloseContactsListProps) {
  // Pagination state - tracks which batch of leads we're viewing
  const [currentPage, setCurrentPage] = useState(1);
  const LEADS_PER_PAGE = 200; // Close API max limit
  const skip = (currentPage - 1) * LEADS_PER_PAGE;

  // Fetch current page of leads with server-side pagination
  const { data: leadsData, isLoading, error } = useCloseLeads({
    _limit: LEADS_PER_PAGE,
    _skip: skip,
  });

  // Extract and flatten contacts from current batch of leads
  const contacts = useMemo(() => {
    if (!leadsData?.leads) return [];

    const contactsList: ContactWithLead[] = [];

    leadsData.leads.forEach((lead) => {
      if (lead.contacts && lead.contacts.length > 0) {
        lead.contacts.forEach((contact) => {
          contactsList.push({
            ...contact,
            lead_name: lead.display_name || lead.name,
            lead_status: lead.status_label,
          });
        });
      }
    });

    return contactsList;
  }, [leadsData]);

  const hasMore = leadsData?.hasMore || false;
  const totalContactsOnPage = contacts.length;

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
        <p className="text-red-800 text-sm">Error loading contacts: {error.message}</p>
      </div>
    );
  }

  if (!contacts || contacts.length === 0) {
    return (
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <p className="text-gray-600 text-sm">No contacts found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <User className="w-5 h-5" />
          Contacts {totalContactsOnPage > 0 && `(${totalContactsOnPage} on page ${currentPage})`}
        </h3>
      </div>

      {/* Contacts Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 uppercase tracking-wider border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="px-4 py-3 font-semibold">Title</th>
              <th className="px-4 py-3 font-semibold">Company</th>
              <th className="px-4 py-3 font-semibold">Email</th>
              <th className="px-4 py-3 font-semibold">Phone</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {contacts.map((contact) => {
              const primaryEmail = contact.emails?.[0]?.email;
              const primaryPhone = contact.phones?.[0]?.phone;

              return (
                <tr
                  key={contact.id}
                  onClick={() => onContactClick?.(contact.id)}
                  className="hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-medium text-sm">
                        {contact.name
                          ? contact.name
                              .split(' ')
                              .map((n) => n[0])
                              .join('')
                              .slice(0, 2)
                              .toUpperCase()
                          : '?'}
                      </div>
                      <span className="font-medium text-gray-900">
                        {contact.name || 'Unnamed Contact'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {contact.title || (
                      <span className="text-gray-400 italic">No title</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {contact.lead_name ? (
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-700 font-medium">{contact.lead_name}</span>
                        </div>
                        {contact.lead_status && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 w-fit">
                            {contact.lead_status}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400 italic">No company</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {primaryEmail ? (
                      <a
                        href={`mailto:${primaryEmail}`}
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1.5 text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        <Mail className="w-4 h-4" />
                        <span>{primaryEmail}</span>
                      </a>
                    ) : (
                      <span className="text-gray-400 italic">No email</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {primaryPhone ? (
                      <a
                        href={`tel:${primaryPhone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1.5 text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        <Phone className="w-4 h-4" />
                        <span>{primaryPhone}</span>
                      </a>
                    ) : (
                      <span className="text-gray-400 italic">No phone</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalContactsOnPage > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-gray-200">
          {/* Results info */}
          <div className="text-sm text-gray-600 font-medium">
            Showing {totalContactsOnPage} contacts on page {currentPage}
            {hasMore && ' (more pages available)'}
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
