export interface FacilityLeadLink {
  id: string;
  place_id: string;
  close_lead_id: string;
  confidence: number; // 1-5
  match_reason: string;
  created_at: string;
  updated_at: string;
}

export interface CreateFacilityLeadLinkInput {
  place_id: string;
  close_lead_id: string;
  confidence: number;
  match_reason: string;
}
