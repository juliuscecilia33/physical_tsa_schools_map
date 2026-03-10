import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import OpenAI from "openai";
import axios from "axios";
import * as cheerio from "cheerio";

// Load environment variables
dotenv.config({ path: path.join(__dirname, "../.env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const openaiApiKey = process.env.OPENAI_API_KEY!;

if (!supabaseUrl || !supabaseServiceKey || !openaiApiKey) {
  console.error("❌ Error: Missing required environment variables");
  console.error(
    "   Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY",
  );
  process.exit(1);
}

// Service role client for all operations (bypasses RLS)
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
const openai = new OpenAI({ apiKey: openaiApiKey });

interface FacilityToEnrich {
  place_id: string;
  name: string;
  address: string;
  website: string;
  phone?: string;
}

interface ProgressState {
  processedCount: number;
  successCount: number;
  failedCount: number;
  skippedCount: number;
  processedPlaceIds: string[];
  lastProcessedIndex: number;
  apiCallsUsed: number;
  totalCost: number;
  totalEmailsFound: number;
  lastUpdated: string;
  errors: Array<{
    place_id: string;
    name: string;
    error: string;
    timestamp: string;
  }>;
}

const PROGRESS_FILE = path.join(__dirname, "../progress/email-retry-openai-progress.json");

// Test mode: Set to a number to limit processing (e.g., 10 for testing), or null to process all
const TEST_LIMIT: number | null = 10;

// Re-process mode: Set to true to ALSO re-process facilities that already have emails
// This will replace existing emails with potentially more accurate results from OpenAI
// WARNING: This will significantly increase costs (processes ALL facilities with websites, not just failed ones)
const REPROCESS_EXISTING_EMAILS = false;

// Rate limiting
const DELAY_BETWEEN_REQUESTS_MS = 2000; // 2 seconds between requests
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 5000; // 5 seconds

// Request timeout (for fetching websites)
const FETCH_TIMEOUT_MS = 10000; // 10 seconds per page

// Cost tracking
// GPT-4o-mini: $0.15/1M input, $0.60/1M output tokens
// Estimated ~2000 input tokens + ~200 output tokens per facility
// Cost: (2000/1M * $0.15) + (200/1M * $0.60) = $0.0003 + $0.00012 = ~$0.0004
// Round up for safety: $0.001 per facility (much cheaper than web search!)
const ESTIMATED_COST_PER_FACILITY = 0.001;

// Helper functions
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function loadProgress(): ProgressState {
  if (fs.existsSync(PROGRESS_FILE)) {
    const data = fs.readFileSync(PROGRESS_FILE, "utf-8");
    return JSON.parse(data);
  }
  return {
    processedCount: 0,
    successCount: 0,
    failedCount: 0,
    skippedCount: 0,
    processedPlaceIds: [],
    lastProcessedIndex: -1,
    apiCallsUsed: 0,
    totalCost: 0,
    totalEmailsFound: 0,
    lastUpdated: new Date().toISOString(),
    errors: [],
  };
}

function saveProgress(progress: ProgressState) {
  progress.lastUpdated = new Date().toISOString();
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

/**
 * Load facilities from database that need email retry with OpenAI
 */
async function loadFacilitiesFromDatabase(): Promise<FacilityToEnrich[]> {
  console.log("📂 Querying facilities from database...");

  // Build query based on REPROCESS_EXISTING_EMAILS flag
  let query = supabaseAdmin
    .from("sports_facilities")
    .select("place_id, name, address, website, phone")
    .eq("serp_scraped", true)
    .eq("email_scrape_attempted", true)
    .not("website", "is", null);

  // If NOT reprocessing existing emails, only get facilities without emails
  if (!REPROCESS_EXISTING_EMAILS) {
    query = query.or("email.is.null,email.eq.{}");
  }
  // If reprocessing, we include ALL facilities (even those with existing emails)

  const { data: facilities, error } = await query;

  if (error) {
    console.error("❌ Database error:", error);
    process.exit(1);
  }

  if (!facilities || facilities.length === 0) {
    if (REPROCESS_EXISTING_EMAILS) {
      console.log("✅ All facilities have been processed!");
    } else {
      console.log("✅ All failed facilities have been retried or no facilities need retry!");
    }
    process.exit(0);
  }

  if (REPROCESS_EXISTING_EMAILS) {
    console.log(`✅ Loaded ${facilities.length} facilities for re-processing (including those with existing emails)`);
  } else {
    console.log(`✅ Loaded ${facilities.length} facilities needing email retry (no emails found previously)`);
  }

  return facilities.map((f: any) => ({
    place_id: f.place_id,
    name: f.name,
    address: f.address,
    website: f.website,
    phone: f.phone,
  }));
}

/**
 * Fetch HTML content from a URL with timeout
 */
async function fetchUrl(url: string, timeout: number = 10000): Promise<string | null> {
  try {
    const response = await axios.get(url, {
      timeout,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
      maxRedirects: 5,
      validateStatus: (status) => status < 400,
    });
    return response.data;
  } catch (error: any) {
    return null;
  }
}

/**
 * Extract text content from HTML, removing scripts and styles
 */
function extractTextFromHtml(html: string): string {
  const $ = cheerio.load(html);

  // Remove script and style elements
  $('script, style, noscript, iframe').remove();

  // Get text content
  const text = $('body').text();

  // Clean up whitespace
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Fetch and combine content from facility website
 */
async function fetchWebsiteContent(websiteUrl: string): Promise<{
  success: boolean;
  content?: string;
  pagesChecked: string[];
  error?: string;
}> {
  const pagesChecked: string[] = [];
  const contentParts: string[] = [];

  // Normalize URL
  let baseUrl = websiteUrl.trim();
  if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
    baseUrl = 'https://' + baseUrl;
  }

  // Remove trailing slash
  baseUrl = baseUrl.replace(/\/$/, '');

  // Pages to check
  const pagesToCheck = [
    baseUrl,
    `${baseUrl}/contact`,
    `${baseUrl}/contact-us`,
    `${baseUrl}/about`,
    `${baseUrl}/about-us`,
  ];

  console.log(`     🌐 Fetching content from ${new URL(baseUrl).hostname}...`);

  for (const url of pagesToCheck) {
    const html = await fetchUrl(url);
    if (html) {
      const text = extractTextFromHtml(html);
      if (text && text.length > 50) { // Only include if we got meaningful content
        contentParts.push(`--- Content from ${url} ---\n${text.substring(0, 5000)}`); // Limit to 5000 chars per page
        pagesChecked.push(url);
      }
    }
    // Small delay between requests
    await delay(500);
  }

  if (contentParts.length === 0) {
    return {
      success: false,
      pagesChecked,
      error: 'Could not fetch any content from website',
    };
  }

  const combinedContent = contentParts.join('\n\n');
  console.log(`     ✓ Fetched ${pagesChecked.length} page(s), ${combinedContent.length} chars total`);

  return {
    success: true,
    content: combinedContent,
    pagesChecked,
  };
}

/**
 * Validate and clean email addresses
 */
function validateEmail(email: string): boolean {
  // Basic email validation regex
  const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$/;

  if (!emailRegex.test(email)) {
    return false;
  }

  // Filter out common false positives
  const excludeDomains = [
    "example.com",
    "test.com",
    "domain.com",
    "email.com",
    "yourdomain.com",
    "yourcompany.com",
    "sentry.io",
    "wixpress.com",
    "gravatar.com",
    "cloudflare.com",
  ];

  const domain = email.split("@")[1]?.toLowerCase();
  if (excludeDomains.includes(domain)) {
    return false;
  }

  // Filter out image files
  if (email.match(/\.(png|jpg|jpeg|gif|svg|webp|bmp)$/i)) {
    return false;
  }

  return true;
}

/**
 * Search for contact emails using direct fetch + OpenAI extraction
 */
async function searchContactEmails(
  facility: FacilityToEnrich,
  retryCount = 0,
): Promise<{
  success: boolean;
  emails?: string[];
  sources?: string[];
  error?: string;
  apiCallsUsed: number;
  cost: number;
}> {
  let apiCallsUsed = 0;
  let cost = 0;

  try {
    console.log(`     🔍 Fetching website content and extracting emails with OpenAI...`);

    // Step 1: Fetch website content directly
    const fetchResult = await fetchWebsiteContent(facility.website);

    if (!fetchResult.success || !fetchResult.content) {
      return {
        success: false,
        error: fetchResult.error || "Could not fetch website content",
        sources: fetchResult.pagesChecked,
        apiCallsUsed: 0,
        cost: 0,
      };
    }

    // Step 2: Use OpenAI to intelligently extract emails from the content
    console.log(`     🤖 Analyzing content with OpenAI for email extraction...`);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Cheaper model, perfect for extraction
      messages: [
        {
          role: "system",
          content: "You are an expert at extracting contact email addresses from website content. Extract ALL valid email addresses that can be used to contact the facility. DO NOT include placeholder emails (example.com, test.com), service emails (noreply@, no-reply@), or third-party service emails (@sentry.io, @wixpress.com, @gravatar.com). Return valid emails only."
        },
        {
          role: "user",
          content: `Extract all contact email addresses from this facility's website content:

Facility Name: ${facility.name}
Address: ${facility.address}
${facility.phone ? `Phone: ${facility.phone}` : ""}

Website Content:
${fetchResult.content}

Return a JSON object with this EXACT structure:
{
  "emails": ["email1@domain.com", "email2@domain.com", ...] or [],
  "notes": "Brief note about where emails were found or why none were found"
}

IMPORTANT:
- If you find NO email addresses, return {"emails": [], "notes": "No email addresses found"}
- Return ONLY valid email addresses that can be used to contact this facility
- Prefer official contact emails (info@, contact@) over personal staff emails when both are available`
        }
      ],
      temperature: 0,
      response_format: { type: "json_object" },
    });

    apiCallsUsed++;

    // Calculate cost
    const usage = completion.usage;
    if (usage) {
      const inputTokens = usage.prompt_tokens || 0;
      const outputTokens = usage.completion_tokens || 0;
      // GPT-4o-mini pricing: $0.15/1M input, $0.60/1M output
      cost = (inputTokens / 1000000) * 0.15 + (outputTokens / 1000000) * 0.60;
    } else {
      cost = 0.001; // Fallback estimate
    }

    const messageContent = completion.choices[0]?.message?.content;

    if (!messageContent) {
      return {
        success: false,
        error: "Empty response from OpenAI",
        sources: fetchResult.pagesChecked,
        apiCallsUsed,
        cost,
      };
    }

    console.log(`     ✓ OpenAI analysis complete`);

    // Parse JSON response
    let emailData: any;
    try {
      emailData = JSON.parse(messageContent);
    } catch (parseError) {
      console.log(`     ⚠️  Failed to parse JSON from response`);
      return {
        success: false,
        error: "Could not parse OpenAI response as JSON",
        sources: fetchResult.pagesChecked,
        apiCallsUsed,
        cost,
      };
    }

    // Extract and validate emails
    const rawEmails = emailData.emails || [];
    const validEmails = rawEmails
      .filter((email: string) => validateEmail(email))
      .map((email: string) => email.toLowerCase().trim());

    // Remove duplicates
    const uniqueEmails = [...new Set(validEmails)];

    console.log(`     📧 Raw emails found: ${rawEmails.length}`);
    console.log(`     ✓ Valid unique emails: ${uniqueEmails.length}`);
    if (emailData.notes) {
      console.log(`     💡 Notes: ${emailData.notes.substring(0, 100)}${emailData.notes.length > 100 ? "..." : ""}`);
    }

    return {
      success: true,
      emails: uniqueEmails,
      sources: fetchResult.pagesChecked,
      apiCallsUsed,
      cost,
    };
  } catch (error: any) {
    const errorMessage = error.message || "Unknown error";
    console.log(`     ⚠️  Error: ${errorMessage}`);

    // Retry logic for transient errors
    if (retryCount < MAX_RETRIES) {
      console.log(`     🔄 Retrying (${retryCount + 1}/${MAX_RETRIES})...`);
      await delay(RETRY_DELAY_MS);
      return searchContactEmails(facility, retryCount + 1);
    }

    return {
      success: false,
      error: errorMessage,
      apiCallsUsed,
      cost,
    };
  }
}

/**
 * Update facility with found emails
 */
async function updateFacilityEmails(
  placeId: string,
  emails: string[],
): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin
      .from("sports_facilities")
      .update({
        email: emails.length > 0 ? emails : null,
        email_scraped_at: new Date().toISOString(),
      })
      .eq("place_id", placeId);

    if (error) {
      console.error(`     ⚠️  Database error: ${error.message}`);
      return false;
    }

    return true;
  } catch (error: any) {
    console.error(`     ⚠️  Error updating facility emails: ${error.message}`);
    return false;
  }
}

