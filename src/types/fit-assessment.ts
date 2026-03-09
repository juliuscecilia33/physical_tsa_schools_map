import { ActivitySummary } from "@/types/email-generation";

export type { ActivitySummary };

export type FitVerdict = "strong_fit" | "moderate_fit" | "weak_fit" | "poor_fit";

export interface DimensionAnalysis {
  score: number;
  weight: number;
  label: string;
  summary: string;
  strengths: string[];
  concerns: string[];
  quotes: string[];
}

export interface FitScoreBreakdown {
  availability: DimensionAnalysis;
  review_signals: DimensionAnalysis;
  facility_quality: DimensionAnalysis;
  engagement: DimensionAnalysis;
  lease_fit: DimensionAnalysis;
}

export interface FitAssessment {
  id: string;
  close_lead_id: string;
  place_id: string | null;
  facility_name: string | null;
  overall_score: number;
  availability_score: number;
  review_signals_score: number;
  facility_quality_score: number;
  engagement_score: number;
  lease_fit_score: number;
  verdict: FitVerdict;
  summary: string;
  reasoning: FitScoreBreakdown | null;
  had_facility_data: boolean;
  had_reviews: boolean;
  had_opening_hours: boolean;
  activity_count: number;
  notes: string | null;
  created_at: string;
}

export interface AssessFitRequest {
  leadId: string;
  leadName: string;
  leadDescription?: string;
  activities: ActivitySummary[];
}
