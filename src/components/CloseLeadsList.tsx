'use client';

import { useCloseLeads, useCloseLeadStatuses } from '@/hooks/useCloseCRM';
import { Building2, ExternalLink } from 'lucide-react';
import { useMemo } from 'react';

interface CloseLeadsListProps {
  onLeadClick?: (leadId: string) => void;
}

export function CloseLeadsList({ onLeadClick }: CloseLeadsListProps) {
  const { data: leadsData, isLoading: leadsLoading, error: leadsError } = useCloseLeads({ _limit: 50 });
  const { data: statuses } = useCloseLeadStatuses();

  // Create a map of status_id to status_label for quick lookup
  const statusMap = useMemo(() => {
    if (!statuses) return new Map();
    return new Map(statuses.map((s) => [s.id, s.label]));
  }, [statuses]);

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
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Building2 className="w-5 h-5" />
          Leads ({leadsData.leads.length})
        </h3>
      </div>

      <div className="space-y-2">
        {leadsData.leads.map((lead) => {
          const statusLabel = statusMap.get(lead.status_id) || lead.status_label || 'Unknown';

          return (
            <div
              key={lead.id}
              onClick={() => onLeadClick?.(lead.id)}
              className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-gray-900 group-hover:text-blue-600">{lead.display_name || lead.name}</h4>
                    {lead.url && (
                      <a
                        href={lead.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>

                  {lead.description && (
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">{lead.description}</p>
                  )}

                  <div className="flex flex-wrap items-center gap-3 mt-2">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {statusLabel}
                    </span>

                    {lead.contacts && lead.contacts.length > 0 && (
                      <span className="text-xs text-gray-500">
                        {lead.contacts.length} contact{lead.contacts.length !== 1 ? 's' : ''}
                      </span>
                    )}

                    <span className="text-xs text-gray-400">
                      Created: {new Date(lead.date_created).toLocaleDateString()}
                    </span>
                  </div>

                  {lead.addresses && lead.addresses.length > 0 && (
                    <div className="mt-2 text-xs text-gray-600">
                      {lead.addresses[0].address_1 && (
                        <span>
                          {lead.addresses[0].address_1}
                          {lead.addresses[0].city && `, ${lead.addresses[0].city}`}
                          {lead.addresses[0].state && `, ${lead.addresses[0].state}`}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Contact details preview */}
              {lead.contacts && lead.contacts.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-xs font-medium text-gray-700 mb-1">Contacts:</p>
                  <div className="space-y-1">
                    {lead.contacts.slice(0, 2).map((contact) => (
                      <div key={contact.id} className="text-xs text-gray-600">
                        {contact.name && <span className="font-medium">{contact.name}</span>}
                        {contact.emails && contact.emails.length > 0 && (
                          <span className="ml-2">{contact.emails[0].email}</span>
                        )}
                        {contact.phones && contact.phones.length > 0 && (
                          <span className="ml-2">{contact.phones[0].phone}</span>
                        )}
                      </div>
                    ))}
                    {lead.contacts.length > 2 && (
                      <p className="text-xs text-gray-400">
                        +{lead.contacts.length - 2} more...
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {leadsData.hasMore && (
        <div className="text-center p-2 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-700">More leads available (pagination not implemented)</p>
        </div>
      )}
    </div>
  );
}
