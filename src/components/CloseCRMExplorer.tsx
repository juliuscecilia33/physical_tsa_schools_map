'use client';

import { useState, useEffect } from 'react';
import { useCloseUser } from '@/hooks/useCloseCRM';
import { CloseUsersList } from './CloseUsersList';
import { CloseLeadsList } from './CloseLeadsList';
import { CloseCallsList } from './CloseCallsList';
import { CloseEmailsList } from './CloseEmailsList';
import { CloseContactsList } from './CloseContactsList';
import { LeadDetailsSidebar } from './LeadDetailsSidebar';
import { CallDetailsSidebar } from './CallDetailsSidebar';
import { ContactDetailsSidebar } from './ContactDetailsSidebar';
import { EmailDetailsSidebar } from './EmailDetailsSidebar';
import { User, Building2, Phone, Mail, Users, CheckCircle, XCircle, X } from 'lucide-react';
import { Facility } from '@/types/facility';

type Tab = 'leads' | 'calls' | 'emails' | 'contacts' | 'users';

interface CloseCRMExplorerProps {
  facilities?: Facility[];
  onAddFacilityFromLead?: (leadName: string, leadId: string) => void;
  externalLeadId?: string | null;
  onFacilityClick?: (placeId: string) => void;
}

export function CloseCRMExplorer({ facilities = [], onAddFacilityFromLead, externalLeadId, onFacilityClick }: CloseCRMExplorerProps) {
  const [activeTab, setActiveTab] = useState<Tab>('leads');
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [selectedCallLeadId, setSelectedCallLeadId] = useState<string | null>(null);
  const [selectedEmailThreadId, setSelectedEmailThreadId] = useState<string | null>(null);
  const [selectedEmailLeadId, setSelectedEmailLeadId] = useState<string | null>(null);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [isDismissed, setIsDismissed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('close-crm-auth-dismissed') === 'true';
    }
    return false;
  });
  const { data: currentUser, isLoading: authLoading, error: authError } = useCloseUser();

  // Sync externalLeadId into selectedLeadId (used to reopen lead after adding facility)
  useEffect(() => {
    if (externalLeadId) {
      setSelectedLeadId(externalLeadId);
    }
  }, [externalLeadId]);

  const handleDismiss = () => {
    setIsDismissed(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem('close-crm-auth-dismissed', 'true');
    }
  };

  const tabs = [
    { id: 'leads' as Tab, label: 'Leads', icon: Building2 },
    { id: 'calls' as Tab, label: 'Calls', icon: Phone },
    { id: 'emails' as Tab, label: 'Emails', icon: Mail },
    { id: 'contacts' as Tab, label: 'Contacts', icon: Users },
    { id: 'users' as Tab, label: 'Users', icon: User },
  ];

  return (
    <div className="space-y-4">
      {/* Authentication Status */}
      {!isDismissed && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 relative">
          <button
            onClick={handleDismiss}
            className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
          {authLoading ? (
            <div className="flex items-center gap-2 text-gray-600">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
              <span className="text-sm">Verifying authentication...</span>
            </div>
          ) : authError ? (
            <div className="flex items-center gap-2 text-red-600">
              <XCircle className="w-5 h-5" />
              <div>
                <p className="text-sm font-medium">Authentication Failed</p>
                <p className="text-xs text-red-500 mt-1">{authError.message}</p>
              </div>
            </div>
          ) : currentUser ? (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="w-5 h-5" />
              <p className="text-sm font-medium">Connected to Close CRM</p>
            </div>
          ) : null}
        </div>
      )}

      {/* Tabs */}
      {!authError && (
        <div className="bg-white rounded-lg border border-gray-200">
          {/* Tab Headers */}
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                      flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors
                      ${
                        isActive
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }
                    `}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'leads' && (
              <CloseLeadsList onLeadClick={(leadId) => setSelectedLeadId(leadId)} />
            )}
            {activeTab === 'calls' && (
              <CloseCallsList onCallClick={(callId, leadId) => {
                setSelectedCallId(callId);
                setSelectedCallLeadId(leadId || null);
              }} />
            )}
            {activeTab === 'emails' && (
              <CloseEmailsList onEmailClick={(emailThreadId, leadId) => {
                setSelectedEmailThreadId(emailThreadId);
                setSelectedEmailLeadId(leadId || null);
              }} />
            )}
            {activeTab === 'contacts' && (
              <CloseContactsList onContactClick={(contactId) => setSelectedContactId(contactId)} />
            )}
            {activeTab === 'users' && <CloseUsersList />}
          </div>
        </div>
      )}

      {/* Lead Details Sidebar */}
      <LeadDetailsSidebar
        leadId={selectedLeadId}
        onClose={() => setSelectedLeadId(null)}
        facilities={facilities}
        onAddFacility={onAddFacilityFromLead}
        onFacilityClick={onFacilityClick}
      />

      {/* Call Details Sidebar */}
      <CallDetailsSidebar
        callId={selectedCallId}
        leadId={selectedCallLeadId}
        onClose={() => {
          setSelectedCallId(null);
          setSelectedCallLeadId(null);
        }}
        facilities={facilities}
      />

      {/* Contact Details Sidebar */}
      <ContactDetailsSidebar
        contactId={selectedContactId}
        onClose={() => setSelectedContactId(null)}
        onLeadClick={(leadId) => {
          setSelectedContactId(null);
          setSelectedLeadId(leadId);
        }}
      />

      {/* Email Details Sidebar */}
      <EmailDetailsSidebar
        emailThreadId={selectedEmailThreadId}
        leadId={selectedEmailLeadId}
        onClose={() => {
          setSelectedEmailThreadId(null);
          setSelectedEmailLeadId(null);
        }}
      />
    </div>
  );
}
