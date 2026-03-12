"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { ScanSearch } from "lucide-react";
import SAM3Map from "@/components/sam3/SAM3Map";
import SAM3Controls from "@/components/sam3/SAM3Controls";
import SAM3Results from "@/components/sam3/SAM3Results";

type BBox = [number, number, number, number];

export default function SAM3Page() {
  const [bbox, setBbox] = useState<BBox | null>(null);
  const [isDrawing, setIsDrawing] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [geojsonResult, setGeojsonResult] =
    useState<GeoJSON.FeatureCollection | null>(null);
  const [featureCount, setFeatureCount] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const pollStatus = useCallback((jobId: string) => {
    let failCount = 0;
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/sam3/status?jobId=${jobId}`);
        const data = await res.json();

        if (!res.ok) {
          // Intermittent server error — tolerate a few before giving up
          failCount++;
          if (failCount >= 10) {
            setError(data.error || "Lost connection to SAM3 server");
            setIsProcessing(false);
            if (pollRef.current) clearInterval(pollRef.current);
          }
          return;
        }

        failCount = 0; // Reset on success

        setStatusMessage(data.message || data.status);
        setProgress(data.progress || 0);

        if (data.status === "complete") {
          if (pollRef.current) clearInterval(pollRef.current);
          setIsProcessing(false);
          setGeojsonResult(data.result?.geojson || null);
          setFeatureCount(data.result?.feature_count || 0);
          setElapsedSeconds(data.elapsed_seconds || null);
          setIsDrawing(false);
        } else if (data.status === "error") {
          if (pollRef.current) clearInterval(pollRef.current);
          setIsProcessing(false);
          setError(data.error || "Unknown error");
        }
      } catch {
        // Network error – keep polling, tolerate failures
        failCount++;
        if (failCount >= 10) {
          setError("Lost connection to SAM3 server");
          setIsProcessing(false);
          if (pollRef.current) clearInterval(pollRef.current);
        }
      }
    }, 2000);
  }, []);

  const handleSubmit = useCallback(
    async (prompt: string) => {
      if (!bbox) return;

      setIsProcessing(true);
      setError(null);
      setGeojsonResult(null);
      setFeatureCount(0);
      setElapsedSeconds(null);
      setProgress(0);
      setStatusMessage("Submitting...");

      try {
        const res = await fetch("/api/sam3/segment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bbox, prompt, zoom: 18 }),
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "Failed to start segmentation");
          setIsProcessing(false);
          return;
        }

        // Start polling
        pollStatus(data.job_id);
      } catch {
        setError("Failed to connect to server");
        setIsProcessing(false);
      }
    },
    [bbox, pollStatus]
  );

  const handleClear = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    setBbox(null);
    setIsDrawing(true);
    setIsProcessing(false);
    setStatusMessage(null);
    setProgress(0);
    setGeojsonResult(null);
    setFeatureCount(0);
    setElapsedSeconds(null);
    setError(null);
  }, []);

  const handleBboxChange = useCallback((newBbox: BBox | null) => {
    setBbox(newBbox);
    if (newBbox) {
      setIsDrawing(false);
    }
  }, []);

  return (
    <div className="h-screen w-screen pl-16 relative">
      {/* Map fills the entire area */}
      <div className="absolute inset-0 pl-16">
        <SAM3Map
          bbox={bbox}
          onBboxChange={handleBboxChange}
          geojsonResult={geojsonResult}
          isDrawing={isDrawing}
        />
      </div>

      {/* Control panel overlay */}
      <div className="absolute top-4 left-20 z-10 w-80 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 bg-gradient-to-r from-[#004aad] to-[#0066ee] text-white">
          <div className="flex items-center gap-2">
            <ScanSearch size={20} />
            <h1 className="font-semibold text-base">SAM3 Explorer</h1>
          </div>
          <p className="text-xs text-blue-100 mt-1">
            AI-powered feature detection on satellite imagery
          </p>
        </div>

        {/* Controls */}
        <div className="p-4">
          <SAM3Controls
            bbox={bbox}
            isProcessing={isProcessing}
            status={statusMessage}
            progress={progress}
            onSubmit={handleSubmit}
            onClear={handleClear}
          />
        </div>

        {/* Draw mode indicator */}
        {isDrawing && !bbox && (
          <div className="px-4 pb-3">
            <div className="text-xs text-center text-[#004aad] bg-blue-50 rounded-lg py-2 font-medium">
              Click two points on the map to draw a bounding box
            </div>
          </div>
        )}

        {/* Re-draw button */}
        {bbox && !isProcessing && (
          <div className="px-4 pb-3">
            <button
              onClick={() => {
                setBbox(null);
                setIsDrawing(true);
                setGeojsonResult(null);
                setError(null);
              }}
              className="w-full text-xs text-center text-[#004aad] hover:underline"
            >
              Click to redraw bounding box
            </button>
          </div>
        )}

        {/* Results */}
        {(geojsonResult || error) && (
          <div className="px-4 pb-4 border-t border-gray-100 pt-3">
            <SAM3Results
              geojson={geojsonResult}
              featureCount={featureCount}
              elapsedSeconds={elapsedSeconds}
              error={error}
            />
          </div>
        )}
      </div>
    </div>
  );
}
