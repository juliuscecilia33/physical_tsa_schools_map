"use client";

import { ReactNode } from "react";
import { useLoading } from "@/contexts/LoadingContext";
import NavigationSidebar from "@/components/NavigationSidebar";

export default function LayoutContent({ children }: { children: ReactNode }) {
  const { isPriorityLoadComplete } = useLoading();

  return (
    <>
      {isPriorityLoadComplete && <NavigationSidebar />}
      <div className={isPriorityLoadComplete ? "ml-16" : ""}>{children}</div>
    </>
  );
}
