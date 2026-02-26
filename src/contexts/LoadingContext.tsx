"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

interface LoadingContextType {
  isInitialLoading: boolean;
  setLoadingComplete: () => void;
}

const LoadingContext = createContext<LoadingContextType | undefined>(
  undefined
);

export function LoadingProvider({ children }: { children: ReactNode }) {
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  const setLoadingComplete = () => {
    setIsInitialLoading(false);
  };

  return (
    <LoadingContext.Provider value={{ isInitialLoading, setLoadingComplete }}>
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
