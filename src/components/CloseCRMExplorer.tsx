'use client';

import { useState } from 'react';
import { useCloseUser } from '@/hooks/useCloseCRM';
import { CloseUsersList } from './CloseUsersList';
import { CloseLeadsList } from './CloseLeadsList';
import { CloseCallsList } from './CloseCallsList';
import { CloseEmailsList } from './CloseEmailsList';
import { LeadDetailsSidebar } from './LeadDetailsSidebar';
import { User, Building2, Phone, Mail, CheckCircle, XCircle } from 'lucide-react';

type Tab = 'users' | 'leads' | 'calls' | 'emails';

export function CloseCRMExplorer() {
  const [activeTab, setActiveTab] = useState<Tab>('users');
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const { data: currentUser, isLoading: authLoading, error: authError } = useCloseUser();

  const tabs = [
    { id: 'users' as Tab, label: 'Users', icon: User },
    { id: 'leads' as Tab, label: 'Leads', icon: Building2 },
    { id: 'calls' as Tab, label: 'Calls', icon: Phone },
    { id: 'emails' as Tab, label: 'Emails', icon: Mail },
  ];

  return (
    <div className="space-y-4">
      {/* Authentication Status */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h2 className="text-xl font-bold mb-3">Close CRM Integration</h2>

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
            <div>
              <p className="text-sm font-medium">Connected to Close CRM</p>
              <p className="text-xs text-gray-600 mt-1">
                Authenticated as {currentUser.first_name} {currentUser.last_name} ({currentUser.email})
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Organization ID: {currentUser.organization_id}
              </p>
            </div>
          </div>
        ) : null}
      </div>

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
            {activeTab === 'users' && <CloseUsersList />}
            {activeTab === 'leads' && (
              <CloseLeadsList onLeadClick={(leadId) => setSelectedLeadId(leadId)} />
            )}
            {activeTab === 'calls' && <CloseCallsList />}
            {activeTab === 'emails' && <CloseEmailsList />}
          </div>
        </div>
      )}

      {/* Lead Details Sidebar */}
      <LeadDetailsSidebar
        leadId={selectedLeadId}
        onClose={() => setSelectedLeadId(null)}
      />
    </div>
  );
}
