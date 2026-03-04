"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState, useEffect } from "react";

// Create a function to persist cache to sessionStorage
function createQueryClient() {
  const client = new QueryClient({
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

  // Synchronous restore before any queries mount (avoids race condition with useEffect)
  if (typeof window !== "undefined") {
    try {
      const cachedData = sessionStorage.getItem("react-query-cache");
      if (cachedData) {
        const parsed = JSON.parse(cachedData);
        const queries = Array.isArray(parsed) ? parsed : [parsed];
        for (const entry of queries) {
          if (entry.queryKey && entry.data) {
            client.setQueryData(entry.queryKey, entry.data, {
              updatedAt: entry.dataUpdatedAt || Date.now(),
            });
            console.log(`Restored facilities cache [${entry.queryKey.join(',')}] from sessionStorage with timestamp:`, new Date(entry.dataUpdatedAt || Date.now()).toLocaleTimeString());
          }
        }
      }
    } catch (error) {
      console.warn("Failed to restore React Query cache:", error);
      sessionStorage.removeItem("react-query-cache");
    }
  }

  return client;
}

export function ReactQueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => createQueryClient());

  // Persist cache to sessionStorage
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Save cache to sessionStorage before page unload
      const cache = queryClient.getQueryCache();
      const queries = cache.getAll();

      // Persist both facility queries (serpapi + background)
      const serpApiQuery = queries.find(
        (query) =>
          Array.isArray(query.queryKey) &&
          query.queryKey[0] === "facilities" &&
          query.queryKey[1] === "serpapi"
      );
      const backgroundQuery = queries.find(
        (query) =>
          Array.isArray(query.queryKey) &&
          query.queryKey[0] === "facilities" &&
          query.queryKey[1] === "background"
      );

      const queriesToSave = [serpApiQuery, backgroundQuery]
        .filter((q) => q && q.state.data)
        .map((q) => ({
          queryKey: q!.queryKey,
          data: q!.state.data,
          dataUpdatedAt: q!.state.dataUpdatedAt,
        }));

      if (queriesToSave.length > 0) {
        try {
          const cacheString = JSON.stringify(queriesToSave);

          // Check size (sessionStorage limit is typically 5-10MB)
          const sizeInMB = new Blob([cacheString]).size / (1024 * 1024);

          if (sizeInMB > 8) {
            console.warn(`React Query cache is large (${sizeInMB.toFixed(2)}MB), skipping persistence`);
            return;
          }

          sessionStorage.setItem("react-query-cache", cacheString);
          console.log(`Persisted facilities cache (${sizeInMB.toFixed(2)}MB, ${queriesToSave.length} queries)`);
        } catch (error) {
          console.warn("Failed to persist React Query cache:", error);
        }
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [queryClient]);

  // Also save cache when page loses focus (more reliable for navigation events)
  useEffect(() => {
    let debounceTimer: NodeJS.Timeout;

    const handleVisibilityChange = () => {
      // Clear any pending debounce to avoid multiple saves
      clearTimeout(debounceTimer);

      // Debounce for 500ms to prevent spurious events and allow animations to complete
      debounceTimer = setTimeout(() => {
        // Skip if map animation is in progress
        if (typeof window !== "undefined" && (window as any).__mapAnimating) {
          console.log(
            "Skipping cache save - map animation in progress"
          );
          return;
        }

        // Double-check that document is truly hidden (not just a spurious event)
        if (document.visibilityState === "hidden" && document.hidden) {
          const cache = queryClient.getQueryCache();
          const queries = cache.getAll();

          const serpApiQuery = queries.find(
            (query) =>
              Array.isArray(query.queryKey) &&
              query.queryKey[0] === "facilities" &&
              query.queryKey[1] === "serpapi"
          );
          const backgroundQuery = queries.find(
            (query) =>
              Array.isArray(query.queryKey) &&
              query.queryKey[0] === "facilities" &&
              query.queryKey[1] === "background"
          );

          const queriesToSave = [serpApiQuery, backgroundQuery]
            .filter((q) => q && q.state.data)
            .map((q) => ({
              queryKey: q!.queryKey,
              data: q!.state.data,
              dataUpdatedAt: q!.state.dataUpdatedAt,
            }));

          if (queriesToSave.length > 0) {
            try {
              const cacheString = JSON.stringify(queriesToSave);
              const sizeInMB = new Blob([cacheString]).size / (1024 * 1024);

              if (sizeInMB > 8) {
                console.warn(
                  `React Query cache is large (${sizeInMB.toFixed(2)}MB), skipping persistence`
                );
                return;
              }

              sessionStorage.setItem("react-query-cache", cacheString);
              console.log(
                `Persisted facilities cache on visibility change (${sizeInMB.toFixed(2)}MB, ${queriesToSave.length} queries)`
              );
            } catch (error) {
              console.warn("Failed to persist React Query cache:", error);
            }
          }
        }
      }, 500);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      clearTimeout(debounceTimer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [queryClient]);


  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
