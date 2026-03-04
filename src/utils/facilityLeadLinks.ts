import { createClient } from "@/lib/supabase/client";
import {
  FacilityLeadLink,
  CreateFacilityLeadLinkInput,
} from "@/types/facility-lead-link";

const supabase = createClient();

/**
 * Fetch all facility-lead links for a specific Close CRM lead
 */
export async function fetchFacilityLeadLinks(
  closeLeadId: string
): Promise<FacilityLeadLink[]> {
  const { data, error } = await supabase
    .from("facility_lead_links")
    .select("*")
    .eq("close_lead_id", closeLeadId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching facility-lead links:", error);
    throw error;
  }

  return data || [];
}

/**
 * Fetch all facility-lead links for a specific facility (by place_id)
 */
export async function fetchLeadFacilityLinks(
  placeId: string
): Promise<FacilityLeadLink[]> {
  const { data, error } = await supabase
    .from("facility_lead_links")
    .select("*")
    .eq("place_id", placeId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching lead-facility links:", error);
    throw error;
  }

  return data || [];
}

/**
 * Create a new facility-lead link
 */
export async function createFacilityLeadLink(
  input: CreateFacilityLeadLinkInput
): Promise<FacilityLeadLink> {
  const { data, error } = await supabase
    .from("facility_lead_links")
    .insert({
      place_id: input.place_id,
      close_lead_id: input.close_lead_id,
      confidence: input.confidence,
      match_reason: input.match_reason,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating facility-lead link:", error);
    throw error;
  }

  return data;
}

/**
 * Delete a facility-lead link by ID
 */
export async function deleteFacilityLeadLink(id: string): Promise<void> {
  const { error } = await supabase
    .from("facility_lead_links")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting facility-lead link:", error);
    throw error;
  }
}

/**
 * Check if a facility is already linked to a lead
 */
export async function checkFacilityLeadLink(
  placeId: string,
  closeLeadId: string
): Promise<FacilityLeadLink | null> {
  const { data, error } = await supabase
    .from("facility_lead_links")
    .select("*")
    .eq("place_id", placeId)
    .eq("close_lead_id", closeLeadId)
    .maybeSingle();

  if (error) {
    console.error("Error checking facility-lead link:", error);
    throw error;
  }

  return data;
}
