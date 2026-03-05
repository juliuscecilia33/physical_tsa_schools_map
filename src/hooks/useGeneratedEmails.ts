import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { GeneratedEmail } from "@/types/email-generation";

export function useGeneratedEmails(closeLeadId: string | null) {
  const supabase = createClient();

  return useQuery<GeneratedEmail[], Error>({
    queryKey: ["generated-emails", closeLeadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("generated_emails")
        .select("*")
        .eq("close_lead_id", closeLeadId!)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as GeneratedEmail[];
    },
    enabled: !!closeLeadId,
    staleTime: 1000 * 60 * 5,
  });
}
