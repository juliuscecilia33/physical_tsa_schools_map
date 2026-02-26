"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

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

  const setLoadingComplete = () => {
    setIsInitialLoading(false);
  };

  const setPriorityLoadComplete = () => {
    setIsPriorityLoadComplete(true);
  };

  return (
    <LoadingContext.Provider value={{
      isInitialLoading,
      isPriorityLoadComplete,
      setLoadingComplete,
      setPriorityLoadComplete
    }}>
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
