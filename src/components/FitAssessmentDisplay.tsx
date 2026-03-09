"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, ChevronUp, AlertCircle, Database, Clock, MessageSquare, Pencil } from "lucide-react";
import { FitAssessment, FitScoreBreakdown, DimensionAnalysis, FitVerdict } from "@/types/fit-assessment";
import { OpeningHours } from "@/types/facility";
import { useUpdateFitAssessmentNotes } from "@/hooks/useUpdateFitAssessmentNotes";

const VERDICT_CONFIG: Record<FitVerdict, { label: string; className: string }> = {
  strong_fit: { label: "Strong Fit", className: "bg-emerald-100 text-emerald-700 border-emerald-300" },
  moderate_fit: { label: "Moderate Fit", className: "bg-amber-100 text-amber-700 border-amber-300" },
  weak_fit: { label: "Weak Fit", className: "bg-orange-100 text-orange-700 border-orange-300" },
  poor_fit: { label: "Poor Fit", className: "bg-red-100 text-red-700 border-red-300" },
};

function getScoreColor(score: number): string {
  if (score >= 75) return "text-emerald-600";
  if (score >= 55) return "text-amber-600";
  if (score >= 35) return "text-orange-600";
  return "text-red-600";
}

function getScoreBarColor(score: number): string {
  if (score >= 75) return "bg-emerald-500";
  if (score >= 55) return "bg-amber-500";
  if (score >= 35) return "bg-orange-500";
  return "bg-red-500";
}

function getScoreBgColor(score: number): string {
  if (score >= 75) return "bg-emerald-50 border-emerald-200";
  if (score >= 55) return "bg-amber-50 border-amber-200";
  if (score >= 35) return "bg-orange-50 border-orange-200";
  return "bg-red-50 border-red-200";
}

const DIMENSION_ORDER: Array<{ key: keyof FitScoreBreakdown; scoreKey: string; weight: string }> = [
  { key: "availability", scoreKey: "availability_score", weight: "25%" },
  { key: "review_signals", scoreKey: "review_signals_score", weight: "20%" },
  { key: "facility_quality", scoreKey: "facility_quality_score", weight: "15%" },
  { key: "engagement", scoreKey: "engagement_score", weight: "20%" },
  { key: "lease_fit", scoreKey: "lease_fit_score", weight: "20%" },
];

