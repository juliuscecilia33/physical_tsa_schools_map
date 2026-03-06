import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { FitAssessment } from "@/types/fit-assessment";

export function useFitAssessments(closeLeadId: string | null) {
  const supabase = createClient();

  return useQuery<FitAssessment[], Error>({
    queryKey: ["fit-assessments", closeLeadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fit_assessments")
        .select("*")
        .eq("close_lead_id", closeLeadId!)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as FitAssessment[];
    },
    enabled: !!closeLeadId,
    staleTime: 1000 * 60 * 5,
  });
}
