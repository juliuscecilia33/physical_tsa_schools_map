"use client";

import { Download, MapPin, ChevronDown, ChevronUp, Filter, Database } from "lucide-react";
import { useState, useMemo } from "react";

interface SAM3ResultsProps {
  geojson: GeoJSON.FeatureCollection | null;
  featureCount: number;
  totalBeforeFilter: number;
  areaFilteredCount: number;
  shapeFilteredCount: number;
  effectivePrompt: string | null;
  areaStats: Record<string, number> | null;
  elapsedSeconds: number | null;
  error: string | null;
  clientMinArea: number;
  onClientMinAreaChange: (value: number) => void;
  onSave: () => void;
  isSaving: boolean;
}

/** Compute centroid of a polygon's first ring */
function polygonCentroid(coords: number[][]): [number, number] {
  let sumLng = 0,
    sumLat = 0;
  const ring = coords.slice(0, -1);
  for (const [lng, lat] of ring) {
    sumLng += lng;
    sumLat += lat;
  }
  return [sumLng / ring.length, sumLat / ring.length];
}

function formatArea(sqm: number): string {
  if (sqm >= 10000) return `${(sqm / 10000).toFixed(2)} ha`;
  return `${sqm.toFixed(0)} m²`;
}

interface FeatureInfo {
  index: number;
  centroid: [number, number];
  area: number;
  rectangularity: number | null;
  aspectRatio: number | null;
  compactness: number | null;
}

export default function SAM3Results({
  geojson,
  featureCount,
  totalBeforeFilter,
  areaFilteredCount,
  shapeFilteredCount,
  effectivePrompt,
  areaStats,
  elapsedSeconds,
  error,
  clientMinArea,
  onClientMinAreaChange,
  onSave,
  isSaving,
}: SAM3ResultsProps) {
  const [expanded, setExpanded] = useState(false);

  const features = useMemo<FeatureInfo[]>(() => {
    if (!geojson?.features) return [];
    return geojson.features.map((f, i) => {
      const props = (f.properties as Record<string, unknown>) ?? {};
      const serverArea = props.area_sqm;
      let coords: number[][] = [];
      if (f.geometry.type === "Polygon") {
        coords = (f.geometry as GeoJSON.Polygon).coordinates[0];
      } else if (f.geometry.type === "MultiPolygon") {
        coords = (f.geometry as GeoJSON.MultiPolygon).coordinates[0][0];
      }
      const centroid = coords.length > 0 ? polygonCentroid(coords) : [0, 0] as [number, number];
      const area = typeof serverArea === "number" ? serverArea : 0;
      const rectangularity = typeof props.rectangularity === "number" ? props.rectangularity : null;
      const aspectRatio = typeof props.aspect_ratio === "number" ? props.aspect_ratio : null;
      const compactness = typeof props.compactness === "number" ? props.compactness : null;
      return { index: i + 1, centroid, area, rectangularity, aspectRatio, compactness };
    });
  }, [geojson]);

  // Compute max area for slider range
  const maxArea = useMemo(() => {
    if (features.length === 0) return 1000;
    return Math.max(...features.map((f) => f.area), 1000);
  }, [features]);

  if (error) {
    return (
      <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-sm text-red-700 font-medium">Error</p>
        <p className="text-xs text-red-600 mt-1">{error}</p>
      </div>
    );
  }

  if (!geojson) return null;

  const displayedCount = geojson.features.length;

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
            {displayedCount} of {totalBeforeFilter > 0 ? totalBeforeFilter : featureCount} feature{totalBeforeFilter !== 1 ? "s" : ""}
          </span>
        </div>
        {elapsedSeconds != null && (
          <span className="text-xs text-gray-500">
            {elapsedSeconds.toFixed(1)}s
          </span>
        )}
      </div>

      {/* Server-side filter info */}
      {(areaFilteredCount > 0 || shapeFilteredCount > 0) && (
        <div className="text-xs text-gray-500 bg-gray-50 rounded px-2 py-1.5 space-y-0.5">
          {areaFilteredCount > 0 && (
            <div>{areaFilteredCount} removed by area filter</div>
          )}
          {shapeFilteredCount > 0 && (
            <div>{shapeFilteredCount} removed by shape filter</div>
          )}
        </div>
      )}

      {/* Area distribution stats */}
      {areaStats && totalBeforeFilter > 0 && (
        <div className="text-xs text-gray-500 bg-gray-50 rounded px-2 py-1.5 font-mono">
          <div>Area range: {formatArea(areaStats.min)} – {formatArea(areaStats.max)}</div>
          <div>Median: {formatArea(areaStats.median)} | Mean: {formatArea(areaStats.mean)}</div>
          <div>&gt;500m²: {areaStats.count_over_500} | &gt;1000m²: {areaStats.count_over_1000}</div>
        </div>
      )}

      {/* Effective prompt */}
      {effectivePrompt && (
        <div className="text-xs text-gray-500 bg-gray-50 rounded px-2 py-1">
          Prompt: &ldquo;{effectivePrompt}&rdquo;
        </div>
      )}

      {/* Client-side area filter slider */}
      {featureCount > 0 && (
        <div className="border border-gray-200 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
            <Filter size={12} />
            Post-filter by area
          </div>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={Math.ceil(maxArea)}
              step={Math.max(1, Math.ceil(maxArea / 100))}
              value={clientMinArea}
              onChange={(e) => onClientMinAreaChange(parseFloat(e.target.value))}
              className="flex-1 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#004aad]"
            />
            <input
              type="number"
              min={0}
              value={clientMinArea}
              onChange={(e) => onClientMinAreaChange(Math.max(0, parseFloat(e.target.value) || 0))}
              className="w-20 px-1.5 py-1 border border-gray-300 rounded text-xs font-mono text-black focus:outline-none focus:ring-1 focus:ring-[#004aad]"
            />
            <span className="text-xs text-gray-500">m²</span>
          </div>
          <div className="text-xs text-gray-500">
            Showing {displayedCount} of {featureCount} features
          </div>
        </div>
      )}

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
                  className="px-3 py-2 text-xs space-y-0.5"
                >
                  <div className="flex items-start justify-between">
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
                  {f.rectangularity !== null && (
                    <div className="flex gap-3 text-gray-400 font-mono text-[10px]">
                      <span>rect: {f.rectangularity.toFixed(2)}</span>
                      {f.aspectRatio !== null && <span>aspect: {f.aspectRatio.toFixed(1)}</span>}
                      {f.compactness !== null && <span>compact: {f.compactness.toFixed(2)}</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {displayedCount > 0 && (
        <div className="space-y-2">
          <button
            onClick={handleExport}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Download size={14} />
            Export GeoJSON ({displayedCount} features)
          </button>
          <button
            onClick={onSave}
            disabled={isSaving}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-[#004aad] text-white rounded-lg text-sm hover:bg-[#003a8c] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Database size={14} />
            {isSaving ? "Saving..." : `Save to Database (${displayedCount} features)`}
          </button>
        </div>
      )}
    </div>
  );
}
