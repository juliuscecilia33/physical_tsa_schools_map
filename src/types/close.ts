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
  html_url?: string;
  organization_id: string;
  contacts?: CloseContact[];
  opportunities?: CloseOpportunity[];
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
  lead_id?: string;
  name?: string;
  title?: string;
  emails?: CloseEmail[];
  phones?: ClosePhone[];
  created_by?: string;
  updated_by?: string;
  date_created: string;
  date_updated: string;
  organization_id?: string;
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
  cost?: string;
  phone?: string;
  remote_phone?: string;
  remote_phone_formatted?: string;
  local_phone?: string;
  local_phone_formatted?: string;
  note?: string;
  note_html?: string;
  recording_url?: string;
  voicemail_url?: string;
  recording_duration?: number;
  voicemail_duration?: number;
  has_recording?: boolean;
  recording_transcript?: CloseCallTranscript;
  voicemail_transcript?: CloseCallTranscript;
  contact_id?: string;
}

export interface CloseCallTranscript {
  id?: string;
  has_speaker_labels?: boolean;
  speakers: {
    speaker_label: string;
    speaker_side: 'contact' | 'close-user';
    talk_time?: number;
    talk_percentage?: number;
  }[];
  utterances: {
    speaker_label: string;
    speaker_side: 'contact' | 'close-user';
    start: number;
    end: number;
    text: string;
    words?: {
      text: string;
      start: number;
      end: number;
    }[];
  }[];
  summary_text?: string;
  summary_html?: string;
}

// Email Thread types
export interface CloseEmailParticipant {
  email: string;
  name?: string;
}

export interface CloseEmailEnvelope {
  from?: CloseEmailParticipant[];
  sender?: CloseEmailParticipant[];
  to?: CloseEmailParticipant[];
  cc?: CloseEmailParticipant[];
  bcc?: CloseEmailParticipant[];
  reply_to?: CloseEmailParticipant[];
  date?: string;
  in_reply_to?: string | null;
  message_id?: string;
  subject?: string;
  is_autoreply?: boolean;
}

export interface CloseEmailAttachment {
  size: number;
  content_type: string;
  filename: string;
  content_id?: string | null;
  inline_only: boolean;
  url: string;
  thumbnail_url?: string;
}

export interface CloseEmailActivity {
  id: string;
  _type?: string;
  user_id?: string;
  user_name?: string;
  lead_id?: string;
  contact_id?: string | null;
  thread_id?: string;
  organization_id?: string;
  email_account_id?: string;
  body_preview?: string;
  date_sent?: string | null;
  activity_at?: string;
  opens_summary?: any;
  to?: string[];
  has_attachments?: boolean;
  date_created: string;
  date_updated: string;
  bcc?: string[];
  status?: string;
  cc?: string[];
  subject?: string;
  send_as_id?: string | null;
  direction?: 'incoming' | 'outgoing';
  sender?: string;
  envelope?: CloseEmailEnvelope;
  body_text?: string;
  body_html?: string;
  body_text_quoted?: Array<{
    text: string;
    expand: boolean;
  }>;
  attachments?: CloseEmailAttachment[];
  opens?: any[];
  message_ids?: string[];
  references?: string[];
  in_reply_to_id?: string | null;
  template_id?: string | null;
  template_name?: string | null;
  sequence_id?: string | null;
  sequence_name?: string | null;
  sequence_subscription_id?: string | null;
  bulk_email_action_id?: string | null;
  created_by?: string | null;
  created_by_name?: string | null;
  updated_by?: string | null;
  updated_by_name?: string | null;
  users?: string[];
  has_reply?: boolean;
  send_attempts?: any[];
}

export interface CloseEmailThread {
  id: string;
  _type?: string;
  lead_id: string;
  contact_id?: string | null;
  user_id: string;
  user_name?: string;
  activity_at?: string;
  latest_normalized_subject?: string;
  subject?: string; // Legacy field, kept for backward compatibility
  date_created: string;
  date_updated: string;
  status?: string;
  direction?: 'incoming' | 'outgoing';
  preview?: string;
  snippet?: string;
  participants?: CloseEmailParticipant[];
  users?: string[];
  latest_emails?: CloseEmailActivity[]; // From list endpoint
  emails?: CloseEmailActivity[]; // Full array from detail endpoint
  n_emails?: number;
  organization_id?: string;
  created_by?: string | null;
  created_by_name?: string | null;
  updated_by?: string | null;
  updated_by_name?: string | null;
  summary?: string | null;
  importance?: {
    type: string;
    reason: string;
  };
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
  status_display_name?: string;
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
export type CloseContactsResponse = ClosePaginatedResponse<CloseContact>;
export type CloseCallsResponse = ClosePaginatedResponse<CloseCallActivity>;
export type CloseEmailsResponse = ClosePaginatedResponse<CloseEmailThread>;
export type CloseNotesResponse = ClosePaginatedResponse<CloseNoteActivity>;
export type CloseTasksResponse = ClosePaginatedResponse<CloseTask>;
export type CloseOpportunitiesResponse = ClosePaginatedResponse<CloseOpportunity>;