function DimensionBar({
  dimension,
  score,
  weight,
  openingHours,
}: {
  dimension: DimensionAnalysis | undefined;
  score: number;
  weight: string;
  openingHours?: OpeningHours;
}) {
  const [expanded, setExpanded] = useState(false);
  const label = dimension?.label || "Unknown";

  return (
    <div className="space-y-1">
      <button
        onClick={() => dimension && setExpanded(!expanded)}
        className="w-full text-left cursor-pointer"
      >
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-gray-700">
            {label}
            <span className="text-gray-400 font-normal ml-1">({weight})</span>
          </span>
          <div className="flex items-center gap-1.5">
            <span className={`font-bold ${getScoreColor(score)}`}>{score}</span>
            {dimension && (
              expanded ? (
                <ChevronUp className="w-3 h-3 text-gray-400" />
              ) : (
                <ChevronDown className="w-3 h-3 text-gray-400" />
              )
            )}
          </div>
        </div>
        <div className="mt-1 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${getScoreBarColor(score)}`}
            style={{ width: `${score}%` }}
          />
        </div>
      </button>

      {expanded && dimension && (
        <div className="mt-2 pl-2 border-l-2 border-gray-200 space-y-2 text-xs">
          <p className="text-gray-600">{dimension.summary}</p>

          {dimension.strengths.length > 0 && (
            <div>
              <p className="font-semibold text-emerald-700 mb-0.5">Strengths</p>
              <ul className="space-y-0.5">
                {dimension.strengths.map((s, i) => (
                  <li key={i} className="text-gray-600 flex gap-1.5">
                    <span className="text-emerald-500 shrink-0">+</span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {dimension.concerns.length > 0 && (
            <div>
              <p className="font-semibold text-orange-700 mb-0.5">Concerns</p>
              <ul className="space-y-0.5">
                {dimension.concerns.map((c, i) => (
                  <li key={i} className="text-gray-600 flex gap-1.5">
                    <span className="text-orange-500 shrink-0">-</span>
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {dimension.quotes.length > 0 && (
            <div>
              <p className="font-semibold text-purple-700 mb-0.5">Key Quotes</p>
              {dimension.quotes.map((q, i) => (
                <blockquote
                  key={i}
                  className="border-l-2 border-purple-300 pl-2 text-gray-600 italic"
                >
                  &ldquo;{q}&rdquo;
                </blockquote>
              ))}
            </div>
          )}

          {openingHours && (
            <div className="bg-gray-50 rounded-md p-2 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3 h-3 text-gray-500" />
                <p className="font-semibold text-gray-700">Facility Hours</p>
                {openingHours.open_now !== undefined && (
                  <span className={`ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                    openingHours.open_now
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-red-100 text-red-700"
                  }`}>
                    {openingHours.open_now ? "Open Now" : "Closed"}
                  </span>
                )}
              </div>
              {openingHours.weekday_text && (
                <ul className="space-y-0.5">
                  {openingHours.weekday_text.map((line, i) => (
                    <li key={i} className="text-gray-500">{line}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface Props {
  assessment: FitAssessment;
  openingHours?: OpeningHours;
}

export function FitAssessmentDisplay({ assessment, openingHours }: Props) {
  const verdict = VERDICT_CONFIG[assessment.verdict] || VERDICT_CONFIG.poor_fit;
  const reasoning = assessment.reasoning as FitScoreBreakdown | null;

  const [isEditing, setIsEditing] = useState(false);
  const [notesDraft, setNotesDraft] = useState(assessment.notes ?? "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const updateNotes = useUpdateFitAssessmentNotes();

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isEditing]);

  const handleSave = () => {
    updateNotes.mutate(
      {
        assessmentId: assessment.id,
        closeLeadId: assessment.close_lead_id,
        notes: notesDraft,
      },
      {
        onSuccess: () => setIsEditing(false),
      }
    );
  };

  const handleCancel = () => {
    setNotesDraft(assessment.notes ?? "");
    setIsEditing(false);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
          Fit Assessment
        </h3>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${verdict.className}`}>
          {verdict.label}
        </span>
      </div>

      {/* Overall Score */}
      <div className={`flex items-center gap-4 p-4 rounded-lg border ${getScoreBgColor(assessment.overall_score)}`}>
        <div className={`text-4xl font-black ${getScoreColor(assessment.overall_score)}`}>
          {assessment.overall_score}
        </div>
        <div className="flex-1">
          <p className="text-xs font-medium text-gray-500 mb-0.5">Overall Fit Score</p>
          <p className="text-sm text-gray-700">{assessment.summary}</p>
        </div>
      </div>

      {/* Facility Info */}
      {assessment.facility_name && (
        <div className="text-sm text-gray-600">
          <span className="font-medium text-gray-500">Facility: </span>
          {assessment.facility_name}
        </div>
      )}

      {/* Data Availability Indicators */}
      <div className="flex flex-wrap gap-2">
        {!assessment.had_facility_data && (
          <div className="flex items-center gap-1 text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded-full">
            <AlertCircle className="w-3 h-3" />
            No linked facility
          </div>
        )}
        {assessment.had_facility_data && (
          <div className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
            <Database className="w-3 h-3" />
            Facility data
          </div>
        )}
        {assessment.had_reviews && (
          <div className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
            <MessageSquare className="w-3 h-3" />
            Reviews analyzed
          </div>
        )}
        {assessment.had_opening_hours && (
          <div className="flex items-center gap-1 text-xs text-purple-600 bg-purple-50 px-2 py-1 rounded-full">
            <Clock className="w-3 h-3" />
            Hours available
          </div>
        )}
        <div className="flex items-center gap-1 text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded-full">
          {assessment.activity_count} activities
        </div>
      </div>

      {/* Dimension Scores */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Dimension Scores
        </h4>
        {DIMENSION_ORDER.map(({ key, weight }) => (
          <DimensionBar
            key={key}
            dimension={reasoning?.[key]}
            score={assessment[`${key}_score` as keyof FitAssessment] as number}
            weight={weight}
            openingHours={key === "availability" ? openingHours : undefined}
          />
        ))}
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Notes</h4>
        {isEditing ? (
          <div className="space-y-2">
            <textarea
              ref={textareaRef}
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              disabled={updateNotes.isPending}
              placeholder="Add your notes..."
              className="w-full text-sm text-gray-700 border border-gray-300 rounded-md p-2 resize-y min-h-[80px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
            />
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={updateNotes.isPending}
                className="text-xs font-medium px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {updateNotes.isPending ? "Saving..." : "Save"}
              </button>
              <button
                onClick={handleCancel}
                disabled={updateNotes.isPending}
                className="text-xs font-medium px-3 py-1.5 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : assessment.notes ? (
          <div className="group relative bg-gray-50 border border-gray-200 rounded-md p-3">
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{assessment.notes}</p>
            <button
              onClick={() => { setNotesDraft(assessment.notes ?? ""); setIsEditing(true); }}
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-gray-200"
            >
              <Pencil className="w-3 h-3 text-gray-500" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => { setNotesDraft(""); setIsEditing(true); }}
            className="text-xs text-gray-400 hover:text-gray-600 font-medium"
          >
            + Add notes
          </button>
        )}
      </div>

      {/* Timestamp */}
      <div className="text-[10px] text-gray-400 pt-2 border-t border-gray-100">
        Generated {new Date(assessment.created_at).toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })}
      </div>
    </div>
  );
}
