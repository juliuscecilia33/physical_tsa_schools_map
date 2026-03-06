import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

interface ManualEditParams {
  emailId: string;
  closeLeadId: string;
  subject: string;
  body_text: string;
}

export function useManualEmailEdit() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ emailId, subject, body_text }: ManualEditParams) => {
      const { error } = await supabase
        .from("generated_emails")
        .update({
          subject,
          body_text,
          manually_edited_at: new Date().toISOString(),
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
