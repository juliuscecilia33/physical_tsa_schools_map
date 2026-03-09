import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

interface UpdateNotesParams {
  assessmentId: string;
  closeLeadId: string;
  notes: string;
}

export function useUpdateFitAssessmentNotes() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ assessmentId, notes }: UpdateNotesParams) => {
      const trimmed = notes.trim();
      const { error } = await supabase
        .from("fit_assessments")
        .update({ notes: trimmed || null })
        .eq("id", assessmentId);

      if (error) throw error;
    },
    onSuccess: (_, { closeLeadId }) => {
      queryClient.invalidateQueries({ queryKey: ["fit-assessments", closeLeadId] });
    },
  });
}
