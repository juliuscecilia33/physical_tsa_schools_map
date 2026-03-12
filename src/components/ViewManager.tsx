"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import MapView from "./MapView";
import CRMView from "./CRMView";

export default function ViewManager() {
  const pathname = usePathname();
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    // Mark as mounted (client-side only)
    setIsMounted(true);

    // Check auth on client (belt and suspenders with server-side AuthGuard)
    const checkAuth = async () => {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
      }
    };

    checkAuth();
  }, [router]);

  // On server and initial client render, render the same content
  // This prevents hydration mismatch
  const isMapView = pathname === "/";
  const isCRMView = pathname === "/crm";

  // SAM3 Explorer has its own layout – don't render Map/CRM views
  if (pathname.startsWith("/sam3")) return null;

  return (
    <>
      <Suspense fallback={<div />}>
        <MapView isVisible={isMapView} />
      </Suspense>
      <CRMView isVisible={isCRMView} />
    </>
  );
}
