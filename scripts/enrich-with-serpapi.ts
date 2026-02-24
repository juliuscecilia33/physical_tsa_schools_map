import { createClient } from "@supabase/supabase-js";
import { getJson } from "serpapi";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: path.join(__dirname, "../.env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serpApiKey = process.env.SERPAPI_API_KEY!;

if (!supabaseUrl || !supabaseAnonKey || !serpApiKey) {
  console.error("❌ Error: Missing required environment variables");
  console.error("   Required: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SERPAPI_API_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface FacilityToEnrich {
  id: string;
  place_id: string;
  name: string;
  rating: number;
  user_ratings_total: number;
}

interface ProgressState {
  processedCount: number;
  successCount: number;
  failedCount: number;
  skippedCount: number;
  processedPlaceIds: string[];
  lastProcessedIndex: number;
  apiCallsUsed: number;
  lastUpdated: string;
  errors: Array<{
    place_id: string;
    name: string;
    error: string;
    timestamp: string;
  }>;
}

const PROGRESS_FILE = path.join(__dirname, "../.serpapi-progress.json");
const FACILITIES_FILE = path.join(__dirname, "../data/top-2500-high-quality-facilities.json");

// Rate limiting
const DELAY_BETWEEN_REQUESTS_MS = 2000; // 2 seconds between requests
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000; // 5 seconds

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
    lastUpdated: new Date().toISOString(),
    errors: [],
  };
}

