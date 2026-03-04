import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchFacilityLeadLinks,
  fetchLeadFacilityLinks,
  createFacilityLeadLink,
  deleteFacilityLeadLink,
} from "@/utils/facilityLeadLinks";
import {
  FacilityLeadLink,
  CreateFacilityLeadLinkInput,
} from "@/types/facility-lead-link";

/**
 * Hook to fetch all facility-lead links for a specific Close CRM lead
 */
export function useFacilityLeadLinks(closeLeadId: string | null) {
  return useQuery<FacilityLeadLink[], Error>({
    queryKey: ["facility-lead-links", closeLeadId],
    queryFn: () => fetchFacilityLeadLinks(closeLeadId!),
    enabled: !!closeLeadId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook to fetch all facility-lead links for a specific facility
 */
export function useLeadFacilityLinks(placeId: string | null) {
  return useQuery<FacilityLeadLink[], Error>({
    queryKey: ["lead-facility-links", placeId],
    queryFn: () => fetchLeadFacilityLinks(placeId!),
    enabled: !!placeId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook to create a new facility-lead link
 */
export function useCreateFacilityLeadLink() {
  const queryClient = useQueryClient();

  return useMutation<FacilityLeadLink, Error, CreateFacilityLeadLinkInput>({
    mutationFn: createFacilityLeadLink,
    onSuccess: (data) => {
      // Invalidate queries for both the lead and the facility
      queryClient.invalidateQueries({
        queryKey: ["facility-lead-links", data.close_lead_id],
      });
      queryClient.invalidateQueries({
        queryKey: ["lead-facility-links", data.place_id],
      });
    },
  });
}

/**
 * Hook to delete a facility-lead link
 */
export function useDeleteFacilityLeadLink() {
  const queryClient = useQueryClient();

  return useMutation<
    void,
    Error,
    { id: string; closeLeadId: string; placeId: string }
  >({
    mutationFn: ({ id }) => deleteFacilityLeadLink(id),
    onSuccess: (_, variables) => {
      // Invalidate queries for both the lead and the facility
      queryClient.invalidateQueries({
        queryKey: ["facility-lead-links", variables.closeLeadId],
      });
      queryClient.invalidateQueries({
        queryKey: ["lead-facility-links", variables.placeId],
      });
    },
  });
}
