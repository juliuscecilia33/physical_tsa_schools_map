"use client";

import { useState } from "react";
import { Play, RotateCcw, Loader2, ChevronDown, ChevronUp, Settings } from "lucide-react";

const PRESETS = [
  "football fields",
  "soccer fields",
  "baseball diamonds",
  "tennis courts",
];

const PRESET_MIN_AREAS: Record<string, number> = {
  "football fields": 200,
  "soccer fields": 300,
  "baseball diamonds": 300,
  "tennis courts": 80,
};

const PRESET_THRESHOLDS: Record<string, { box: number; text: number }> = {
  "football fields": { box: 0.20, text: 0.20 },
  "soccer fields": { box: 0.25, text: 0.25 },
  "baseball diamonds": { box: 0.30, text: 0.30 },
  "tennis courts": { box: 0.30, text: 0.30 },
};

const DEFAULT_MIN_AREA = 50;

export interface SegmentParams {
  prompt: string;
  boxThreshold: number;
  textThreshold: number;
  minAreaSqm: number;
  shapeFilter: boolean;
}

interface SAM3ControlsProps {
  bbox: [number, number, number, number] | null;
  isProcessing: boolean;
  status: string | null;
  progress: number;
  onSubmit: (params: SegmentParams) => void;
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
  const [boxThreshold, setBoxThreshold] = useState(PRESET_THRESHOLDS["football fields"].box);
  const [textThreshold, setTextThreshold] = useState(PRESET_THRESHOLDS["football fields"].text);
  const [minAreaSqm, setMinAreaSqm] = useState(PRESET_MIN_AREAS["football fields"]);
  const [shapeFilter, setShapeFilter] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const canSubmit = bbox !== null && prompt.trim().length > 0 && !isProcessing;

  const handlePresetClick = (preset: string) => {
    setPrompt(preset);
    setMinAreaSqm(PRESET_MIN_AREAS[preset] ?? DEFAULT_MIN_AREA);
    const thresholds = PRESET_THRESHOLDS[preset];
    if (thresholds) {
      setBoxThreshold(thresholds.box);
      setTextThreshold(thresholds.text);
    }
  };

  const handlePromptChange = (value: string) => {
    setPrompt(value);
    // If typing a custom prompt, set conservative default
    if (!PRESETS.includes(value)) {
      setMinAreaSqm(DEFAULT_MIN_AREA);
    }
  };

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
          onChange={(e) => handlePromptChange(e.target.value)}
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
              onClick={() => handlePresetClick(p)}
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

      {/* Advanced Settings */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors text-xs font-medium text-gray-600"
        >
          <span className="flex items-center gap-1.5">
            <Settings size={12} />
            Advanced Settings
          </span>
          {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        {showAdvanced && (
          <div className="px-3 py-3 space-y-3 bg-white">
            {/* Box Threshold */}
            <div>
              <div className="flex justify-between text-xs text-gray-600 mb-1">
                <span>Box Threshold</span>
                <span className="font-mono">{boxThreshold.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0.1}
                max={0.9}
                step={0.05}
                value={boxThreshold}
                onChange={(e) => setBoxThreshold(parseFloat(e.target.value))}
                disabled={isProcessing}
                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#004aad]"
              />
            </div>

            {/* Text Threshold */}
            <div>
              <div className="flex justify-between text-xs text-gray-600 mb-1">
                <span>Text Threshold</span>
                <span className="font-mono">{textThreshold.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0.1}
                max={0.9}
                step={0.05}
                value={textThreshold}
                onChange={(e) => setTextThreshold(parseFloat(e.target.value))}
                disabled={isProcessing}
                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#004aad]"
              />
            </div>

            {/* Min Area */}
            <div>
              <div className="flex justify-between text-xs text-gray-600 mb-1">
                <span>Min Area (m²)</span>
              </div>
              <input
                type="number"
                min={0}
                value={minAreaSqm}
                onChange={(e) => setMinAreaSqm(Math.max(0, parseFloat(e.target.value) || 0))}
                disabled={isProcessing}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-xs text-black font-mono focus:outline-none focus:ring-1 focus:ring-[#004aad]"
              />
            </div>

            {/* Shape Filter Toggle */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-600">Shape Filter (reject non-rectangular blobs)</span>
              <button
                onClick={() => setShapeFilter(!shapeFilter)}
                disabled={isProcessing}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  shapeFilter ? "bg-[#004aad]" : "bg-gray-300"
                } disabled:opacity-50`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                    shapeFilter ? "translate-x-4" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>
          </div>
        )}
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
          onClick={() => onSubmit({ prompt, boxThreshold, textThreshold, minAreaSqm, shapeFilter })}
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
