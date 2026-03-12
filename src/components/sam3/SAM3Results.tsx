"use client";

import { Download, MapPin, ChevronDown, ChevronUp } from "lucide-react";
import { useState, useMemo } from "react";

interface SAM3ResultsProps {
  geojson: GeoJSON.FeatureCollection | null;
  featureCount: number;
  elapsedSeconds: number | null;
  error: string | null;
}

/** Compute centroid of a polygon's first ring */
function polygonCentroid(coords: number[][]): [number, number] {
  let sumLng = 0,
    sumLat = 0;
  // Exclude last point (same as first in GeoJSON rings)
  const ring = coords.slice(0, -1);
  for (const [lng, lat] of ring) {
    sumLng += lng;
    sumLat += lat;
  }
  return [sumLng / ring.length, sumLat / ring.length];
}

/** Approximate area of a polygon ring in sq meters using the shoelace formula on geodesic coords */
function approxAreaSqM(coords: number[][]): number {
  const toRad = Math.PI / 180;
  const R = 6371000; // Earth radius in meters
  const ring = coords.slice(0, -1);
  let area = 0;
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length;
    const [lng1, lat1] = ring[i];
    const [lng2, lat2] = ring[j];
    area += (lng2 - lng1) * toRad * (2 + Math.sin(lat1 * toRad) + Math.sin(lat2 * toRad));
  }
  area = Math.abs((area * R * R) / 2);
  return area;
}

function formatArea(sqm: number): string {
  if (sqm >= 10000) return `${(sqm / 10000).toFixed(2)} ha`;
  return `${sqm.toFixed(0)} m²`;
}

interface FeatureInfo {
  index: number;
  centroid: [number, number]; // [lng, lat]
  area: number; // sq meters
}

export default function SAM3Results({
  geojson,
  featureCount,
  elapsedSeconds,
  error,
}: SAM3ResultsProps) {
  const [expanded, setExpanded] = useState(false);

  const features = useMemo<FeatureInfo[]>(() => {
    if (!geojson?.features) return [];
    return geojson.features.map((f, i) => {
      let coords: number[][] = [];
      if (f.geometry.type === "Polygon") {
        coords = (f.geometry as GeoJSON.Polygon).coordinates[0];
      } else if (f.geometry.type === "MultiPolygon") {
        // Use the first polygon's outer ring
        coords = (f.geometry as GeoJSON.MultiPolygon).coordinates[0][0];
      }
      const centroid = coords.length > 0 ? polygonCentroid(coords) : [0, 0] as [number, number];
      const area = coords.length > 0 ? approxAreaSqM(coords) : 0;
      return { index: i + 1, centroid, area };
    });
  }, [geojson]);

  if (error) {
    return (
      <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-sm text-red-700 font-medium">Error</p>
        <p className="text-xs text-red-600 mt-1">{error}</p>
      </div>
    );
  }

  if (!geojson) return null;

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(geojson, null, 2)], {
      type: "application/geo+json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sam3-results.geojson";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin size={16} className="text-[#004aad]" />
          <span className="text-sm font-medium text-gray-800">
            {featureCount} feature{featureCount !== 1 ? "s" : ""} detected
          </span>
        </div>
        {elapsedSeconds != null && (
          <span className="text-xs text-gray-500">
            {elapsedSeconds.toFixed(1)}s
          </span>
        )}
      </div>

      {/* Feature list */}
      {features.length > 0 && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors text-xs font-medium text-gray-600"
          >
            Feature Details
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {expanded && (
            <div className="max-h-60 overflow-y-auto divide-y divide-gray-100">
              {features.map((f) => (
                <div
                  key={f.index}
                  className="px-3 py-2 flex items-start justify-between text-xs"
                >
                  <div>
                    <span className="font-medium text-gray-700">
                      #{f.index}
                    </span>
                    <span className="ml-2 text-gray-500">
                      {f.centroid[1].toFixed(5)}, {f.centroid[0].toFixed(5)}
                    </span>
                  </div>
                  <span className="text-gray-500 whitespace-nowrap ml-2">
                    {formatArea(f.area)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {featureCount > 0 && (
        <button
          onClick={handleExport}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <Download size={14} />
          Export GeoJSON
        </button>
      )}
    </div>
  );
}
