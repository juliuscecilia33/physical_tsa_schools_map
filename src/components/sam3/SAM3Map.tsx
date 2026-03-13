"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import MapGL, {
  Source,
  Layer,
  NavigationControl,
} from "react-map-gl";
import type { MapRef, MapLayerMouseEvent } from "react-map-gl";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

const INITIAL_VIEW_STATE = {
  longitude: -99.9,
  latitude: 31.97,
  zoom: 6,
};

interface SAM3MapProps {
  bbox: [number, number, number, number] | null;
  onBboxChange: (bbox: [number, number, number, number] | null) => void;
  geojsonResult: GeoJSON.FeatureCollection | null;
  savedFeatures: GeoJSON.FeatureCollection | null;
  isDrawing: boolean;
}

export default function SAM3Map({
  bbox,
  onBboxChange,
  geojsonResult,
  savedFeatures,
  isDrawing,
}: SAM3MapProps) {
  const mapRef = useRef<MapRef>(null);
  const [firstCorner, setFirstCorner] = useState<[number, number] | null>(null);
  const [previewCorner, setPreviewCorner] = useState<[number, number] | null>(null);

  // Handle map click for bbox drawing
  const handleClick = useCallback(
    (e: MapLayerMouseEvent) => {
      if (!isDrawing) return;

      const { lng, lat } = e.lngLat;

      if (!firstCorner) {
        // First click: set first corner
        setFirstCorner([lng, lat]);
        setPreviewCorner(null);
        onBboxChange(null);
      } else {
        // Second click: complete bbox
        const west = Math.min(firstCorner[0], lng);
        const south = Math.min(firstCorner[1], lat);
        const east = Math.max(firstCorner[0], lng);
        const north = Math.max(firstCorner[1], lat);
        onBboxChange([west, south, east, north]);
        setFirstCorner(null);
        setPreviewCorner(null);
      }
    },
    [isDrawing, firstCorner, onBboxChange]
  );

  // Preview rectangle while drawing
  const handleMouseMove = useCallback(
    (e: MapLayerMouseEvent) => {
      if (!isDrawing || !firstCorner) return;
      setPreviewCorner([e.lngLat.lng, e.lngLat.lat]);
    },
    [isDrawing, firstCorner]
  );

  // Build bbox rectangle GeoJSON
  const bboxGeoJSON = useMemo(() => {
    let coords: [number, number, number, number] | null = null;

    if (bbox) {
      coords = bbox;
    } else if (firstCorner && previewCorner) {
      const west = Math.min(firstCorner[0], previewCorner[0]);
      const south = Math.min(firstCorner[1], previewCorner[1]);
      const east = Math.max(firstCorner[0], previewCorner[0]);
      const north = Math.max(firstCorner[1], previewCorner[1]);
      coords = [west, south, east, north];
    }

    if (!coords) return null;

    const [w, s, e, n] = coords;
    return {
      type: "FeatureCollection" as const,
      features: [
        {
          type: "Feature" as const,
          properties: {},
          geometry: {
            type: "Polygon" as const,
            coordinates: [
              [
                [w, s],
                [e, s],
                [e, n],
                [w, n],
                [w, s],
              ],
            ],
          },
        },
      ],
    };
  }, [bbox, firstCorner, previewCorner]);

  return (
    <MapGL
      ref={mapRef}
      initialViewState={INITIAL_VIEW_STATE}
      mapboxAccessToken={MAPBOX_TOKEN}
      mapStyle="mapbox://styles/mapbox/satellite-streets-v12"
      style={{ width: "100%", height: "100%" }}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      cursor={isDrawing ? "crosshair" : "grab"}
      attributionControl={false}
    >
      <NavigationControl position="bottom-right" />

      {/* Bbox rectangle */}
      {bboxGeoJSON && (
        <Source type="geojson" data={bboxGeoJSON}>
          <Layer
            id="bbox-fill"
            type="fill"
            paint={{
              "fill-color": "#004aad",
              "fill-opacity": 0.1,
            }}
          />
          <Layer
            id="bbox-line"
            type="line"
            paint={{
              "line-color": "#004aad",
              "line-width": 2,
              "line-dasharray": [3, 2],
            }}
          />
        </Source>
      )}

      {/* Saved features — blue, rendered below fresh results */}
      {savedFeatures && savedFeatures.features.length > 0 && (
        <Source type="geojson" data={savedFeatures}>
          <Layer
            id="saved-fill"
            type="fill"
            paint={{
              "fill-color": "#3b82f6",
              "fill-opacity": 0.3,
            }}
          />
          <Layer
            id="saved-outline"
            type="line"
            paint={{
              "line-color": "#1d4ed8",
              "line-width": 2,
              "line-dasharray": [4, 3],
            }}
          />
        </Source>
      )}

      {/* Segmentation results overlay — color by rectangularity */}
      {geojsonResult && geojsonResult.features.length > 0 && (
        <Source type="geojson" data={geojsonResult}>
          <Layer
            id="sam3-fill"
            type="fill"
            paint={{
              "fill-color": [
                "interpolate",
                ["linear"],
                ["coalesce", ["get", "rectangularity"], 0.5],
                0.3, "#ef4444",   // red — poor match
                0.5, "#f97316",   // orange — borderline
                0.7, "#22c55e",   // green — good match
              ],
              "fill-opacity": 0.45,
            }}
          />
          <Layer
            id="sam3-outline"
            type="line"
            paint={{
              "line-color": [
                "interpolate",
                ["linear"],
                ["coalesce", ["get", "rectangularity"], 0.5],
                0.3, "#dc2626",
                0.5, "#ea580c",
                0.7, "#16a34a",
              ],
              "line-width": 2,
            }}
          />
        </Source>
      )}
    </MapGL>
  );
}