function saveProgress(progress: ProgressState) {
  progress.lastUpdated = new Date().toISOString();
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

function loadFacilities(): FacilityToEnrich[] {
  if (!fs.existsSync(FACILITIES_FILE)) {
    console.error(`❌ Error: Facilities file not found at ${FACILITIES_FILE}`);
    console.error("   Please run 'select-top-facilities.ts' first.");
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(FACILITIES_FILE, "utf-8"));
  return data.facilities.map((f: any) => ({
    id: f.id,
    place_id: f.place_id,
    name: f.name,
    rating: f.rating,
    user_ratings_total: f.user_ratings_total,
  }));
}

/**
 * Fetch photos and reviews from SerpAPI for a given place_id
 */
async function fetchSerpApiData(
  placeId: string,
  retryCount = 0
): Promise<{
  success: boolean;
  photos?: any[];
  reviews?: any[];
  error?: string;
}> {
  try {
    const response = await getJson({
      engine: "google_maps",
      type: "place",
      place_id: placeId,
      api_key: serpApiKey,
    });

    // Extract photos
    const photos = response.photos || [];

    // Extract reviews
    const reviews = response.reviews || [];

    return {
      success: true,
      photos,
      reviews,
    };
  } catch (error: any) {
    // Retry logic
    if (retryCount < MAX_RETRIES) {
      console.log(`  ⚠️  Error, retrying (${retryCount + 1}/${MAX_RETRIES})...`);
      await delay(RETRY_DELAY_MS);
      return fetchSerpApiData(placeId, retryCount + 1);
    }

    return {
      success: false,
      error: error.message || "Unknown error",
    };
  }
}

/**
 * Update facility in database with SerpAPI data
 */
async function updateFacilityWithSerpData(
  facilityId: string,
  photos: any[],
  reviews: any[]
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("sports_facilities")
      .update({
        additional_photos: photos,
        additional_reviews: reviews,
        serp_scraped: true,
        serp_scraped_at: new Date().toISOString(),
      })
      .eq("id", facilityId);

    if (error) {
      console.error(`  ⚠️  Database error: ${error.message}`);
      return false;
    }

    return true;
  } catch (error: any) {
    console.error(`  ⚠️  Error updating facility: ${error.message}`);
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
  total: number
): Promise<void> {
  console.log(`\n[${ index + 1}/${total}] Processing: ${facility.name}`);
  console.log(`   Place ID: ${facility.place_id}`);

  // Check if already processed
  if (progress.processedPlaceIds.includes(facility.place_id)) {
    console.log(`   ⏭️  Already processed, skipping...`);
    progress.skippedCount++;
    return;
  }

  // Fetch data from SerpAPI
  console.log(`   🔍 Fetching data from SerpAPI...`);
  const serpData = await fetchSerpApiData(facility.place_id);
  progress.apiCallsUsed++;

  if (!serpData.success) {
    console.log(`   ❌ Failed: ${serpData.error}`);
    progress.failedCount++;
    progress.errors.push({
      place_id: facility.place_id,
      name: facility.name,
      error: serpData.error || "Unknown error",
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const photoCount = serpData.photos?.length || 0;
  const reviewCount = serpData.reviews?.length || 0;

  console.log(`   📸 Photos: ${photoCount}`);
  console.log(`   ⭐ Reviews: ${reviewCount}`);

  // Update database
  console.log(`   💾 Updating database...`);
  const updated = await updateFacilityWithSerpData(
    facility.id,
    serpData.photos || [],
    serpData.reviews || []
  );

  if (updated) {
    console.log(`   ✅ Success!`);
    progress.successCount++;
    progress.processedPlaceIds.push(facility.place_id);
  } else {
    console.log(`   ❌ Failed to update database`);
    progress.failedCount++;
    progress.errors.push({
      place_id: facility.place_id,
      name: facility.name,
      error: "Database update failed",
      timestamp: new Date().toISOString(),
    });
  }

  progress.processedCount++;
  progress.lastProcessedIndex = index;
}

/**
 * Generate progress summary
 */
function printProgressSummary(
  progress: ProgressState,
  total: number,
  startTime: number
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
  console.log(`   Successful: ${progress.successCount}`);
  console.log(`   Failed: ${progress.failedCount}`);
  console.log(`   Skipped: ${progress.skippedCount}`);
  console.log(`   Remaining: ${remaining}`);
  console.log(`   API Calls Used: ${progress.apiCallsUsed}`);
  console.log(`   Success Rate: ${((progress.successCount / (progress.processedCount || 1)) * 100).toFixed(1)}%`);
  console.log(`   Elapsed Time: ${elapsed.toFixed(1)} minutes`);
  console.log(`   ETA: ${eta.toFixed(1)} minutes (~${(eta / 60).toFixed(1)} hours)`);
  console.log(`   Rate: ${rate.toFixed(2)} facilities/minute`);
  console.log("=".repeat(70));
}

/**
 * Main function
 */
async function enrichWithSerpApi() {
  console.log("🚀 SerpAPI Enrichment Script");
  console.log("=".repeat(70));
  console.log("📋 This script will:");
  console.log("   • Load top 2,500 high-quality facilities");
  console.log("   • Fetch ALL photos and reviews from SerpAPI");
  console.log("   • Update database with enriched data");
  console.log("   • Track progress for resumable operation");
  console.log("\n⚠️  Important:");
  console.log("   • SerpAPI limit: 5,000 searches/month");
  console.log("   • Rate limit: 1 request every 2 seconds");
  console.log("   • This will use 2,500 API calls");
  console.log("   • Estimated time: ~83 minutes");
  console.log("=".repeat(70) + "\n");

  // Load facilities
  console.log("📂 Loading facilities...");
  const facilities = loadFacilities();
  console.log(`✅ Loaded ${facilities.length} facilities\n`);

  // Load progress
  const progress = loadProgress();

  if (progress.processedCount > 0) {
    console.log("♻️  Resuming from previous session:");
    console.log(`   Last processed index: ${progress.lastProcessedIndex}`);
    console.log(`   Processed: ${progress.processedCount}/${facilities.length}`);
    console.log(`   API calls used: ${progress.apiCallsUsed}\n`);
  }

  const startTime = Date.now();

  // Process each facility
  for (let i = progress.lastProcessedIndex + 1; i < facilities.length; i++) {
    const facility = facilities[i];

    await processFacility(facility, progress, i, facilities.length);

    // Save progress after each facility
    saveProgress(progress);

    // Print summary every 50 facilities
    if ((i + 1) % 50 === 0) {
      printProgressSummary(progress, facilities.length, startTime);
    }

    // Rate limiting delay
    if (i < facilities.length - 1) {
      await delay(DELAY_BETWEEN_REQUESTS_MS);
    }
  }

  // Final summary
  console.log("\n" + "=".repeat(70));
  console.log("🎉 ENRICHMENT COMPLETE!");
  console.log("=".repeat(70));
  console.log(`   Total Processed: ${progress.processedCount}`);
  console.log(`   Successful: ${progress.successCount}`);
  console.log(`   Failed: ${progress.failedCount}`);
  console.log(`   Skipped: ${progress.skippedCount}`);
  console.log(`   API Calls Used: ${progress.apiCallsUsed}`);
  console.log(`   Success Rate: ${((progress.successCount / progress.processedCount) * 100).toFixed(1)}%`);
  console.log(
    `   Total Time: ${((Date.now() - startTime) / 1000 / 60).toFixed(1)} minutes`
  );

  if (progress.errors.length > 0) {
    console.log(`\n⚠️  Errors (${progress.errors.length}):`);
    progress.errors.slice(0, 10).forEach((error, index) => {
      console.log(
        `   ${index + 1}. ${error.name} (${error.place_id}): ${error.error}`
      );
    });
    if (progress.errors.length > 10) {
      console.log(`   ... and ${progress.errors.length - 10} more`);
    }
    console.log(`   Full error log saved in: ${PROGRESS_FILE}`);
  }

  console.log("\n✅ All facilities have been enriched with SerpAPI data!");
  console.log("=".repeat(70));
}

enrichWithSerpApi().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
