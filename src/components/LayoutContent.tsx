"use client";

import { ReactNode } from "react";
import { useLoading } from "@/contexts/LoadingContext";
import { usePathname } from "next/navigation";
import NavigationSidebar from "@/components/NavigationSidebar";

export default function LayoutContent({ children }: { children: ReactNode }) {
  const { isPriorityLoadComplete } = useLoading();
  const pathname = usePathname();

  // Check if we're on auth pages (login, auth callback)
  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/auth');

  return (
    <>
      {isPriorityLoadComplete && <NavigationSidebar />}
      <div className={isPriorityLoadComplete && !isAuthPage ? "ml-16" : ""}>{children}</div>
    </>
  );
}
