"use client";

import React, { createContext, useCallback, useContext, useMemo, useState, ReactNode } from "react";

interface LoadingContextType {
  isInitialLoading: boolean;
  isPriorityLoadComplete: boolean;
  setLoadingComplete: () => void;
  setPriorityLoadComplete: () => void;
}

const LoadingContext = createContext<LoadingContextType | undefined>(
  undefined
);

export function LoadingProvider({ children }: { children: ReactNode }) {
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isPriorityLoadComplete, setIsPriorityLoadComplete] = useState(false);

  const setLoadingComplete = useCallback(() => {
    setIsInitialLoading(false);
  }, []);

  const setPriorityLoadComplete = useCallback(() => {
    setIsPriorityLoadComplete(true);
  }, []);

  const value = useMemo(() => ({
    isInitialLoading,
    isPriorityLoadComplete,
    setLoadingComplete,
    setPriorityLoadComplete,
  }), [isInitialLoading, isPriorityLoadComplete, setLoadingComplete, setPriorityLoadComplete]);

  return (
    <LoadingContext.Provider value={value}>
      {children}
    </LoadingContext.Provider>
  );
}

export function useLoading() {
  const context = useContext(LoadingContext);
  if (context === undefined) {
    throw new Error("useLoading must be used within a LoadingProvider");
  }
  return context;
}
