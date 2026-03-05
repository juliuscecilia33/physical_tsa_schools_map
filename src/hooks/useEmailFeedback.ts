import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

interface FeedbackParams {
  emailId: string;
  closeLeadId: string;
  rating: "used" | "helpful" | "bad";
  note?: string;
}

export function useEmailFeedback() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ emailId, rating, note }: FeedbackParams) => {
      const { error } = await supabase
        .from("generated_emails")
        .update({
          feedback_rating: rating,
          feedback_note: note || null,
          feedback_at: new Date().toISOString(),
        })
        .eq("id", emailId);

      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["generated-emails", variables.closeLeadId],
      });
    },
  });
}
