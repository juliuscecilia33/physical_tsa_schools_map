"use client";

import { usePathname } from "next/navigation";
import MapView from "./MapView";
import CRMView from "./CRMView";

export default function ViewManager() {
  const pathname = usePathname();

  const isMapView = pathname === "/";
  const isCRMView = pathname === "/crm";

  return (
    <>
      <MapView isVisible={isMapView} />
      <CRMView isVisible={isCRMView} />
    </>
  );
}
