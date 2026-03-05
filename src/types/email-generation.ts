export interface EmailBreakdown {
  referencedActivities: Array<{
    date: string;
    type: string;
    direction?: string;
    influence: string;
  }>;
  keyQuotes: Array<{
    source: string;
    quote: string;
    usage: string;
  }>;
  talkingPointRationale: Array<{
    point: string;
    why: string;
  }>;
  toneJustification: string;
}

export interface GeneratedEmail {
  id: string;
  close_lead_id: string;
  recipient_email?: string;
  recipient_name?: string;
  subject: string;
  body_text: string;
  email_type: 'intro' | 'follow_up' | 'reply';
  reasoning: string;
  generation_context?: EmailBreakdown | null;
  status: 'draft' | 'sent' | 'discarded';
  created_at: string;
}

export interface ActivitySummary {
  id?: string;
  type: 'call' | 'email' | 'note';
  date: string;
  direction?: string;
  // Email fields
  subject?: string;
  body?: string;
  // Call fields
  transcript?: string;
  callSummary?: string;
  voicemailTranscript?: string;
  duration?: number;
  disposition?: string;
  // Note fields
  note?: string;
  userName?: string;
}

export interface GenerateEmailRequest {
  leadId: string;
  leadName: string;
  leadDescription?: string;
  contactName?: string;
  contactEmail?: string;
  contactTitle?: string;
  activities: ActivitySummary[];
}
