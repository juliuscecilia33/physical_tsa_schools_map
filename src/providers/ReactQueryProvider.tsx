"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState, useEffect } from "react";

// Create a function to persist cache to sessionStorage
function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Session-based caching: data stays fresh until user refreshes
        staleTime: Infinity,
        // Keep cached data indefinitely in this session
        gcTime: Infinity,
        // Retry failed requests
        retry: 2,
        // Refetch on window focus (when user returns to tab)
        refetchOnWindowFocus: false,
        // Don't refetch on mount if data exists
        refetchOnMount: false,
      },
    },
  });
}

export function ReactQueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => createQueryClient());

  // Persist cache to sessionStorage
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Save cache to sessionStorage before page unload
      const cache = queryClient.getQueryCache();
      const queries = cache.getAll();

      // Only persist the main facilities query (not notes, tags, or other queries)
      const facilitiesQuery = queries.find(
        (query) =>
          Array.isArray(query.queryKey) &&
          query.queryKey[0] === "facilities" &&
          query.queryKey[1] === "all"
      );

      if (facilitiesQuery && facilitiesQuery.state.data) {
        try {
          const serializedCache = {
            queryKey: facilitiesQuery.queryKey,
            data: facilitiesQuery.state.data,
            dataUpdatedAt: facilitiesQuery.state.dataUpdatedAt,
          };

          const cacheString = JSON.stringify(serializedCache);

          // Check size (sessionStorage limit is typically 5-10MB)
          const sizeInMB = new Blob([cacheString]).size / (1024 * 1024);

          if (sizeInMB > 8) {
            console.warn(`React Query cache is large (${sizeInMB.toFixed(2)}MB), skipping persistence`);
            return;
          }

          sessionStorage.setItem("react-query-cache", cacheString);
          console.log(`Persisted facilities cache (${sizeInMB.toFixed(2)}MB)`);
        } catch (error) {
          console.warn("Failed to persist React Query cache:", error);
        }
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [queryClient]);

  // Restore cache from sessionStorage on mount
  useEffect(() => {
    try {
      const cachedData = sessionStorage.getItem("react-query-cache");
      if (cachedData) {
        const parsed = JSON.parse(cachedData);

        // Restore the main facilities query
        if (parsed.queryKey && parsed.data) {
          queryClient.setQueryData(parsed.queryKey, parsed.data);
          console.log("Restored facilities cache from sessionStorage");
        }
      }
    } catch (error) {
      console.warn("Failed to restore React Query cache:", error);
      // Clear corrupted cache
      sessionStorage.removeItem("react-query-cache");
    }
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
