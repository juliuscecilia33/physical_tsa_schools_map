// Close CRM API Types
// Based on https://developer.close.com/

// Base pagination response structure
export interface ClosePaginatedResponse<T> {
  data: T[];
  has_more: boolean;
  total_results?: number;
}

// User types
export interface CloseUser {
  id: string;
  organization_id: string;
  email: string;
  first_name: string;
  last_name: string;
  image?: string;
  date_created: string;
  date_updated: string;
}

// Lead Status types
export interface CloseLeadStatus {
  id: string;
  organization_id: string;
  label: string;
  type: string;
}

// Lead types
export interface CloseLead {
  id: string;
  name: string;
  status_id: string;
  status_label?: string;
  description?: string;
  url?: string;
  organization_id: string;
  contacts?: CloseContact[];
  created_by?: string;
  updated_by?: string;
  date_created: string;
  date_updated: string;
  display_name?: string;
  addresses?: CloseAddress[];
  custom?: Record<string, any>;
}

// Contact types
export interface CloseContact {
  id: string;
  name?: string;
  title?: string;
  emails?: CloseEmail[];
  phones?: ClosePhone[];
  created_by?: string;
  updated_by?: string;
  date_created: string;
  date_updated: string;
}

export interface CloseEmail {
  email: string;
  type: string;
}

export interface ClosePhone {
  phone: string;
  type: string;
}

export interface CloseAddress {
  label?: string;
  address_1?: string;
  address_2?: string;
  city?: string;
  state?: string;
  zipcode?: string;
  country?: string;
}

// Call Activity types
export interface CloseCallActivity {
  id: string;
  lead_id: string;
  user_id: string;
  user_name?: string;
  created_by?: string;
  updated_by?: string;
  date_created: string;
  date_updated: string;
  direction: 'inbound' | 'outbound';
  status: string;
  disposition?: 'answered' | 'no-answer' | 'vm-answer' | 'vm-left' | 'busy' | 'blocked' | 'error' | 'abandoned';
  call_method?: 'regular' | 'power' | 'predictive';
  duration?: number;
  cost?: number;
  phone?: string;
  note?: string;
  note_html?: string;
  recording_url?: string;
  voicemail_url?: string;
  recording_transcript?: CloseCallTranscript;
  voicemail_transcript?: CloseCallTranscript;
}

export interface CloseCallTranscript {
  speakers: {
    id: string;
    name: string;
  }[];
  utterances: {
    speaker_id: string;
    start: number;
    text: string;
  }[];
}

// Email Thread types
export interface CloseEmailThread {
  id: string;
  lead_id: string;
  user_id: string;
  user_name?: string;
  subject?: string;
  date_created: string;
  date_updated: string;
  status?: string;
  direction?: 'inbound' | 'outbound';
  preview?: string;
  snippet?: string;
}

// Note Activity types
export interface CloseNoteActivity {
  id: string;
  lead_id: string;
  user_id: string;
  user_name?: string;
  created_by?: string;
  date_created: string;
  date_updated: string;
  note: string;
  note_html?: string;
}

// Task types
export interface CloseTask {
  id: string;
  lead_id: string;
  assigned_to?: string;
  created_by?: string;
  date_created: string;
  date_updated: string;
  due_date?: string;
  text: string;
  is_complete: boolean;
  is_archived?: boolean;
}

// Opportunity types
export interface CloseOpportunity {
  id: string;
  lead_id: string;
  status_id: string;
  status_label?: string;
  status_type?: 'active' | 'won' | 'lost';
  confidence?: number;
  value?: number;
  value_period?: 'one_time' | 'monthly' | 'annual';
  value_formatted?: string;
  expected_value?: number;
  date_won?: string;
  note?: string;
  created_by?: string;
  date_created: string;
  date_updated: string;
}

// Unified Activity Type (for timeline display)
export type CloseActivityType =
  | 'call'
  | 'email'
  | 'note'
  | 'status_change'
  | 'created'
  | 'task'
  | 'opportunity';

export interface CloseActivity {
  id: string;
  type: CloseActivityType;
  lead_id: string;
  user_id?: string;
  user_name?: string;
  date_created: string;
  date_updated: string;
  // Type-specific data
  call?: CloseCallActivity;
  email?: CloseEmailThread;
  note?: CloseNoteActivity;
  task?: CloseTask;
  opportunity?: CloseOpportunity;
  // For display
  title?: string;
  description?: string;
}

// API Query parameters
export interface CloseQueryParams {
  _limit?: number;
  _skip?: number;
  lead_id?: string;
  user_id?: string;
  date_created__gt?: string;
  date_created__lt?: string;
  status_id?: string;
}

// API Response types for convenience
export type CloseUsersResponse = ClosePaginatedResponse<CloseUser>;
export type CloseLeadsResponse = ClosePaginatedResponse<CloseLead>;
export type CloseLeadStatusesResponse = ClosePaginatedResponse<CloseLeadStatus>;
export type CloseCallsResponse = ClosePaginatedResponse<CloseCallActivity>;
export type CloseEmailsResponse = ClosePaginatedResponse<CloseEmailThread>;
export type CloseNotesResponse = ClosePaginatedResponse<CloseNoteActivity>;
export type CloseTasksResponse = ClosePaginatedResponse<CloseTask>;
export type CloseOpportunitiesResponse = ClosePaginatedResponse<CloseOpportunity>;
