import { useQuery } from "@tanstack/react-query";
import { Facility } from "@/types/facility";

interface FacilityDetailsResponse {
  facility: Facility;
  totalPhotos: number;
  totalReviews: number;
}

/**
 * Fetches full facility details including reviews, additional_photos, and additional_reviews.
 */
export function useFacilityDetails(placeId: string | null, enabled: boolean = true) {
  const query = useQuery<FacilityDetailsResponse | null>({
    queryKey: ["facility", "full", placeId],
    queryFn: async () => {
      if (!placeId) return null;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      try {
        const response = await fetch(
          `/api/facilities/${encodeURIComponent(placeId)}`,
          { signal: controller.signal }
        );
        clearTimeout(timeout);

        if (!response.ok) {
          if (response.status === 404) {
            return null;
          }
          const error = await response.json();
          throw new Error(error.error || "Failed to fetch facility details");
        }

        return await response.json();
      } catch (err) {
        clearTimeout(timeout);
        throw err;
      }
    },
    enabled: enabled && !!placeId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
  });

  return {
    data: query.data?.facility ?? null,
    totalPhotos: query.data?.totalPhotos ?? 0,
    totalReviews: query.data?.totalReviews ?? 0,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
  };
}
