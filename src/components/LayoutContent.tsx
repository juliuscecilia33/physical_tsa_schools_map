"use client";

import { ReactNode } from "react";
import { useLoading } from "@/contexts/LoadingContext";
import NavigationSidebar from "@/components/NavigationSidebar";

export default function LayoutContent({ children }: { children: ReactNode }) {
  const { isInitialLoading } = useLoading();

  return (
    <>
      {!isInitialLoading && <NavigationSidebar />}
      <div className={isInitialLoading ? "" : "ml-16"}>{children}</div>
    </>
  );
}
