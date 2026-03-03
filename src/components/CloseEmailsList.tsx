'use client';

import { useCloseEmails } from '@/hooks/useCloseCRM';
import { Mail, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';

export function CloseEmailsList() {
  const { data, isLoading, error } = useCloseEmails({ _limit: 50 });

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
        <p className="text-red-800 text-sm">Error loading emails: {error.message}</p>
      </div>
    );
  }

  if (!data?.emails || data.emails.length === 0) {
    return (
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <p className="text-gray-600 text-sm">No email threads found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Mail className="w-5 h-5" />
          Email Threads ({data.emails.length})
        </h3>
      </div>

      <div className="space-y-2">
        {data.emails.map((email) => (
          <div
            key={email.id}
            className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-start gap-3">
              {/* Direction Icon */}
              <div className="mt-1">
                {email.direction === 'inbound' ? (
                  <ArrowDownToLine className="w-5 h-5 text-blue-600" />
                ) : email.direction === 'outbound' ? (
                  <ArrowUpFromLine className="w-5 h-5 text-green-600" />
                ) : (
                  <Mail className="w-5 h-5 text-gray-600" />
                )}
              </div>

              {/* Email Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-gray-900 truncate">
                      {email.subject || '(No Subject)'}
                    </h4>
                    {email.direction && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 mt-1 capitalize">
                        {email.direction}
                      </span>
                    )}
                  </div>
                </div>

                {(email.preview || email.snippet) && (
                  <p className="mt-2 text-sm text-gray-600 line-clamp-2">
                    {email.preview || email.snippet}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-3 mt-2">
                  <span className="text-xs text-gray-400">
                    {new Date(email.date_created).toLocaleString()}
                  </span>
                  {email.user_name && (
                    <span className="text-xs text-gray-500">by {email.user_name}</span>
                  )}
                  {email.status && (
                    <span className="text-xs text-gray-500 capitalize">{email.status}</span>
                  )}
                </div>

                <div className="mt-2 text-xs text-gray-400">
                  <span>Thread ID: {email.id}</span>
                  {email.lead_id && <span className="ml-3">Lead: {email.lead_id}</span>}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {data.hasMore && (
        <div className="text-center p-2 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-700">
            More email threads available (pagination not implemented)
          </p>
        </div>
      )}
    </div>
  );
}
