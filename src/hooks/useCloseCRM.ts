import { useQuery, useQueries, UseQueryResult } from '@tanstack/react-query';
import type {
  CloseUser,
  CloseLead,
  CloseLeadStatus,
  CloseContact,
  CloseCallActivity,
  CloseEmailThread,
  CloseQueryParams,
  CloseActivity,
} from '@/types/close';

// API Response wrappers
interface CloseApiResponse<T> {
  success: boolean;
  data: T;
  has_more?: boolean;
  pagination?: {
    limit: number;
    skip: number;
  };
  error?: string;
}

// ============================================
// Authentication & Users
// ============================================

/**
 * Get authenticated user information from Close
 */
export function useCloseUser(): UseQueryResult<CloseUser> {
  return useQuery({
    queryKey: ['close', 'me'],
    queryFn: async () => {
      const response = await fetch('/api/close/me');
      const data: CloseApiResponse<CloseUser> = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch user');
      }
      return data.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Get all users in the organization
 */
export function useCloseUsers(params?: { _limit?: number; _skip?: number }): UseQueryResult<{
  users: CloseUser[];
  hasMore: boolean;
}> {
  return useQuery({
    queryKey: ['close', 'users', params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params?._limit) searchParams.append('_limit', params._limit.toString());
      if (params?._skip) searchParams.append('_skip', params._skip.toString());

      const response = await fetch(`/api/close/users?${searchParams.toString()}`);
      const data: CloseApiResponse<CloseUser[]> = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch users');
      }
      return {
        users: data.data,
        hasMore: data.has_more || false,
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

// ============================================
// Lead Statuses
// ============================================

/**
 * Get all lead statuses (pipeline stages)
 */
export function useCloseLeadStatuses(options?: { enabled?: boolean }): UseQueryResult<CloseLeadStatus[]> {
  return useQuery({
    queryKey: ['close', 'leadStatuses'],
    enabled: options?.enabled ?? true,
    queryFn: async () => {
      const response = await fetch('/api/close/lead-statuses');
      const data: CloseApiResponse<CloseLeadStatus[]> = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch lead statuses');
      }
      return data.data;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
}

// ============================================
// Leads
// ============================================

/**
 * Get leads with optional filtering
 */
export function useCloseLeads(params?: CloseQueryParams): UseQueryResult<{
  leads: CloseLead[];
  hasMore: boolean;
}> {
  return useQuery({
    queryKey: ['close', 'leads', params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params?._limit) searchParams.append('_limit', params._limit.toString());
      if (params?._skip) searchParams.append('_skip', params._skip.toString());
      if (params?.status_id) searchParams.append('status_id', params.status_id);
      if (params?.date_created__gt) searchParams.append('date_created__gt', params.date_created__gt);
      if (params?.date_created__lt) searchParams.append('date_created__lt', params.date_created__lt);

      const response = await fetch(`/api/close/leads?${searchParams.toString()}`);
      const data: CloseApiResponse<CloseLead[]> = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch leads');
      }
      return {
        leads: data.data,
        hasMore: data.has_more || false,
      };
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Get a single lead by ID with full details
 */
export function useCloseLead(leadId: string | null): UseQueryResult<CloseLead> {
  return useQuery({
    queryKey: ['close', 'lead', leadId],
    queryFn: async () => {
      if (!leadId) {
        throw new Error('Lead ID is required');
      }
      const response = await fetch(`/api/close/leads/${leadId}`);
      const data: CloseApiResponse<CloseLead> = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch lead');
      }
      return data.data;
    },
    enabled: !!leadId, // Only run query if leadId is provided
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Get multiple leads by their IDs (batch fetching with caching)
 * Uses React Query's useQueries for parallel fetching with automatic deduplication
 */
export function useCloseLeadsBatch(leadIds: string[]) {
  return useQueries({
    queries: leadIds.map((leadId) => ({
      queryKey: ['close', 'lead', leadId],
      queryFn: async () => {
        const response = await fetch(`/api/close/leads/${leadId}`);
        const data: CloseApiResponse<CloseLead> = await response.json();
        if (!data.success) {
          throw new Error(data.error || 'Failed to fetch lead');
        }
        return data.data;
      },
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      enabled: !!leadId,
    })),
  });
}

/**
 * Get all activities for a specific lead (unified timeline)
 */
export function useCloseLeadActivities(
  leadId: string | null,
  limit: number = 100
): UseQueryResult<{
  activities: CloseActivity[];
  count: {
    total: number;
    calls: number;
    emails: number;
    notes: number;
    tasks: number;
    opportunities: number;
  };
}> {
  return useQuery({
    queryKey: ['close', 'lead-activities', leadId, limit],
    queryFn: async () => {
      if (!leadId) {
        throw new Error('Lead ID is required');
      }
      const searchParams = new URLSearchParams();
      searchParams.append('lead_id', leadId);
      searchParams.append('_limit', limit.toString());

      const response = await fetch(`/api/close/activities?${searchParams.toString()}`);
      const data: any = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch activities');
      }
      return {
        activities: data.data,
        count: data.count,
      };
    },
    enabled: !!leadId, // Only run query if leadId is provided
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

// ============================================
// Lead Search
// ============================================

/**
 * Search leads across all data using Close CRM's Advanced Filtering API
 * Only triggers when query is at least 2 characters
 */
export function useSearchCloseLeads(query: string): UseQueryResult<{
  leads: CloseLead[];
  totalResults: number;
}> {
  return useQuery({
    queryKey: ['close', 'leads', 'search', query],
    queryFn: async () => {
      const response = await fetch('/api/close/leads/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, limit: 25 }),
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to search leads');
      }
      return {
        leads: data.data as CloseLead[],
        totalResults: data.total_results as number,
      };
    },
    enabled: query.length >= 2,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

// ============================================
// Contacts
// ============================================

/**
 * Get contacts with optional filtering
 */
export function useCloseContacts(params?: CloseQueryParams): UseQueryResult<{
  contacts: CloseContact[];
  hasMore: boolean;
}> {
  return useQuery({
    queryKey: ['close', 'contacts', params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params?._limit) searchParams.append('_limit', params._limit.toString());
      if (params?._skip) searchParams.append('_skip', params._skip.toString());
      if (params?.lead_id) searchParams.append('lead_id', params.lead_id);

      const response = await fetch(`/api/close/contacts?${searchParams.toString()}`);
      const data: CloseApiResponse<CloseContact[]> = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch contacts');
      }
      return {
        contacts: data.data,
        hasMore: data.has_more || false,
      };
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Get a single contact by ID with full details and activities
 */
export function useCloseContact(contactId: string | null): UseQueryResult<
  CloseContact & { activities?: any[] }
> {
  return useQuery({
    queryKey: ['close', 'contact', contactId],
    queryFn: async () => {
      if (!contactId) {
        throw new Error('Contact ID is required');
      }
      const response = await fetch(`/api/close/contacts/${contactId}`);
      const data: CloseApiResponse<CloseContact & { activities?: any[] }> = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch contact');
      }
      return data.data;
    },
    enabled: !!contactId, // Only run query if contactId is provided
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

// ============================================
// Call Activities
// ============================================

/**
 * Get call activities with optional filtering
 */
export function useCloseCalls(params?: CloseQueryParams): UseQueryResult<{
  calls: CloseCallActivity[];
  hasMore: boolean;
}> {
  return useQuery({
    queryKey: ['close', 'calls', params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params?._limit) searchParams.append('_limit', params._limit.toString());
      if (params?._skip) searchParams.append('_skip', params._skip.toString());
      if (params?.lead_id) searchParams.append('lead_id', params.lead_id);
      if (params?.user_id) searchParams.append('user_id', params.user_id);
      if (params?.date_created__gt) searchParams.append('date_created__gt', params.date_created__gt);
      if (params?.date_created__lt) searchParams.append('date_created__lt', params.date_created__lt);

      const response = await fetch(`/api/close/calls?${searchParams.toString()}`);
      const data: CloseApiResponse<CloseCallActivity[]> = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch calls');
      }
      return {
        calls: data.data,
        hasMore: data.has_more || false,
      };
    },
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Get a single call by ID with full details including transcript
 */
export function useCloseCall(callId: string | null): UseQueryResult<CloseCallActivity> {
  return useQuery({
    queryKey: ['close', 'call', callId],
    queryFn: async () => {
      if (!callId) {
        throw new Error('Call ID is required');
      }
      const response = await fetch(`/api/close/calls/${callId}`);
      const data: CloseApiResponse<CloseCallActivity> = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch call');
      }
      return data.data;
    },
    enabled: !!callId, // Only run query if callId is provided
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

// ============================================
// Email Threads
// ============================================

/**
 * Get a single email thread by ID with full details
 */
export function useCloseEmail(emailThreadId: string | null): UseQueryResult<CloseEmailThread> {
  return useQuery({
    queryKey: ['close', 'email', emailThreadId],
    queryFn: async () => {
      if (!emailThreadId) {
        throw new Error('Email thread ID is required');
      }
      const response = await fetch(`/api/close/emails/${emailThreadId}`);
      const data: CloseApiResponse<CloseEmailThread> = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch email thread');
      }
      return data.data;
    },
    enabled: !!emailThreadId, // Only run query if emailThreadId is provided
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Get email threads with optional filtering
 */
export function useCloseEmails(params?: CloseQueryParams): UseQueryResult<{
  emails: CloseEmailThread[];
  hasMore: boolean;
}> {
  return useQuery({
    queryKey: ['close', 'emails', params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params?._limit) searchParams.append('_limit', params._limit.toString());
      if (params?._skip) searchParams.append('_skip', params._skip.toString());
      if (params?.lead_id) searchParams.append('lead_id', params.lead_id);
      if (params?.user_id) searchParams.append('user_id', params.user_id);
      if (params?.date_created__gt) searchParams.append('date_created__gt', params.date_created__gt);
      if (params?.date_created__lt) searchParams.append('date_created__lt', params.date_created__lt);

      const response = await fetch(`/api/close/emails?${searchParams.toString()}`);
      const data: CloseApiResponse<CloseEmailThread[]> = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch email threads');
      }
      return {
        emails: data.data,
        hasMore: data.has_more || false,
      };
    },
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}
