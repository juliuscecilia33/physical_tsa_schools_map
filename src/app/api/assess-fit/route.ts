import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AssessFitRequest } from "@/types/fit-assessment";

export const maxDuration = 300;

const SYSTEM_PROMPT = `You are a facility lease analyst evaluating whether a sports facility is a good fit
for a recurring off-peak anchor tenant deal. The tenant is a youth academic-sports program
(structured like a school, 501(c)(3) nonprofit) that needs weekday access 10:00 AM – 2:00 PM,
Monday through Friday, for approximately 36 weeks (the school year).

Score 5 dimensions (each 0-100):

1. **Availability** (weight: 25%): Are the requested hours (10AM-2PM Mon-Fri) within the facility's
   operating hours? Do they open early enough? Are weekday daytime slots likely available?
   If no hours data: score 50 (neutral).

2. **Review Signals** (weight: 20%): Do reviews mention rentals, private bookings, events, league play,
   downtime, empty courts/fields, flexibility, or management willingness to work with organizations?
   If no reviews: score 50 (neutral).

3. **Facility Quality** (weight: 15%): Overall rating, mentions of cleanliness, maintenance, safety,
   parking, and any red flags (closures, poor condition, safety concerns).
   If no facility data: score 50 (neutral).

4. **Engagement** (weight: 20%): Quality of lead activities — responses to outreach, pricing discussions,
   scheduling conversations, expressed interest, objections raised, decision-maker access.
   Score based on activity signals regardless of facility data.

5. **Lease Fit** (weight: 20%): Holistic assessment — does this facility do rentals? Is it the right
   size/type for a youth sports program? Is management style compatible? Are there signs of
   commercial rental operations?

Calculate overall_score as weighted average: availability*0.25 + review_signals*0.20 +
facility_quality*0.15 + engagement*0.20 + lease_fit*0.20

Verdict thresholds:
- >= 75: "strong_fit"
- >= 55: "moderate_fit"
- >= 35: "weak_fit"
- < 35: "poor_fit"

Respond in this exact JSON format:
{
  "overall_score": 72,
  "availability_score": 80,
  "review_signals_score": 65,
  "facility_quality_score": 70,
  "engagement_score": 75,
  "lease_fit_score": 68,
  "verdict": "moderate_fit",
  "summary": "2-3 sentence executive summary of the fit assessment",
  "reasoning": {
    "availability": {
      "score": 80,
      "weight": 0.25,
      "label": "Availability",
      "summary": "Brief explanation of score",
      "strengths": ["Strength 1", "Strength 2"],
      "concerns": ["Concern 1"],
      "quotes": ["Relevant quote from reviews or activities"]
    },
    "review_signals": { "score": 65, "weight": 0.20, "label": "Review Signals", "summary": "...", "strengths": [], "concerns": [], "quotes": [] },
    "facility_quality": { "score": 70, "weight": 0.15, "label": "Facility Quality", "summary": "...", "strengths": [], "concerns": [], "quotes": [] },
    "engagement": { "score": 75, "weight": 0.20, "label": "Engagement", "summary": "...", "strengths": [], "concerns": [], "quotes": [] },
    "lease_fit": { "score": 68, "weight": 0.20, "label": "Lease Fit", "summary": "...", "strengths": [], "concerns": [], "quotes": [] }
  }
}`;

function truncateWords(text: string, maxWords: number): string {
  const words = text.split(/\s+/);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(" ") + "...";
}

