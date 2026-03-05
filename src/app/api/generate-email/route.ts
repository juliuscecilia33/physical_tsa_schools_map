import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { GenerateEmailRequest } from "@/types/email-generation";

export const maxDuration = 300;

const SYSTEM_PROMPT = `You are a sales development representative for a youth academic-sports program
(structured like a school, 501(c)(3) nonprofit). Your singular goal is to secure
a long-term, recurring facility lease for weekday mornings, 10:00 AM – 2:00 PM,
Monday through Friday, for approximately 36 weeks (the school year).

CORE VALUE PROPOSITION (the "Dead Time" pitch):
- You fill fields/courts that sit empty and generate zero revenue during school hours
- You are the ONLY organization seeking 10 AM Tuesday-type slots — zero competition
  with evening leagues or weekend tournaments
- You provide 5 days/week of guaranteed, predictable revenue during "dead loss" hours
- Your students are supervised athletes in a structured academic-sports program who
  treat facilities with more respect than general public rentals
- Standard insurance + 501(c)(3) documentation provided

KEY TALKING POINTS TO WEAVE IN WHEN RELEVANT:
- Ask about off-peak/bulk/tiered rates for recurring weekday bookings
- Reference that other metros (Houston, Round Rock) offer off-peak discounts
- Position as "anchor tenant" during unused hours
- If they cite website rates, note those are for one-off weekend rentals
- Ask who has authority to approve a custom seasonal contract
- Offer to send insurance and 501(c)(3) info as next step

INSTRUCTIONS:
1. Analyze ALL provided activity history chronologically
2. Determine email type:
   - "intro": No prior outbound emails/calls → first-touch email
   - "follow_up": Prior outreach exists but no response yet → nudge
   - "reply": Active back-and-forth conversation → contextual response
3. Reference specific details from past conversations (call transcripts,
   prior emails) to show attentiveness and continuity
4. Match the tone to the relationship stage — warmer for existing conversations
5. Always include a clear call-to-action (schedule a call, send a quote, etc.)
6. Keep subject lines under 60 characters
7. Keep body under 250 words

8. If "PREVIOUS ANALYSIS CONTEXT" is provided, use it as a baseline. Focus new analysis on activities after the previous generation. Build on previous talking points rather than repeating.

Respond in this exact JSON format:
{
  "subject": "Email subject line",
  "body": "Full email body text with line breaks",
  "emailType": "intro" | "follow_up" | "reply",
  "reasoning": "One-sentence summary of approach",
  "breakdown": {
    "referencedActivities": [{ "date": "Mar 4, 2026", "type": "call", "direction": "outbound", "influence": "How this activity influenced the email" }],
    "keyQuotes": [{ "source": "call transcript / email body / note", "quote": "Exact quote used", "usage": "How the quote was used in the email" }],
    "talkingPointRationale": [{ "point": "The talking point", "why": "Why this point was chosen for this lead" }],
    "toneJustification": "Why this tone was chosen based on relationship stage"
  }
}`;

function truncateWords(text: string, maxWords: number): string {
  const words = text.split(/\s+/);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(" ") + "...";
}

