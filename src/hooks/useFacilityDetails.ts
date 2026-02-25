import { useQuery } from "@tanstack/react-query";
import { Facility } from "@/types/facility";

/**
 * Fetches full facility details including reviews, additional_photos, and additional_reviews
 * @param placeId - The place_id of the facility to fetch
 * @param enabled - Whether the query should run (default: true)
 */
export function useFacilityDetails(placeId: string | null, enabled: boolean = true) {
  return useQuery<Facility | null>({
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

      const data = await response.json();
      return data.facility;
    },
    enabled: enabled && !!placeId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
  });
}