function buildUserMessage(
  req: AssessFitRequest,
  facility: {
    name: string;
    address: string;
    rating?: number;
    user_ratings_total?: number;
    identified_sports?: string[];
    opening_hours?: { weekday_text?: string[] };
    additional_reviews?: Array<{
      rating: number;
      text?: string;
      snippet?: string;
      author_name?: string;
      user?: { name: string };
    }>;
    reviews?: Array<{
      rating: number;
      text?: string;
      snippet?: string;
      author_name?: string;
    }>;
  } | null,
  dbActivities: Array<{
    activity_type: string;
    date_created: string;
    direction?: string;
    user_name?: string;
    subject?: string;
    body_text?: string;
    call_duration?: number;
    call_disposition?: string;
    call_summary?: string;
    call_transcript?: string;
    voicemail_transcript?: string;
    note_text?: string;
  }>
): string {
  let message = `LEAD INFORMATION:\n`;
  message += `Name: ${req.leadName}\n`;
  if (req.leadDescription) message += `Description: ${req.leadDescription}\n`;

  if (facility) {
    message += `\n--- FACILITY DETAILS ---\n`;
    message += `Name: ${facility.name}\n`;
    message += `Address: ${facility.address}\n`;
    if (facility.rating) message += `Rating: ${facility.rating}/5 (${facility.user_ratings_total || 0} reviews)\n`;
    if (facility.identified_sports?.length) message += `Sports: ${facility.identified_sports.join(", ")}\n`;

    if (facility.opening_hours?.weekday_text?.length) {
      message += `\nOperating Hours:\n`;
      for (const line of facility.opening_hours.weekday_text) {
        message += `  ${line}\n`;
      }
    }

    // Combine reviews from both sources
    const allReviews = [
      ...(facility.additional_reviews || []).map((r) => ({
        rating: r.rating,
        text: r.text || r.snippet || "",
        author: r.user?.name || r.author_name || "Anonymous",
      })),
      ...(facility.reviews || []).map((r) => ({
        rating: r.rating,
        text: r.text || r.snippet || "",
        author: r.author_name || "Anonymous",
      })),
    ];

    // Deduplicate by text similarity (take first 30)
    const seen = new Set<string>();
    const uniqueReviews = allReviews.filter((r) => {
      const key = r.text.slice(0, 80).toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 30);

    if (uniqueReviews.length > 0) {
      message += `\n--- FACILITY REVIEWS (${uniqueReviews.length} reviews) ---\n\n`;
      for (const r of uniqueReviews) {
        message += `[${r.rating}/5] ${r.author}: ${truncateWords(r.text, 200)}\n\n`;
      }
    }
  } else {
    message += `\n--- NO LINKED FACILITY ---\nNo facility data available. Score availability, review signals, and facility quality at 50 (neutral).\n`;
  }

  message += `\n--- ACTIVITY HISTORY (chronological) ---\n\n`;

  for (const a of dbActivities) {
    const date = new Date(a.date_created).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const dir = a.direction ? ` (${a.direction})` : "";
    const user = a.user_name ? ` by ${a.user_name}` : "";

    message += `[${date}] ${a.activity_type.toUpperCase()}${dir}${user}\n`;

    if (a.activity_type === "call") {
      if (a.call_disposition) message += `Disposition: ${a.call_disposition}\n`;
      if (a.call_duration) message += `Duration: ${Math.round(a.call_duration / 60)}min\n`;
      if (a.call_summary) {
        message += `Summary: ${truncateWords(a.call_summary, 400)}\n`;
      } else if (a.call_transcript) {
        message += `Transcript:\n${truncateWords(a.call_transcript, 400)}\n`;
      }
      if (a.voicemail_transcript) message += `Voicemail: ${truncateWords(a.voicemail_transcript, 200)}\n`;
    } else if (a.activity_type === "email") {
      if (a.subject) message += `Subject: ${a.subject}\n`;
      if (a.body_text) message += `Body: ${truncateWords(a.body_text, 500)}\n`;
    } else if (a.activity_type === "note") {
      if (a.note_text) message += `Note: ${truncateWords(a.note_text, 300)}\n`;
    }

    message += `\n`;
  }

  return message;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  try {
    console.log(`[assess-fit] START`);
    const body: AssessFitRequest = await request.json();
    const { leadId, activities } = body;
    console.log(`[assess-fit] Lead: ${leadId}, activities: ${activities?.length ?? 0}`);

    if (!leadId || !activities) {
      return NextResponse.json(
        { error: "leadId and activities are required" },
        { status: 400 }
      );
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "Gemini API key not configured" },
        { status: 500 }
      );
    }

    const supabase = await createClient();

    // Step 1: Upsert activities into lead_activities table (same as generate-email)
    const activityRows = activities
      .filter((a) => ["call", "email", "note"].includes(a.type))
      .map((a) => ({
        close_activity_id: a.id || `${leadId}_${a.type}_${a.date}`,
        close_lead_id: leadId,
        activity_type: a.type,
        direction: a.direction || null,
        date_created: a.date,
        user_name: a.userName || null,
        subject: a.subject || null,
        body_text: a.body || null,
        call_duration: a.duration || null,
        call_disposition: a.disposition || null,
        call_summary: a.callSummary || null,
        call_transcript: a.transcript || null,
        voicemail_transcript: a.voicemailTranscript || null,
        note_text: a.note || null,
        raw_data: JSON.stringify(a),
        updated_at: new Date().toISOString(),
      }));

    if (activityRows.length > 0) {
      await supabase
        .from("lead_activities")
        .upsert(activityRows, { onConflict: "close_activity_id" });
    }
    console.log(`[assess-fit] UPSERT — ${activityRows.length} rows @ ${Date.now() - startTime}ms`);

    // Step 2: Fetch linked facility via facility_lead_links -> sports_facilities
    let facility: any = null;
    const { data: links } = await supabase
      .from("facility_lead_links")
      .select("place_id")
      .eq("close_lead_id", leadId)
      .limit(1);

    if (links && links.length > 0) {
      const { data: facilityData } = await supabase
        .from("sports_facilities")
        .select("name, address, rating, user_ratings_total, identified_sports, opening_hours, additional_reviews, reviews")
        .eq("place_id", links[0].place_id)
        .single();

      if (facilityData) {
        facility = { ...facilityData, place_id: links[0].place_id };
      }
    }
    console.log(`[assess-fit] FACILITY — ${facility ? facility.name : "none"} @ ${Date.now() - startTime}ms`);

    // Step 3: Fetch recent activities from lead_activities
    const { data: dbActivities } = await supabase
      .from("lead_activities")
      .select("*")
      .eq("close_lead_id", leadId)
      .order("date_created", { ascending: true })
      .limit(30);

    console.log(`[assess-fit] FETCH — ${dbActivities?.length ?? 0} activities @ ${Date.now() - startTime}ms`);

    // Step 4: Build context message
    const userMessage = buildUserMessage(body, facility, dbActivities || []);
    console.log(`[assess-fit] PROMPT — ${userMessage.length} chars (~${Math.round(userMessage.length / 4)} tokens) @ ${Date.now() - startTime}ms`);

    // Step 5: Call Gemini
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: {
        responseMimeType: "application/json",
        maxOutputTokens: 3000,
      },
    });

    console.log(`[assess-fit] GEMINI_START @ ${Date.now() - startTime}ms`);
    const geminiStart = Date.now();
    const result = await model.generateContent({
      systemInstruction: SYSTEM_PROMPT,
      contents: [{ role: "user", parts: [{ text: userMessage }] }],
    });

    const text = result.response.text();
    console.log(`[assess-fit] GEMINI_DONE — ${((Date.now() - geminiStart) / 1000).toFixed(1)}s @ ${Date.now() - startTime}ms`);

    // Step 6: Parse & insert
    let parsed: {
      overall_score: number;
      availability_score: number;
      review_signals_score: number;
      facility_quality_score: number;
      engagement_score: number;
      lease_fit_score: number;
      verdict: string;
      summary: string;
      reasoning?: any;
    };
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("Failed to parse Gemini response as JSON");
    }
    console.log(`[assess-fit] PARSED — verdict: ${parsed.verdict}, score: ${parsed.overall_score} @ ${Date.now() - startTime}ms`);

    const { data: saved, error: insertError } = await supabase
      .from("fit_assessments")
      .insert({
        close_lead_id: leadId,
        place_id: facility?.place_id || null,
        facility_name: facility?.name || null,
        overall_score: parsed.overall_score,
        availability_score: parsed.availability_score,
        review_signals_score: parsed.review_signals_score,
        facility_quality_score: parsed.facility_quality_score,
        engagement_score: parsed.engagement_score,
        lease_fit_score: parsed.lease_fit_score,
        verdict: parsed.verdict,
        summary: parsed.summary,
        reasoning: parsed.reasoning ?? null,
        had_facility_data: !!facility,
        had_reviews: !!(facility?.additional_reviews?.length || facility?.reviews?.length),
        had_opening_hours: !!facility?.opening_hours?.weekday_text?.length,
        activity_count: dbActivities?.length || 0,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[assess-fit] ERROR — insert failed:", insertError);
      throw new Error("Failed to save fit assessment");
    }
    console.log(`[assess-fit] SAVED — id: ${saved.id} @ ${Date.now() - startTime}ms`);

    // Step 7: Auto-assign "Fit Assessment" tag to the linked facility
    if (facility?.place_id) {
      await supabase
        .from("facility_tag_assignments")
        .upsert(
          { place_id: facility.place_id, tag_id: "e1f0b490-d88b-403e-ba18-2c7e39d27b57" },
          { onConflict: "place_id,tag_id" }
        );
    }

    return NextResponse.json({ success: true, data: saved });
  } catch (error: any) {
    console.error(`[assess-fit] ERROR @ ${Date.now() - startTime}ms:`, error?.message || error);

    if (error?.status === 401) {
      return NextResponse.json(
        { error: "Invalid Gemini API key" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: error?.message || "Failed to assess fit" },
      { status: 500 }
    );
  }
}
