import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { GeneratedEmail, ActivitySummary } from "@/types/email-generation";
import { CloseActivity, CloseContact } from "@/types/close";

const STATUS_STEPS = [
  "Syncing activities...",
  "Analyzing history...",
  "Generating email...",
  "Almost done...",
];

export function useGenerateEmail() {
  const queryClient = useQueryClient();
  const [generationStatus, setGenerationStatus] = useState("idle");
  const timerRef = useRef<NodeJS.Timeout[]>([]);

  const clearTimers = () => {
    timerRef.current.forEach(clearTimeout);
    timerRef.current = [];
  };

  useEffect(() => () => clearTimers(), []);

  const mutation = useMutation({
    mutationFn: async (params: {
      leadId: string;
      leadName: string;
      leadDescription?: string;
      contacts?: CloseContact[];
      activities: CloseActivity[];
    }): Promise<GeneratedEmail> => {
      const contact = params.contacts?.[0];
      const contactName = contact?.name;
      const contactEmail = contact?.emails?.[0]?.email;
      const contactTitle = contact?.title;

      // Transform CloseActivity[] → ActivitySummary[]
      const activities: ActivitySummary[] = params.activities
        .filter((a) => ["call", "email", "note"].includes(a.type))
        .map((a): ActivitySummary => {
          const base: ActivitySummary = {
            id: a.id,
            type: a.type as "call" | "email" | "note",
            date: a.date_created,
            userName: a.user_name,
          };

          if (a.type === "call" && a.call) {
            base.direction = a.call.direction;
            base.duration = a.call.duration;
            base.disposition = a.call.disposition;
            base.callSummary = a.call.recording_transcript?.summary_text;
            base.voicemailTranscript = a.call.voicemail_transcript?.utterances
              ?.map((u) => `${u.speaker_side}: ${u.text}`)
              .join("\n");

            if (a.call.recording_transcript?.utterances) {
              base.transcript = a.call.recording_transcript.utterances
                .map((u) => `${u.speaker_side}: ${u.text}`)
                .join("\n");
            }
          } else if (a.type === "email" && a.email) {
            base.direction = a.email.direction;
            base.subject =
              a.email.latest_normalized_subject || a.email.subject;
            base.body = a.email.preview || a.email.snippet;
          } else if (a.type === "note" && a.note) {
            base.note = a.note.note;
          }

          return base;
        });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4 * 60 * 1000);

      try {
        const res = await fetch("/api/generate-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            leadId: params.leadId,
            leadName: params.leadName,
            leadDescription: params.leadDescription,
            contactName,
            contactEmail,
            contactTitle,
            activities,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Failed to generate email");
        }

        const json = await res.json();
        return json.data;
      } catch (err: any) {
        clearTimeout(timeoutId);
        if (err.name === "AbortError") {
          throw new Error("Email generation timed out. Please try again.");
        }
        throw err;
      }
    },
    onMutate: () => {
      clearTimers();
      setGenerationStatus(STATUS_STEPS[0]);
      STATUS_STEPS.slice(1).forEach((step, i) => {
        timerRef.current.push(setTimeout(() => setGenerationStatus(step), (i + 1) * 2500));
      });
    },
    onSuccess: (_data, variables) => {
      clearTimers();
      setGenerationStatus("idle");
      queryClient.invalidateQueries({ queryKey: ["generated-emails", variables.leadId] });
    },
    onError: () => {
      clearTimers();
      setGenerationStatus("idle");
    },
  });

  return { ...mutation, generationStatus };
}