/**
 * Process a single facility
 */
async function processFacility(
  facility: FacilityToEnrich,
  progress: ProgressState,
  index: number,
  total: number,
): Promise<void> {
  console.log(`\n[${index + 1}/${total}] Processing: ${facility.name}`);
  console.log(`   Address: ${facility.address}`);
  console.log(`   Website: ${facility.website}`);
  console.log(`   Place ID: ${facility.place_id}`);

  // Check if already processed
  if (progress.processedPlaceIds.includes(facility.place_id)) {
    console.log(`   ⏭️  Already processed, skipping...`);
    progress.skippedCount++;
    return;
  }

  // Fetch website and extract emails with OpenAI
  console.log(`   🔍 Fetching website and extracting emails with OpenAI...`);
  const result = await searchContactEmails(facility);

  progress.apiCallsUsed += result.apiCallsUsed;
  progress.totalCost += result.cost;

  if (!result.success) {
    console.log(`   ❌ Failed: ${result.error}`);
    if (result.sources && result.sources.length > 0) {
      console.log(`     Sources checked: ${result.sources.length}`);
    }
    progress.failedCount++;
    progress.errors.push({
      place_id: facility.place_id,
      name: facility.name,
      error: result.error || "Unknown error",
      timestamp: new Date().toISOString(),
    });
    progress.processedPlaceIds.push(facility.place_id);
    progress.processedCount++;
    progress.lastProcessedIndex = index;
    return;
  }

  const emailsFound = result.emails || [];

  if (emailsFound.length === 0) {
    console.log(`   ℹ️  No emails found`);
    console.log(`     Sources checked: ${result.sources?.length || 0}`);
  } else {
    console.log(`   ✓ Found ${emailsFound.length} email(s)!`);
    emailsFound.forEach((email, i) => {
      console.log(`     ${i + 1}. ${email}`);
    });
    console.log(`     Sources: ${result.sources?.length || 0}`);
    progress.totalEmailsFound += emailsFound.length;
  }

  console.log(`     Cost: $${result.cost.toFixed(4)}`);

  // Update database
  console.log(`   💾 Saving to database...`);
  const updated = await updateFacilityEmails(facility.place_id, emailsFound);

  if (updated) {
    console.log(`   ✅ Success!`);
    if (emailsFound.length > 0) {
      progress.successCount++;
    } else {
      progress.failedCount++; // Count as failed if no emails found
    }
  } else {
    console.log(`   ❌ Failed to save to database`);
    progress.failedCount++;
    progress.errors.push({
      place_id: facility.place_id,
      name: facility.name,
      error: "Database update failed",
      timestamp: new Date().toISOString(),
    });
  }

  progress.processedPlaceIds.push(facility.place_id);
  progress.processedCount++;
  progress.lastProcessedIndex = index;
}

