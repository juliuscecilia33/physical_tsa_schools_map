import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Facility } from "@/types/facility";

interface FacilityDetailsResponse {
  facility: Facility;
  truncated: boolean;
  totalPhotos: number;
  totalReviews: number;
}

/**
 * Fetches full facility details including reviews, additional_photos, and additional_reviews.
 * By default returns truncated data (first 10 photos/reviews). Use fetchFullDetails to load all.
 */
export function useFacilityDetails(placeId: string | null, enabled: boolean = true) {
  const queryClient = useQueryClient();

  const query = useQuery<FacilityDetailsResponse | null>({
    queryKey: ["facility", "full", placeId],
    queryFn: async () => {
      if (!placeId) return null;

      const response = await fetch(`/api/facilities/${encodeURIComponent(placeId)}`);

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch facility details");
      }

      return await response.json();
    },
    enabled: enabled && !!placeId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  const fetchFullDetails = async () => {
    if (!placeId) return;

    const response = await fetch(`/api/facilities/${encodeURIComponent(placeId)}?full=true`);
    if (!response.ok) return;

    const data: FacilityDetailsResponse = await response.json();
    queryClient.setQueryData(["facility", "full", placeId], data);
  };

  return {
    data: query.data?.facility ?? null,
    truncated: query.data?.truncated ?? false,
    totalPhotos: query.data?.totalPhotos ?? 0,
    totalReviews: query.data?.totalReviews ?? 0,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    fetchFullDetails,
  };
}
