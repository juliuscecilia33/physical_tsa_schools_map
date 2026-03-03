'use client';

import { useState } from 'react';
import { useCloseContacts, useCloseLeads } from '@/hooks/useCloseCRM';
import { User, Mail, Phone, Building2, ChevronLeft, ChevronRight } from 'lucide-react';

interface CloseContactsListProps {
  onContactClick?: (contactId: string) => void;
}

export function CloseContactsList({ onContactClick }: CloseContactsListProps) {
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;
  const skip = (currentPage - 1) * itemsPerPage;

  // Fetch contacts with server-side pagination
  const { data, isLoading, error } = useCloseContacts({
    _limit: itemsPerPage,
    _skip: skip,
  });

  // Fetch leads to get company names
  const { data: leadsData } = useCloseLeads({ _limit: 1000 });
  const leadsMap = new Map(
    (leadsData?.leads || []).map((lead) => [lead.id, lead.name])
  );

  const contacts = data?.contacts || [];
  const hasMore = data?.hasMore || false;
  const totalContacts = contacts.length;
  const startIndex = skip + 1;
  const endIndex = skip + totalContacts;

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
          Contacts {totalContacts > 0 && `(${startIndex}-${endIndex}${hasMore ? '+' : ''})`}
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
              const companyName = contact.lead_id ? leadsMap.get(contact.lead_id) : null;

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
                    {companyName ? (
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-700">{companyName}</span>
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
      {totalContacts > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-gray-200">
          {/* Results info */}
          <div className="text-sm text-gray-600 font-medium">
            Showing {startIndex}-{endIndex} {hasMore && 'of many more'} contacts
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
