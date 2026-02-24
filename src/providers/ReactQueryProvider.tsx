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

      const serializedCache = queries.map((query) => ({
        queryKey: query.queryKey,
        state: query.state,
      }));

      try {
        sessionStorage.setItem(
          "react-query-cache",
          JSON.stringify(serializedCache)
        );
      } catch (error) {
        console.warn("Failed to persist React Query cache:", error);
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

        parsed.forEach((item: any) => {
          queryClient.setQueryData(item.queryKey, item.state.data);
        });
      }
    } catch (error) {
      console.warn("Failed to restore React Query cache:", error);
    }
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
