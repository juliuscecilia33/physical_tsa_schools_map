import type {
  CloseUser,
  CloseUsersResponse,
  CloseLeadsResponse,
  CloseLeadStatusesResponse,
  CloseContactsResponse,
  CloseCallsResponse,
  CloseEmailsResponse,
  CloseQueryParams,
} from '@/types/close';

const CLOSE_API_BASE_URL = 'https://api.close.com/api/v1';

/**
 * Close CRM API Client
 * Handles authentication and API requests to Close.com
 * Uses Basic Auth with API key from environment variables
 */
export class CloseApiClient {
  private apiKey: string;
  private authHeader: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.CLOSE_API_KEY || '';
    if (!this.apiKey) {
      throw new Error('Close API key is required. Set CLOSE_API_KEY environment variable.');
    }
    // Close uses Basic Auth with API key as username and empty password
    // Format: Basic base64(api_key:)
    this.authHeader = `Basic ${Buffer.from(`${this.apiKey}:`).toString('base64')}`;
  }

  /**
   * Make authenticated request to Close API
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${CLOSE_API_BASE_URL}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': this.authHeader,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    // Check rate limit headers
    const rateLimitRemaining = response.headers.get('ratelimit-remaining');
    const rateLimitReset = response.headers.get('ratelimit-reset');

    if (rateLimitRemaining && parseInt(rateLimitRemaining) < 10) {
      console.warn(`Close API rate limit warning: ${rateLimitRemaining} requests remaining, resets in ${rateLimitReset}s`);
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Close API error (${response.status}): ${errorText || response.statusText}`
      );
    }

    return response.json();
  }

  /**
   * Build query string from parameters
   */
  private buildQueryString(params: Record<string, any>): string {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, value.toString());
      }
    });
    const queryString = searchParams.toString();
    return queryString ? `?${queryString}` : '';
  }

  // ============================================
  // User & Authentication Endpoints
  // ============================================

  /**
   * Get authenticated user information
   * GET /me/
   */
  async getMe(): Promise<CloseUser> {
    return this.request<CloseUser>('/me/');
  }

  /**
   * List all users in the organization
   * GET /user/
   */
  async getUsers(params: CloseQueryParams = {}): Promise<CloseUsersResponse> {
    const queryString = this.buildQueryString(params);
    return this.request<CloseUsersResponse>(`/user/${queryString}`);
  }

  /**
   * Get a specific user by ID
   * GET /user/{id}/
   */
  async getUser(userId: string): Promise<CloseUser> {
    return this.request<CloseUser>(`/user/${userId}/`);
  }

  // ============================================
  // Lead Status Endpoints
  // ============================================

  /**
   * List all lead statuses (pipeline stages)
   * GET /status/lead/
   */
  async getLeadStatuses(): Promise<CloseLeadStatusesResponse> {
    return this.request<CloseLeadStatusesResponse>('/status/lead/');
  }

  // ============================================
  // Lead Endpoints
  // ============================================

  /**
   * List leads with optional filtering
   * GET /lead/
   */
  async getLeads(params: CloseQueryParams = {}): Promise<CloseLeadsResponse> {
    const queryString = this.buildQueryString(params);
    return this.request<CloseLeadsResponse>(`/lead/${queryString}`);
  }

  /**
   * Get a specific lead by ID
   * GET /lead/{id}/
   */
  async getLead(leadId: string): Promise<any> {
    return this.request(`/lead/${leadId}/`);
  }

  // ============================================
  // Contact Endpoints
  // ============================================

  /**
   * List contacts with optional filtering
   * GET /contact/
   */
  async getContacts(params: CloseQueryParams = {}): Promise<CloseContactsResponse> {
    const queryString = this.buildQueryString(params);
    return this.request<CloseContactsResponse>(`/contact/${queryString}`);
  }

  /**
   * Get a specific contact by ID
   * GET /contact/{id}/
   */
  async getContact(contactId: string): Promise<any> {
    return this.request(`/contact/${contactId}/`);
  }

  // ============================================
  // Call Activity Endpoints
  // ============================================

  /**
   * List call activities with optional filtering
   * GET /activity/call/
   */
  async getCalls(params: CloseQueryParams = {}): Promise<CloseCallsResponse> {
    const queryString = this.buildQueryString(params);
    return this.request<CloseCallsResponse>(`/activity/call/${queryString}`);
  }

  /**
   * Get a specific call activity by ID
   * GET /activity/call/{id}/
   */
  async getCall(callId: string, includeTranscript: boolean = false): Promise<any> {
    const fields = includeTranscript ? '?_fields=recording_transcript,voicemail_transcript' : '';
    return this.request(`/activity/call/${callId}/${fields}`);
  }

  // ============================================
  // Email Thread Endpoints
  // ============================================

  /**
   * List email threads with optional filtering
   * GET /activity/emailthread/
   */
  async getEmailThreads(params: CloseQueryParams = {}): Promise<CloseEmailsResponse> {
    const queryString = this.buildQueryString(params);
    return this.request<CloseEmailsResponse>(`/activity/emailthread/${queryString}`);
  }

  /**
   * Get a specific email thread by ID
   * GET /activity/emailthread/{id}/
   */
  async getEmailThread(threadId: string): Promise<any> {
    return this.request(`/activity/emailthread/${threadId}/`);
  }

  // ============================================
  // Note Activity Endpoints
  // ============================================

  /**
   * List note activities with optional filtering
   * GET /activity/note/
   */
  async getNotes(params: CloseQueryParams = {}): Promise<any> {
    const queryString = this.buildQueryString(params);
    return this.request(`/activity/note/${queryString}`);
  }

  /**
   * Get a specific note by ID
   * GET /activity/note/{id}/
   */
  async getNote(noteId: string): Promise<any> {
    return this.request(`/activity/note/${noteId}/`);
  }

  // ============================================
  // Task Endpoints
  // ============================================

  /**
   * List tasks with optional filtering
   * GET /task/
   */
  async getTasks(params: CloseQueryParams = {}): Promise<any> {
    const queryString = this.buildQueryString(params);
    return this.request(`/task/${queryString}`);
  }

  /**
   * Get a specific task by ID
   * GET /task/{id}/
   */
  async getTask(taskId: string): Promise<any> {
    return this.request(`/task/${taskId}/`);
  }

  // ============================================
  // Opportunity Endpoints
  // ============================================

  /**
   * List opportunities with optional filtering
   * GET /opportunity/
   */
  async getOpportunities(params: CloseQueryParams = {}): Promise<any> {
    const queryString = this.buildQueryString(params);
    return this.request(`/opportunity/${queryString}`);
  }

  /**
   * Get a specific opportunity by ID
   * GET /opportunity/{id}/
   */
  async getOpportunity(opportunityId: string): Promise<any> {
    return this.request(`/opportunity/${opportunityId}/`);
  }
}

/**
 * Create a singleton instance for server-side use
 */
export function getCloseApiClient(): CloseApiClient {
  return new CloseApiClient();
}
