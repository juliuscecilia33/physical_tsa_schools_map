'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  User,
  Mail,
  Phone,
  Building2,
  Calendar,
  PhoneIncoming,
  PhoneOutgoing,
  AlertCircle,
  MapPin,
  Briefcase,
  MessageSquare,
} from 'lucide-react';
import { useCloseContact, useCloseLead } from '@/hooks/useCloseCRM';

interface ContactDetailsSidebarProps {
  contactId: string | null;
  onClose: () => void;
  onLeadClick?: (leadId: string) => void;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleString();
}

export function ContactDetailsSidebar({
  contactId,
  onClose,
  onLeadClick,
}: ContactDetailsSidebarProps) {
  const { data: contact, isLoading: contactLoading, error: contactError } = useCloseContact(contactId);
  const { data: lead } = useCloseLead(contact?.lead_id || null);

  const isOpen = !!contactId;

  // Get contact-specific activities
  const activities = contact?.activities || [];

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
              <div className="flex-1 min-w-0 flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-medium text-lg">
                  {contact?.name
                    ? contact.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase()
                    : '?'}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {contactLoading ? 'Loading...' : contact?.name || 'Unnamed Contact'}
                  </h2>
                  {contact?.title && (
                    <p className="text-sm text-gray-600 mt-1">{contact.title}</p>
                  )}
                </div>
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
              {contactError && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-red-900">Failed to load contact</p>
                    <p className="text-sm text-red-700 mt-1">{contactError.message}</p>
                  </div>
                </div>
              )}

              {contactLoading ? (
                <div className="flex items-center justify-center p-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                </div>
              ) : contact ? (
                <>
                  {/* Contact Information Section */}
                  <div className="bg-gray-50 rounded-lg p-5 space-y-4">
                    <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                      <User className="w-4 h-4" />
                      Contact Information
                    </h3>

                    {/* Emails */}
                    {contact.emails && contact.emails.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs text-gray-500 uppercase tracking-wider">Email Addresses</p>
                        {contact.emails.map((email, idx) => (
                          <div key={idx} className="flex items-center gap-3">
                            <Mail className="w-4 h-4 text-gray-400" />
                            <div>
                              <a
                                href={`mailto:${email.email}`}
                                className="text-blue-600 hover:text-blue-800 hover:underline text-sm"
                              >
                                {email.email}
                              </a>
                              {email.type && (
                                <span className="ml-2 text-xs text-gray-500">({email.type})</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Phones */}
                    {contact.phones && contact.phones.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs text-gray-500 uppercase tracking-wider">Phone Numbers</p>
                        {contact.phones.map((phone, idx) => (
                          <div key={idx} className="flex items-center gap-3">
                            <Phone className="w-4 h-4 text-gray-400" />
                            <div>
                              <a
                                href={`tel:${phone.phone}`}
                                className="text-blue-600 hover:text-blue-800 hover:underline text-sm"
                              >
                                {phone.phone}
                              </a>
                              {phone.type && (
                                <span className="ml-2 text-xs text-gray-500">({phone.type})</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Created/Updated */}
                    <div className="flex items-center gap-3 pt-3 border-t border-gray-200">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <div className="text-sm text-gray-600">
                        Created {formatDate(contact.date_created)}
                      </div>
                    </div>
                  </div>

                  {/* Associated Lead Section */}
                  {lead && (
                    <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-3">
                      <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                        <Building2 className="w-4 h-4" />
                        Company/Lead
                      </h3>

                      <div>
                        <button
                          onClick={() => {
                            if (contact.lead_id && onLeadClick) {
                              onLeadClick(contact.lead_id);
                              onClose();
                            }
                          }}
                          className="font-medium text-blue-600 hover:text-blue-800 hover:underline text-base"
                        >
                          {lead.display_name || lead.name}
                        </button>
                        {lead.status_label && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 ml-2">
                            {lead.status_label}
                          </span>
                        )}
                      </div>

                      {lead.addresses && lead.addresses.length > 0 && lead.addresses[0].address_1 && (
                        <div className="flex items-start gap-3">
                          <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                          <div className="text-sm text-gray-700">
                            {lead.addresses[0].address_1}
                            {lead.addresses[0].city && (
                              <div>
                                {lead.addresses[0].city}
                                {lead.addresses[0].state && `, ${lead.addresses[0].state}`}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Activities Section */}
                  {activities.length > 0 && (
                    <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
                      <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                        <MessageSquare className="w-4 h-4" />
                        Recent Activity ({activities.length})
                      </h3>

                      <div className="space-y-3">
                        {activities.slice(0, 10).map((activity, idx) => {
                          const isCall = activity.activity_type === 'call';

                          return (
                            <div
                              key={idx}
                              className="p-3 bg-gray-50 rounded-lg border border-gray-100"
                            >
                              <div className="flex items-start gap-3">
                                {isCall ? (
                                  activity.direction === 'inbound' ? (
                                    <PhoneIncoming className="w-5 h-5 text-blue-600 mt-0.5" />
                                  ) : (
                                    <PhoneOutgoing className="w-5 h-5 text-green-600 mt-0.5" />
                                  )
                                ) : (
                                  <Mail className="w-5 h-5 text-purple-600 mt-0.5" />
                                )}

                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-gray-900 capitalize">
                                      {isCall ? `${activity.direction} Call` : 'Email'}
                                    </span>
                                    {isCall && activity.disposition && (
                                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800">
                                        {activity.disposition.replace('-', ' ')}
                                      </span>
                                    )}
                                  </div>

                                  <p className="text-xs text-gray-500 mt-1">
                                    {formatDate(activity.date_created)}
                                  </p>

                                  {activity.note && (
                                    <p className="text-sm text-gray-700 mt-2 line-clamp-2">
                                      {activity.note}
                                    </p>
                                  )}

                                  {!isCall && activity.subject && (
                                    <p className="text-sm font-medium text-gray-900 mt-1">
                                      {activity.subject}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}

                        {activities.length > 10 && (
                          <p className="text-xs text-gray-500 text-center pt-2">
                            +{activities.length - 10} more activities
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {activities.length === 0 && (
                    <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                      <p className="text-gray-600 text-sm">No recent activities with this contact</p>
                    </div>
                  )}
                </>
              ) : null}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