/**
 * Generate progress summary
 */
function printProgressSummary(
  progress: ProgressState,
  total: number,
  startTime: number,
): void {
  const elapsed = (Date.now() - startTime) / 1000 / 60; // minutes
  const remaining = total - progress.processedCount;
  const rate = progress.processedCount / elapsed;
  const eta = remaining / rate;

  console.log("\n" + "=".repeat(70));
  console.log("📊 PROGRESS SUMMARY");
  console.log("=".repeat(70));
  console.log(`   Total Facilities: ${total}`);
  console.log(`   Processed: ${progress.processedCount}`);
  console.log(`   Emails Found: ${progress.successCount}`);
  console.log(`   No Emails: ${progress.failedCount}`);
  console.log(`   Skipped: ${progress.skippedCount}`);
  console.log(`   Remaining: ${remaining}`);
  console.log(`   Total Email Addresses Collected: ${progress.totalEmailsFound}`);
  console.log(`   API Calls Used: ${progress.apiCallsUsed}`);
  console.log(`   Total Cost: $${progress.totalCost.toFixed(2)}`);
  console.log(
    `   Success Rate: ${((progress.successCount / (progress.processedCount || 1)) * 100).toFixed(1)}%`,
  );
  console.log(`   Elapsed Time: ${elapsed.toFixed(1)} minutes`);
  console.log(
    `   ETA: ${eta.toFixed(1)} minutes (~${(eta / 60).toFixed(1)} hours)`,
  );
  console.log(`   Rate: ${rate.toFixed(2)} facilities/minute`);
  console.log(`   Avg Cost/Facility: $${(progress.totalCost / (progress.processedCount || 1)).toFixed(4)}`);
  console.log("=".repeat(70));
}

