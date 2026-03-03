'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  MapPin,
  Phone,
  Mail,
  Globe,
  Building2,
  User,
  Calendar,
  ExternalLink,
  AlertCircle,
} from 'lucide-react';
import { useCloseLead, useCloseLeadActivities, useCloseLeadStatuses } from '@/hooks/useCloseCRM';
import { CloseActivityTimeline } from './CloseActivityTimeline';
import { useMemo } from 'react';

interface LeadDetailsSidebarProps {
  leadId: string | null;
  onClose: () => void;
}

export function LeadDetailsSidebar({ leadId, onClose }: LeadDetailsSidebarProps) {
  const { data: lead, isLoading: leadLoading, error: leadError } = useCloseLead(leadId);
  const {
    data: activitiesData,
    isLoading: activitiesLoading,
  } = useCloseLeadActivities(leadId);
  const { data: statuses } = useCloseLeadStatuses();

  // Get status label
  const statusLabel = useMemo(() => {
    if (!lead || !statuses) return null;
    const status = statuses.find((s) => s.id === lead.status_id);
    return status?.label || lead.status_label || 'Unknown';
  }, [lead, statuses]);

  const isOpen = !!leadId;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
          />

          {/* Sidebar */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 h-full w-full max-w-2xl bg-white shadow-2xl z-50 overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-white">
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold text-gray-900 truncate">
                  {leadLoading ? 'Loading...' : lead?.display_name || lead?.name || 'Lead Details'}
                </h2>
                {statusLabel && (
                  <div className="mt-2">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                      {statusLabel}
                    </span>
                  </div>
                )}
              </div>
              <button
                onClick={onClose}
                className="ml-4 p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {leadError && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-red-900">Failed to load lead</p>
                    <p className="text-sm text-red-700 mt-1">{leadError.message}</p>
                  </div>
                </div>
              )}

              {leadLoading ? (
                <div className="flex items-center justify-center p-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                </div>
              ) : lead ? (
                <>
                  {/* About Section */}
                  <div className="bg-gray-50 rounded-lg p-5 space-y-4">
                    <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                      <Building2 className="w-4 h-4" />
                      About
                    </h3>

                    {lead.description && (
                      <p className="text-sm text-gray-700">{lead.description}</p>
                    )}

                    {/* Address */}
                    {lead.addresses && lead.addresses.length > 0 && (
                      <div className="flex items-start gap-3">
                        <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                        <div className="text-sm text-gray-700">
                          {lead.addresses[0].address_1}
                          {lead.addresses[0].address_2 && (
                            <>, {lead.addresses[0].address_2}</>
                          )}
                          {(lead.addresses[0].city ||
                            lead.addresses[0].state ||
                            lead.addresses[0].zipcode) && (
                            <div>
                              {lead.addresses[0].city}
                              {lead.addresses[0].state && `, ${lead.addresses[0].state}`}
                              {lead.addresses[0].zipcode && ` ${lead.addresses[0].zipcode}`}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Website */}
                    {lead.url && (
                      <div className="flex items-center gap-3">
                        <Globe className="w-4 h-4 text-gray-400" />
                        <a
                          href={lead.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                        >
                          {lead.url}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}

                    {/* Dates */}
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <Calendar className="w-4 h-4" />
                      <div>
                        <div>Created: {new Date(lead.date_created).toLocaleDateString()}</div>
                        <div>Updated: {new Date(lead.date_updated).toLocaleDateString()}</div>
                      </div>
                    </div>
                  </div>

                  {/* Contacts Section */}
                  {lead.contacts && lead.contacts.length > 0 && (
                    <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
                      <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                        <User className="w-4 h-4" />
                        Contacts ({lead.contacts.length})
                      </h3>

                      <div className="space-y-4">
                        {lead.contacts.map((contact) => (
                          <div
                            key={contact.id}
                            className="p-4 bg-gray-50 rounded-lg space-y-2"
                          >
                            {contact.name && (
                              <p className="font-medium text-gray-900">{contact.name}</p>
                            )}
                            {contact.title && (
                              <p className="text-sm text-gray-600">{contact.title}</p>
                            )}

                            {/* Emails */}
                            {contact.emails && contact.emails.length > 0 && (
                              <div className="space-y-1">
                                {contact.emails.map((email, idx) => (
                                  <div
                                    key={idx}
                                    className="flex items-center gap-2 text-sm"
                                  >
                                    <Mail className="w-4 h-4 text-gray-400" />
                                    <a
                                      href={`mailto:${email.email}`}
                                      className="text-blue-600 hover:text-blue-800"
                                    >
                                      {email.email}
                                    </a>
                                    {email.type && (
                                      <span className="text-xs text-gray-500">
                                        ({email.type})
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Phones */}
                            {contact.phones && contact.phones.length > 0 && (
                              <div className="space-y-1">
                                {contact.phones.map((phone, idx) => (
                                  <div
                                    key={idx}
                                    className="flex items-center gap-2 text-sm"
                                  >
                                    <Phone className="w-4 h-4 text-gray-400" />
                                    <a
                                      href={`tel:${phone.phone}`}
                                      className="text-blue-600 hover:text-blue-800"
                                    >
                                      {phone.phone}
                                    </a>
                                    {phone.type && (
                                      <span className="text-xs text-gray-500">
                                        ({phone.type})
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Custom Fields */}
                  {lead.custom && Object.keys(lead.custom).length > 0 && (
                    <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-3">
                      <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
                        Custom Fields
                      </h3>
                      <div className="space-y-2">
                        {Object.entries(lead.custom).map(([key, value]) => (
                          <div key={key} className="flex justify-between text-sm">
                            <span className="text-gray-600">{key}:</span>
                            <span className="text-gray-900 font-medium">
                              {String(value)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Activity Timeline */}
                  <div className="bg-white border border-gray-200 rounded-lg p-5">
                    <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
                      Activity Timeline
                    </h3>
                    {activitiesData && (
                      <div className="mb-3 flex flex-wrap gap-2 text-xs text-gray-600">
                        <span>Total: {activitiesData.count.total}</span>
                        {activitiesData.count.calls > 0 && (
                          <span>• Calls: {activitiesData.count.calls}</span>
                        )}
                        {activitiesData.count.emails > 0 && (
                          <span>• Emails: {activitiesData.count.emails}</span>
                        )}
                        {activitiesData.count.notes > 0 && (
                          <span>• Notes: {activitiesData.count.notes}</span>
                        )}
                        {activitiesData.count.tasks > 0 && (
                          <span>• Tasks: {activitiesData.count.tasks}</span>
                        )}
                        {activitiesData.count.opportunities > 0 && (
                          <span>• Opportunities: {activitiesData.count.opportunities}</span>
                        )}
                      </div>
                    )}
                    <CloseActivityTimeline
                      activities={activitiesData?.activities || []}
                      isLoading={activitiesLoading}
                    />
                  </div>
                </>
              ) : null}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
