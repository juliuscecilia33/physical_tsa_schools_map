"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import MapView from "./MapView";
import CRMView from "./CRMView";

export default function ViewManager() {
  const pathname = usePathname();

  const isMapView = pathname === "/";
  const isCRMView = pathname === "/crm";

  return (
    <>
      <Suspense fallback={<div />}>
        <MapView isVisible={isMapView} />
      </Suspense>
      <CRMView isVisible={isCRMView} />
    </>
  );
}
