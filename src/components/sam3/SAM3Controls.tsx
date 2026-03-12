"use client";

import { useState } from "react";
import { Play, RotateCcw, Loader2 } from "lucide-react";

const PRESETS = [
  "football fields",
  "soccer fields",
  "baseball diamonds",
  "tennis courts",
];

interface SAM3ControlsProps {
  bbox: [number, number, number, number] | null;
  isProcessing: boolean;
  status: string | null;
  progress: number;
  onSubmit: (prompt: string) => void;
  onClear: () => void;
}

export default function SAM3Controls({
  bbox,
  isProcessing,
  status,
  progress,
  onSubmit,
  onClear,
}: SAM3ControlsProps) {
  const [prompt, setPrompt] = useState("football fields");

  const canSubmit = bbox !== null && prompt.trim().length > 0 && !isProcessing;

  return (
    <div className="space-y-4">
      {/* Text prompt */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Text Prompt
        </label>
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g. football fields"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-black placeholder:text-black focus:outline-none focus:ring-2 focus:ring-[#004aad] focus:border-transparent"
          disabled={isProcessing}
        />
      </div>

      {/* Preset buttons */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Presets
        </label>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => setPrompt(p)}
              disabled={isProcessing}
              className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                prompt === p
                  ? "bg-[#004aad] text-white border-[#004aad]"
                  : "bg-white text-gray-600 border-gray-300 hover:border-[#004aad] hover:text-[#004aad]"
              } disabled:opacity-50`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Bbox display */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Bounding Box
        </label>
        {bbox ? (
          <div className="text-xs text-gray-600 bg-gray-50 rounded-lg p-2 font-mono">
            <div>W: {bbox[0].toFixed(5)}</div>
            <div>S: {bbox[1].toFixed(5)}</div>
            <div>E: {bbox[2].toFixed(5)}</div>
            <div>N: {bbox[3].toFixed(5)}</div>
          </div>
        ) : (
          <p className="text-xs text-gray-400 italic">
            Click two corners on the map to draw a bounding box
          </p>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => onSubmit(prompt)}
          disabled={!canSubmit}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#004aad] text-white rounded-lg text-sm font-medium hover:bg-[#003d91] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isProcessing ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Play size={16} />
          )}
          {isProcessing ? "Processing..." : "Run Segmentation"}
        </button>
        <button
          onClick={onClear}
          className="px-3 py-2.5 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition-colors"
          title="Reset"
        >
          <RotateCcw size={16} />
        </button>
      </div>

      {/* Status indicator */}
      {isProcessing && status && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-gray-600">
            <span>{status}</span>
            <span>{Math.round(progress * 100)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div
              className="bg-[#004aad] h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