/**
 * Main function
 */
async function retryFailedEmails() {
  console.log("🚀 Email Collection Retry Script (OpenAI Web Search)");
  console.log("=".repeat(70));

  if (TEST_LIMIT) {
    console.log(`🧪 TEST MODE: Processing only ${TEST_LIMIT} facilities`);
    console.log("   (Set TEST_LIMIT to null in the script to process all)");
  }

  if (REPROCESS_EXISTING_EMAILS) {
    console.log(`🔄 REPROCESS MODE: Will re-process ALL facilities (including those with existing emails)`);
    console.log("   ⚠️  This will replace existing emails with new results from OpenAI");
    console.log("   (Set REPROCESS_EXISTING_EMAILS to false to only process failed facilities)");
  }

  console.log("\n📋 This script will:");
  if (REPROCESS_EXISTING_EMAILS) {
    console.log("   • Load ALL facilities that were previously scraped (including successes)");
    console.log("   • Re-process them with more accurate OpenAI extraction");
    console.log("   • REPLACE existing emails with new, more accurate results");
  } else {
    console.log("   • Load facilities where email collection previously failed");
  }
  console.log("   • Fetch HTML directly from facility websites (main + contact pages)");
  console.log("   • Use OpenAI (gpt-4o-mini) to intelligently extract emails from content");
  console.log("   • Validate and clean found email addresses");
  console.log("   • Update database with found emails");
  console.log("   • Track progress for resumable operation");

  console.log("\n⚠️  Important:");
  console.log(`   • Estimated cost: ~$${ESTIMATED_COST_PER_FACILITY.toFixed(3)} per facility (75-80% cheaper than web search!)`);
  console.log("   • Rate limit: 1 request every 2 seconds");
  console.log("   • Timeout: 10 seconds per page fetch");
  console.log("   • Progress saved after each facility");
  if (REPROCESS_EXISTING_EMAILS) {
    console.log("   • ⚠️  REPROCESS MODE will overwrite existing emails!");
  }

  console.log("=".repeat(70) + "\n");

  // Load facilities
  const allFacilities = await loadFacilitiesFromDatabase();

  // Load progress
  const progress = loadProgress();

  if (progress.processedCount > 0) {
    console.log("♻️  Resuming from previous session:");
    console.log(`   Last processed index: ${progress.lastProcessedIndex}`);
    console.log(
      `   Processed: ${progress.processedCount}/${allFacilities.length}`,
    );
    console.log(`   Emails found: ${progress.successCount}`);
    console.log(`   Total email addresses: ${progress.totalEmailsFound}`);
    console.log(`   API calls used: ${progress.apiCallsUsed}`);
    console.log(`   Total cost: $${progress.totalCost.toFixed(2)}\n`);
  }

  // Determine how many facilities to process
  const totalToProcess = TEST_LIMIT
    ? Math.min(TEST_LIMIT, allFacilities.length)
    : allFacilities.length;

  const facilities = allFacilities.slice(0, totalToProcess);

  console.log(`📍 Will process ${facilities.length} facilities`);

  if (TEST_LIMIT) {
    const estimatedCost = facilities.length * ESTIMATED_COST_PER_FACILITY;
    console.log(`💰 Estimated cost for test batch: $${estimatedCost.toFixed(3)} (using direct fetch + gpt-4o-mini)`);
  } else {
    const estimatedCost = facilities.length * ESTIMATED_COST_PER_FACILITY;
    console.log(`💰 Estimated total cost: $${estimatedCost.toFixed(2)} (using direct fetch + gpt-4o-mini)`);
    console.log(`   Compare to web search approach: ~$${(facilities.length * 0.04).toFixed(2)} (75-80% savings!)`);
  }

  console.log("");

  const startTime = Date.now();

  // Process each facility
  for (let i = progress.lastProcessedIndex + 1; i < facilities.length; i++) {
    const facility = facilities[i];

    await processFacility(facility, progress, i, facilities.length);

    // Save progress after each facility
    saveProgress(progress);

    // Print summary every 5 facilities in test mode, 25 in production
    const summaryInterval = TEST_LIMIT ? 5 : 25;
    if ((i + 1) % summaryInterval === 0) {
      printProgressSummary(progress, facilities.length, startTime);
    }

    // Rate limiting delay
    if (i < facilities.length - 1) {
      await delay(DELAY_BETWEEN_REQUESTS_MS);
    }
  }

  // Final summary
  console.log("\n" + "=".repeat(70));
  console.log("🎉 EMAIL RETRY COMPLETE!");
  console.log("=".repeat(70));
  console.log(`   Total Processed: ${progress.processedCount}`);
  console.log(`   Facilities with Emails Found: ${progress.successCount}`);
  console.log(`   Facilities with No Emails: ${progress.failedCount}`);
  console.log(`   Skipped: ${progress.skippedCount}`);
  console.log(`   Total Email Addresses Collected: ${progress.totalEmailsFound}`);
  console.log(`   API Calls Used: ${progress.apiCallsUsed}`);
  console.log(`   Total Cost: $${progress.totalCost.toFixed(2)}`);
  console.log(
    `   Success Rate: ${((progress.successCount / (progress.processedCount || 1)) * 100).toFixed(1)}%`,
  );
  console.log(
    `   Avg Emails per Successful Facility: ${(progress.totalEmailsFound / (progress.successCount || 1)).toFixed(1)}`,
  );
  console.log(
    `   Total Time: ${((Date.now() - startTime) / 1000 / 60).toFixed(1)} minutes`,
  );

  if (progress.errors.length > 0) {
    console.log(`\n⚠️  Errors (${progress.errors.length}):`);
    progress.errors.slice(0, 10).forEach((error, index) => {
      console.log(`   ${index + 1}. ${error.name}: ${error.error}`);
    });
    if (progress.errors.length > 10) {
      console.log(`   ... and ${progress.errors.length - 10} more`);
    }
    console.log(`   Full error log saved in: ${PROGRESS_FILE}`);
  }

  console.log("\n✅ Email retry enrichment complete!");
  console.log("=".repeat(70));
}

retryFailedEmails().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
