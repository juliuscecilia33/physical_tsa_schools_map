'use client';

import { useCloseUsers } from '@/hooks/useCloseCRM';
import { User } from 'lucide-react';

export function CloseUsersList() {
  const { data, isLoading, error } = useCloseUsers({ _limit: 100 });

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
        <p className="text-red-800 text-sm">Error loading users: {error.message}</p>
      </div>
    );
  }

  if (!data?.users || data.users.length === 0) {
    return (
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <p className="text-gray-600 text-sm">No users found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <User className="w-5 h-5" />
          Users ({data.users.length})
        </h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {data.users.map((user) => (
          <div
            key={user.id}
            className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-start gap-3">
              {user.image ? (
                <img
                  src={user.image}
                  alt={`${user.first_name} ${user.last_name}`}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                  <User className="w-5 h-5 text-gray-500" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900">
                  {user.first_name} {user.last_name}
                </p>
                <p className="text-sm text-gray-600 truncate">{user.email}</p>
                <p className="text-xs text-gray-400 mt-1">ID: {user.id}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {data.hasMore && (
        <div className="text-center p-2 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-700">More users available (pagination not implemented)</p>
        </div>
      )}
    </div>
  );
}