function buildUserMessage(
  req: GenerateEmailRequest,
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
  }>,
  previousEmails: Array<{
    subject: string;
    body_text: string;
    email_type: string;
    created_at: string;
    generation_context?: any;
  }>
): string {
  let message = `LEAD INFORMATION:\n`;
  message += `Name: ${req.leadName}\n`;
  if (req.leadDescription) message += `Description: ${req.leadDescription}\n`;
  if (req.contactName) message += `Contact: ${req.contactName}\n`;
  if (req.contactTitle) message += `Title: ${req.contactTitle}\n`;
  if (req.contactEmail) message += `Email: ${req.contactEmail}\n`;

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

  if (previousEmails.length > 0) {
    message += `--- PREVIOUSLY GENERATED EMAIL DRAFTS (do not repeat these) ---\n\n`;
    for (const e of previousEmails) {
      const date = new Date(e.created_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      message += `[${date}] Type: ${e.email_type}\nSubject: ${e.subject}\nBody: ${truncateWords(e.body_text, 300)}\n\n`;
    }
  }

  // Find most recent email with generation_context
  const mostRecentWithContext = previousEmails
    .slice()
    .reverse()
    .find((e) => e.generation_context);

  if (mostRecentWithContext?.generation_context) {
    const ctx = mostRecentWithContext.generation_context;
    message += `--- PREVIOUS ANALYSIS CONTEXT (from most recent generation) ---\nUse this to build on previous analysis. Focus on NEW activities since then.\n\n`;

    if (ctx.referencedActivities?.length > 0) {
      message += `Previously referenced activities:\n`;
      for (const a of ctx.referencedActivities) {
        message += `- [${a.date}] ${a.type}${a.direction ? ` (${a.direction})` : ""}: ${a.influence}\n`;
      }
      message += `\n`;
    }

    if (ctx.talkingPointRationale?.length > 0) {
      message += `Previously used talking points:\n`;
      for (const tp of ctx.talkingPointRationale) {
        message += `- ${tp.point}: ${tp.why}\n`;
      }
      message += `\n`;
    }

    if (ctx.toneJustification) {
      message += `Previous tone approach: ${ctx.toneJustification}\n\n`;
    }
  }

  return message;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  try {
    console.log(`[generate-email] START`);
    const body: GenerateEmailRequest = await request.json();
    const { leadId, activities } = body;
    console.log(`[generate-email] Lead: ${leadId}, activities: ${activities?.length ?? 0}`);

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

    // Upsert activities into lead_activities table
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
    console.log(`[generate-email] UPSERT — ${activityRows.length} rows @ ${Date.now() - startTime}ms`);

    // Fetch previously generated emails for this lead (last 5)
    const { data: previousEmails } = await supabase
      .from("generated_emails")
      .select("subject, body_text, email_type, created_at, generation_context")
      .eq("close_lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(5);

    // Read back all activities from lead_activities for this lead
    const { data: dbActivities } = await supabase
      .from("lead_activities")
      .select("*")
      .eq("close_lead_id", leadId)
      .order("date_created", { ascending: true })
      .limit(30);

    console.log(`[generate-email] FETCH — ${dbActivities?.length ?? 0} activities, ${previousEmails?.length ?? 0} prev emails @ ${Date.now() - startTime}ms`);

    const userMessage = buildUserMessage(
      body,
      dbActivities || [],
      (previousEmails || []).reverse()
    );
    console.log(`[generate-email] PROMPT — ${userMessage.length} chars (~${Math.round(userMessage.length / 4)} tokens) @ ${Date.now() - startTime}ms`);

    // Call Gemini API
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: {
        responseMimeType: "application/json",
        maxOutputTokens: 2000,
      },
    });

    console.log(`[generate-email] GEMINI_START @ ${Date.now() - startTime}ms`);
    const geminiStart = Date.now();
    const result = await model.generateContent({
      systemInstruction: SYSTEM_PROMPT,
      contents: [{ role: "user", parts: [{ text: userMessage }] }],
    });

    const text = result.response.text();
    console.log(`[generate-email] GEMINI_DONE — ${((Date.now() - geminiStart) / 1000).toFixed(1)}s @ ${Date.now() - startTime}ms`);

    // Parse JSON response
    let parsed: { subject: string; body: string; emailType: string; reasoning: string; breakdown?: any };
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("Failed to parse Gemini response as JSON");
    }
    console.log(`[generate-email] PARSED — type: ${parsed.emailType} @ ${Date.now() - startTime}ms`);

    // Insert into generated_emails
    const { data: savedEmail, error: insertError } = await supabase
      .from("generated_emails")
      .insert({
        close_lead_id: leadId,
        recipient_email: body.contactEmail || null,
        recipient_name: body.contactName || null,
        subject: parsed.subject,
        body_text: parsed.body,
        email_type: parsed.emailType,
        reasoning: parsed.reasoning,
        generation_context: parsed.breakdown ?? null,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[generate-email] ERROR — insert failed:", insertError);
      throw new Error("Failed to save generated email");
    }
    console.log(`[generate-email] SAVED — id: ${savedEmail.id} @ ${Date.now() - startTime}ms`);

    return NextResponse.json({ success: true, data: savedEmail });
  } catch (error: any) {
    console.error(`[generate-email] ERROR @ ${Date.now() - startTime}ms:`, error?.message || error);

    if (error?.status === 401) {
      return NextResponse.json(
        { error: "Invalid Gemini API key" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: error?.message || "Failed to generate email" },
      { status: 500 }
    );
  }
}
