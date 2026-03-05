"use client";

import { useState } from "react";
import { Copy, Check, ChevronDown, ChevronUp, AlertCircle, ThumbsUp, Lightbulb, ThumbsDown } from "lucide-react";
import { GeneratedEmail, EmailBreakdown } from "@/types/email-generation";
import { useEmailFeedback } from "@/hooks/useEmailFeedback";

const TYPE_BADGES: Record<string, { label: string; className: string }> = {
  intro: { label: "Intro", className: "bg-emerald-100 text-emerald-700" },
  follow_up: { label: "Follow-up", className: "bg-amber-100 text-amber-700" },
  reply: { label: "Reply", className: "bg-blue-100 text-blue-700" },
};

interface Props {
  email: GeneratedEmail;
  contactEmail?: string;
  contactName?: string;
  isOutdated?: boolean;
  closeLeadId: string;
}

function BreakdownRenderer({ breakdown }: { breakdown: EmailBreakdown }) {
  return (
    <div className="space-y-5 mt-2">
      {breakdown.referencedActivities?.length > 0 && (
        <div className="bg-blue-50/60 border-l-3 border-blue-400 rounded-r-lg p-3">
          <p className="text-sm font-semibold text-blue-700 mb-2">Referenced Activities</p>
          <div className="space-y-2">
            {breakdown.referencedActivities.map((a, i) => (
              <div key={i} className="text-sm flex gap-2">
                <span className="shrink-0 font-medium text-blue-900">
                  [{a.date}] {a.type}{a.direction ? ` (${a.direction})` : ""}
                </span>
                <span className="text-gray-400">—</span>
                <span className="text-gray-700">{a.influence}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {breakdown.keyQuotes?.length > 0 && (
        <div className="bg-purple-50/60 border-l-3 border-purple-400 rounded-r-lg p-3">
          <p className="text-sm font-semibold text-purple-700 mb-2">Key Quotes</p>
          <div className="space-y-3">
            {breakdown.keyQuotes.map((q, i) => (
              <div key={i}>
                <blockquote className="border-l-3 border-purple-300 pl-3 text-sm text-gray-700 italic">
                  &ldquo;{q.quote}&rdquo;
                </blockquote>
                <p className="text-xs text-gray-500 mt-1 pl-3">
                  <span className="font-medium">Source:</span> {q.source}
                  {q.usage && <> &middot; <span className="font-medium">Used for:</span> {q.usage}</>}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {breakdown.talkingPointRationale?.length > 0 && (
        <div className="bg-amber-50/60 border-l-3 border-amber-400 rounded-r-lg p-3">
          <p className="text-sm font-semibold text-amber-700 mb-2">Talking Points</p>
          <div className="space-y-2">
            {breakdown.talkingPointRationale.map((tp, i) => (
              <div key={i} className="text-sm">
                <span className="font-semibold text-gray-800">{tp.point}</span>
                <span className="text-gray-600"> — {tp.why}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {breakdown.toneJustification && (
        <div className="bg-green-50/60 border-l-3 border-green-400 rounded-r-lg p-3">
          <p className="text-sm font-semibold text-green-700 mb-1.5">Tone</p>
          <p className="text-sm text-gray-700">{breakdown.toneJustification}</p>
        </div>
      )}
    </div>
  );
}

const RATING_OPTIONS = [
  { value: "used" as const, label: "Used it", icon: ThumbsUp, activeClass: "bg-emerald-100 text-emerald-700 border-emerald-300", hoverClass: "hover:bg-emerald-50" },
  { value: "helpful" as const, label: "Helpful", icon: Lightbulb, activeClass: "bg-blue-100 text-blue-700 border-blue-300", hoverClass: "hover:bg-blue-50" },
  { value: "bad" as const, label: "Not useful", icon: ThumbsDown, activeClass: "bg-red-100 text-red-700 border-red-300", hoverClass: "hover:bg-red-50" },
];

export function GeneratedEmailDisplay({ email, contactEmail, contactName, isOutdated, closeLeadId }: Props) {
  const [copied, setCopied] = useState(false);
  const [showReasoning, setShowReasoning] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState<"used" | "helpful" | "bad" | null>(email.feedback_rating ?? null);
  const [feedbackNote, setFeedbackNote] = useState(email.feedback_note ?? "");
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const feedbackMutation = useEmailFeedback();
  const hasSavedFeedback = !!email.feedback_rating;
  const badge = TYPE_BADGES[email.email_type] || TYPE_BADGES.intro;
  const hasBreakdown = !!email.generation_context;

  const handleCopy = async () => {
    const text = `Subject: ${email.subject}\n\n${email.body_text}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
      {isOutdated && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700">
            New activities have occurred since this email was generated. Consider regenerating.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
          Generated Email
        </h3>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badge.className}`}>
          {badge.label}
        </span>
      </div>

      {(contactName || contactEmail) && (
        <div className="text-sm text-gray-600">
          <span className="font-medium text-gray-500">To: </span>
          {contactName && <span>{contactName}</span>}
          {contactName && contactEmail && <span> &lt;</span>}
          {contactEmail && <span className="text-blue-600">{contactEmail}</span>}
          {contactName && contactEmail && <span>&gt;</span>}
        </div>
      )}

      <div>
        <p className="text-xs font-medium text-gray-500 mb-1">Subject</p>
        <p className="text-sm font-semibold text-gray-900">{email.subject}</p>
      </div>

      <div>
        <p className="text-xs font-medium text-gray-500 mb-1">Body</p>
        <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed bg-gray-50 rounded-lg p-4 border border-gray-100">
          {email.body_text}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-green-600" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              Copy to Clipboard
            </>
          )}
        </button>
      </div>

      {/* Feedback Section */}
      <div className="border-t border-gray-100 pt-3">
        {hasSavedFeedback && !isEditing ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Feedback:</span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              RATING_OPTIONS.find((r) => r.value === email.feedback_rating)?.activeClass
            }`}>
              {RATING_OPTIONS.find((r) => r.value === email.feedback_rating)?.label}
            </span>
            {email.feedback_note && (
              <span className="text-xs text-gray-500 italic truncate max-w-[200px]">&ldquo;{email.feedback_note}&rdquo;</span>
            )}
            <button
              onClick={() => setIsEditing(true)}
              className="text-xs text-gray-400 hover:text-gray-600 ml-auto cursor-pointer"
            >
              Edit
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-500">How was this email?</p>
            <div className="flex gap-2">
              {RATING_OPTIONS.map((option) => {
                const Icon = option.icon;
                const isSelected = feedbackRating === option.value;
                return (
                  <button
                    key={option.value}
                    onClick={() => {
                      setFeedbackRating(isSelected ? null : option.value);
                      if (!isSelected) setShowNoteInput(true);
                    }}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                      isSelected
                        ? option.activeClass
                        : `text-gray-600 border-gray-200 ${option.hoverClass}`
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {option.label}
                  </button>
                );
              })}
            </div>
            {showNoteInput && feedbackRating && (
              <div className="space-y-2">
                <textarea
                  value={feedbackNote}
                  onChange={(e) => setFeedbackNote(e.target.value)}
                  placeholder="Add a note (optional)"
                  rows={2}
                  className="w-full text-xs border border-gray-200 rounded-lg p-2 resize-none focus:outline-none focus:ring-1 focus:ring-blue-300"
                />
                <button
                  onClick={() => {
                    feedbackMutation.mutate(
                      { emailId: email.id, closeLeadId, rating: feedbackRating, note: feedbackNote || undefined },
                      { onSuccess: () => setIsEditing(false) }
                    );
                  }}
                  disabled={feedbackMutation.isPending}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                >
                  {feedbackMutation.isPending ? "Saving..." : "Save Feedback"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {(email.reasoning || hasBreakdown) && (
        <div className="border-t border-gray-100 pt-3">
          <button
            onClick={() => setShowReasoning(!showReasoning)}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors cursor-pointer"
          >
            {showReasoning ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
            {hasBreakdown ? "AI Breakdown" : "AI Reasoning"}
          </button>
          {showReasoning && (
            <div className="mt-2">
              {email.reasoning && (
                <p className="text-sm text-gray-600 leading-relaxed mb-2">
                  {email.reasoning}
                </p>
              )}
              {hasBreakdown && (
                <BreakdownRenderer breakdown={email.generation_context!} />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
