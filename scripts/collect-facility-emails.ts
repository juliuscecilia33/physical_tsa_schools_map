import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import axios from "axios";
import * as cheerio from "cheerio";

// Load environment variables
dotenv.config({ path: path.join(__dirname, "../.env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  console.error("❌ Error: Missing required environment variables");
  console.error(
    "   Required: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

interface FacilityToScrape {
  id: string;
  place_id: string;
  name: string;
  website: string;
  address: string;
}

interface ProgressState {
  processedCount: number;
  successCount: number;
  failedCount: number;
  skippedCount: number;
  processedPlaceIds: string[];
  lastProcessedIndex: number;
  emailsFound: number;
  lastUpdated: string;
  errors: Array<{
    place_id: string;
    name: string;
    error: string;
    timestamp: string;
  }>;
}

const PROGRESS_FILE = path.join(__dirname, "../.email-scraping-progress.json");

// Test mode: Set to a number to limit processing (e.g., 10 for testing), or null to process all
const TEST_LIMIT: number | null = 10;

// Rate limiting
const DELAY_BETWEEN_REQUESTS_MS = 2000; // 2 seconds between requests to be respectful
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 3000; // 3 seconds
const REQUEST_TIMEOUT_MS = 10000; // 10 seconds timeout per website

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
    emailsFound: 0,
    lastUpdated: new Date().toISOString(),
    errors: [],
  };
}

function saveProgress(progress: ProgressState) {
  progress.lastUpdated = new Date().toISOString();
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

/**
 * Extract email addresses from text using regex
 * Looks for common email patterns
 */
function extractEmails(text: string): string[] {
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  const matches = text.match(emailRegex) || [];

  // Filter out common false positives and placeholder emails
  const filtered = matches.filter(email => {
    const lower = email.toLowerCase();
    return (
      !lower.includes('example.com') &&
      !lower.includes('test.com') &&
      !lower.includes('placeholder') &&
      !lower.includes('yourdomain') &&
      !lower.includes('yoursite') &&
      !lower.includes('@sentry.io') &&
      !lower.includes('@wixpress.com') &&
      !lower.includes('@2x.png') &&
      !lower.endsWith('.png') &&
      !lower.endsWith('.jpg') &&
      !lower.endsWith('.jpeg') &&
      !lower.endsWith('.gif')
    );
  });

  // Remove duplicates
  return [...new Set(filtered)];
}

/**
 * Normalize URL to ensure it has a protocol
 */
function normalizeUrl(url: string): string {
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return `https://${url}`;
  }
  return url;
}

/**
 * Scrape email from a website
 * Checks main page and common contact pages
 */
async function scrapeEmailFromWebsite(
  websiteUrl: string,
  facilityName: string
): Promise<string | null> {
  const url = normalizeUrl(websiteUrl);
  const urlsToCheck: string[] = [url];

  try {
    // Try to extract base domain for contact page URLs
    const urlObj = new URL(url);
    const baseUrl = `${urlObj.protocol}//${urlObj.host}`;

    // Add common contact page patterns
    const contactPaths = ['/contact', '/contact-us', '/about'];
    contactPaths.forEach(path => {
      urlsToCheck.push(`${baseUrl}${path}`);
    });
  } catch (error) {
    // If URL parsing fails, just check the main URL
  }

  // Check each URL (main page + contact pages)
  for (const checkUrl of urlsToCheck) {
    try {
      const response = await axios.get(checkUrl, {
        timeout: REQUEST_TIMEOUT_MS,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
        maxRedirects: 5,
        validateStatus: (status) => status >= 200 && status < 400,
      });

      if (response.status === 200 && response.data) {
        // Parse HTML
        const $ = cheerio.load(response.data);

        // Remove script and style tags to avoid parsing JS/CSS
        $('script, style').remove();

        // Check mailto links first (most reliable)
        const mailtoLinks: string[] = [];
        $('a[href^="mailto:"]').each((i, elem) => {
          const href = $(elem).attr('href');
          if (href) {
            const email = href.replace('mailto:', '').split('?')[0].trim();
            mailtoLinks.push(email);
          }
        });

        if (mailtoLinks.length > 0) {
          const filtered = extractEmails(mailtoLinks.join(' '));
          if (filtered.length > 0) {
            console.log(`   ✓ Found email in mailto link: ${filtered[0]}`);
            return filtered[0];
          }
        }

        // Extract text from body
        const bodyText = $('body').text();

        // Look for emails in the text
        const emails = extractEmails(bodyText);

        if (emails.length > 0) {
          // Prefer emails that look like they belong to the facility
          // (e.g., contain facility name or are not generic info@/contact@)
          const facilityNameWords = facilityName
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .split(/\s+/)
            .filter(word => word.length > 3);

          const preferredEmail = emails.find(email => {
            const emailLower = email.toLowerCase();
            return facilityNameWords.some(word => emailLower.includes(word));
          });

          const selectedEmail = preferredEmail || emails[0];
          console.log(`   ✓ Found email in page content: ${selectedEmail}`);
          return selectedEmail;
        }
      }
    } catch (error: any) {
      // Continue to next URL if this one fails
      if (axios.isAxiosError(error)) {
        // Only log non-404 errors
        if (error.response?.status !== 404) {
          console.log(`   ⚠ Error checking ${checkUrl}: ${error.message}`);
        }
      }
    }
  }

  return null;
}

/**
 * Update facility with email in database
 */
async function updateFacilityEmail(
  facilityId: string,
  email: string | null,
  attempted: boolean
): Promise<void> {
  const updateData: any = {
    email_scrape_attempted: attempted,
  };

  if (email) {
    updateData.email = email;
    updateData.email_scraped_at = new Date().toISOString();
  }

  const { error } = await supabaseAdmin
    .from("sports_facilities")
    .update(updateData)
    .eq("id", facilityId);

  if (error) {
    throw new Error(`Failed to update facility: ${error.message}`);
  }
}

/**
 * Main function to process facilities
 */
async function processFacilities() {
  console.log("\n🔍 Starting Email Collection Process\n");
  console.log("=" .repeat(60));

  const progress = loadProgress();

  // Query facilities that need email scraping
  // Conditions: serp_scraped = true, website IS NOT NULL, email_scrape_attempted = false
  const query = supabase
    .from("sports_facilities")
    .select("id, place_id, name, website, address")
    .eq("serp_scraped", true)
    .not("website", "is", null)
    .or("email_scrape_attempted.is.null,email_scrape_attempted.eq.false");

  if (TEST_LIMIT) {
    query.limit(TEST_LIMIT);
  }

  const { data: facilities, error } = await query;

  if (error) {
    console.error("❌ Error fetching facilities:", error);
    process.exit(1);
  }

  if (!facilities || facilities.length === 0) {
    console.log("✅ No facilities to process!");
    return;
  }

  console.log(`📊 Found ${facilities.length} facilities to process`);
  if (TEST_LIMIT) {
    console.log(`⚠️  TEST MODE: Limited to ${TEST_LIMIT} facilities\n`);
  }

  const facilitiesToProcess = facilities as FacilityToScrape[];

  // Resume from where we left off
  let startIndex = 0;
  if (progress.processedPlaceIds.length > 0) {
    const lastProcessedPlaceId = progress.processedPlaceIds[progress.processedPlaceIds.length - 1];
    const lastIndex = facilitiesToProcess.findIndex(f => f.place_id === lastProcessedPlaceId);
    if (lastIndex !== -1) {
      startIndex = lastIndex + 1;
      console.log(`📍 Resuming from index ${startIndex} (previously processed ${progress.processedCount} facilities)\n`);
    }
  }

  // Process each facility
  for (let i = startIndex; i < facilitiesToProcess.length; i++) {
    const facility = facilitiesToProcess[i];

    console.log(`\n[${i + 1}/${facilitiesToProcess.length}] ${facility.name}`);
    console.log(`   Website: ${facility.website}`);

    // Check if already processed (in case of duplicates)
    if (progress.processedPlaceIds.includes(facility.place_id)) {
      console.log("   ⏭  Already processed, skipping");
      progress.skippedCount++;
      continue;
    }

    let email: string | null = null;
    let success = false;

    try {
      // Scrape email from website
      email = await scrapeEmailFromWebsite(facility.website, facility.name);

      // Update database
      await updateFacilityEmail(facility.id, email, true);

      if (email) {
        console.log(`   ✅ Email found and saved: ${email}`);
        progress.emailsFound++;
        progress.successCount++;
      } else {
        console.log(`   ℹ️  No email found`);
        progress.failedCount++;
      }

      success = true;
    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}`);
      progress.failedCount++;
      progress.errors.push({
        place_id: facility.place_id,
        name: facility.name,
        error: error.message,
        timestamp: new Date().toISOString(),
      });

      // Still mark as attempted even if there was an error
      try {
        await updateFacilityEmail(facility.id, null, true);
      } catch (updateError) {
        console.log(`   ⚠️  Failed to mark as attempted in database`);
      }
    }

    // Update progress
    progress.processedCount++;
    progress.processedPlaceIds.push(facility.place_id);
    progress.lastProcessedIndex = i;
    saveProgress(progress);

    // Rate limiting - wait between requests
    if (i < facilitiesToProcess.length - 1) {
      await delay(DELAY_BETWEEN_REQUESTS_MS);
    }
  }

  // Final summary
  console.log("\n" + "=".repeat(60));
  console.log("\n📊 Final Summary:");
  console.log(`   Total processed: ${progress.processedCount}`);
  console.log(`   Emails found: ${progress.emailsFound}`);
  console.log(`   No email found: ${progress.failedCount - progress.errors.length}`);
  console.log(`   Errors: ${progress.errors.length}`);
  console.log(`   Skipped (duplicates): ${progress.skippedCount}`);

  if (progress.errors.length > 0) {
    console.log("\n⚠️  Errors encountered:");
    progress.errors.slice(-10).forEach(err => {
      console.log(`   - ${err.name}: ${err.error}`);
    });
  }

  console.log(`\n✅ Process complete!`);
  console.log(`📁 Progress saved to: ${PROGRESS_FILE}\n`);
}

// Run the script
processFacilities()
  .then(() => {
    console.log("✨ Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Fatal error:", error);
    process.exit(1);
  });
