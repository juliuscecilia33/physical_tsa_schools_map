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
  console.error(
    "   Required: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SERPAPI_API_KEY",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface FacilityToEnrich {
  id: string;
  place_id: string;
  name: string;
  rating: number;
  user_ratings_total: number;
  address: string;
  lat: number;
  lng: number;
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
const FACILITIES_FILE = path.join(
  __dirname,
  "../data/top-2500-high-quality-texas-facilities.json",
);

// Test mode: Set to a number to limit processing (e.g., 3 for testing), or null to process all
const TEST_LIMIT: number | null = 3;

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
    address: f.address,
    lat: f.location.lat,
    lng: f.location.lng,
  }));
}

/**
 * Fetch data_id from Google Maps API using direct place_id query
 */
async function getDataIdFromPlaceId(
  placeId: string,
): Promise<{ success: boolean; dataId?: string; error?: string }> {
  try {
    console.log(`     🔍 Querying Google Maps API with place_id...`);
    console.log(`     🎯 place_id: ${placeId}`);

    const response = await getJson({
      engine: "google_maps",
      place_id: placeId,
      api_key: serpApiKey,
    });

    // Direct place_id query returns data in place_results object
    const dataId = response.place_results?.data_id;

    if (dataId) {
      console.log(`     ✅ Got data_id: ${dataId}`);
      return {
        success: true,
        dataId: dataId,
      };
    }

    console.log(`     ❌ No data_id found in response`);
    console.log(`     Response keys:`, Object.keys(response));
    if (response.place_results) {
      console.log(`     place_results keys:`, Object.keys(response.place_results));
    }
    return {
      success: false,
      error: "No data_id found in place_id query response",
    };
  } catch (error: any) {
    console.log(`     ❌ Exception during place_id query: ${error.message}`);
    return {
      success: false,
      error: error.message || "Failed to fetch data_id",
    };
  }
}

/**
 * Fetch photos and reviews from SerpAPI for a given place_id
 * Note: Makes 3 API calls - one for data_id lookup via direct place_id query, one for photos, one for reviews
 * (Previously made 3 calls via search, now makes 3 calls via direct lookup - more reliable)
 */
async function fetchSerpApiData(
  placeId: string,
  facilityName: string,
  facilityAddress: string,
  lat: number,
  lng: number,
  retryCount = 0,
): Promise<{
  success: boolean;
  photos?: any[];
  reviews?: any[];
  dataId?: string;
  error?: string;
  apiCallsUsed: number;
}> {
  let photos: any[] = [];
  let reviews: any[] = [];
  let dataId: string | undefined;
  let apiCallsUsed = 0;

  try {
    // Step 1: Get data_id from direct place_id query
    console.log(`     → Getting data_id from place_id...`);
    const dataIdResult = await getDataIdFromPlaceId(placeId);
    apiCallsUsed++;

    if (!dataIdResult.success) {
      console.log(`     ⚠️  Could not get data_id: ${dataIdResult.error}`);
      console.log(`     ⏭️  Skipping photos, will only fetch reviews`);
    } else {
      dataId = dataIdResult.dataId;
      console.log(`     ✓ Got data_id: ${dataId}`);
    }

    // Step 2: Fetch photos using google_maps_photos engine (only if we have data_id)
    if (dataId) {
      console.log(`     → Fetching photos...`);
      try {
        const photosResponse = await getJson({
          engine: "google_maps_photos",
          data_id: dataId,
          api_key: serpApiKey,
        });
        apiCallsUsed++;
        photos = photosResponse.photos || [];
        console.log(`     ✓ Photos API returned ${photos.length} photos`);
      } catch (photoError: any) {
        console.log(`     ⚠️  Photos API error:`);
        console.log(`        Message: ${photoError.message || "No message"}`);
        console.log(`        Error object:`, JSON.stringify(photoError, null, 2));
        if (photoError.response) {
          console.log(`        Response status: ${photoError.response.status}`);
          console.log(
            `        Response data:`,
            JSON.stringify(photoError.response.data, null, 2),
          );
        }
      }

      // Small delay between API calls
      await delay(500);
    }

    // Step 3: Fetch reviews using google_maps_reviews engine
    console.log(`     → Fetching reviews...`);
    try {
      const reviewsResponse = await getJson({
        engine: "google_maps_reviews",
        place_id: placeId,
        api_key: serpApiKey,
      });
      apiCallsUsed++;
      reviews = reviewsResponse.reviews || [];
    } catch (reviewError: any) {
      console.log(`     ⚠️  Reviews API error: ${reviewError.message}`);
    }

    return {
      success: true,
      photos,
      reviews,
      dataId,
      apiCallsUsed,
    };
  } catch (error: any) {
    // Retry logic
    if (retryCount < MAX_RETRIES) {
      console.log(
        `  ⚠️  Error, retrying (${retryCount + 1}/${MAX_RETRIES})...`,
      );
      await delay(RETRY_DELAY_MS);
      return fetchSerpApiData(placeId, facilityName, facilityAddress, lat, lng, retryCount + 1);
    }

    return {
      success: false,
      error: error.message || "Unknown error",
      apiCallsUsed,
    };
  }
}

/**
 * Update facility in database with SerpAPI data
 */
async function updateFacilityWithSerpData(
  facilityId: string,
  photos: any[],
  reviews: any[],
  dataId?: string,
): Promise<boolean> {
  try {
    const updateData: any = {
      additional_photos: photos,
      additional_reviews: reviews,
      serp_scraped: true,
      serp_scraped_at: new Date().toISOString(),
    };

    // Only update serp_data_id if we successfully got one
    if (dataId) {
      updateData.serp_data_id = dataId;
    }

    const { error } = await supabase
      .from("sports_facilities")
      .update(updateData)
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
  total: number,
): Promise<void> {
  console.log(`\n[${index + 1}/${total}] Processing: ${facility.name}`);
  console.log(`   Place ID: ${facility.place_id}`);

  // Check if already processed
  if (progress.processedPlaceIds.includes(facility.place_id)) {
    console.log(`   ⏭️  Already processed, skipping...`);
    progress.skippedCount++;
    return;
  }

  // Fetch data from SerpAPI
  console.log(`   🔍 Fetching data from SerpAPI...`);
  const serpData = await fetchSerpApiData(
    facility.place_id,
    facility.name,
    facility.address,
    facility.lat,
    facility.lng,
  );
  progress.apiCallsUsed += serpData.apiCallsUsed;

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
    serpData.reviews || [],
    serpData.dataId,
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
  console.log(`   Successful: ${progress.successCount}`);
  console.log(`   Failed: ${progress.failedCount}`);
  console.log(`   Skipped: ${progress.skippedCount}`);
  console.log(`   Remaining: ${remaining}`);
  console.log(`   API Calls Used: ${progress.apiCallsUsed}`);
  console.log(
    `   Success Rate: ${((progress.successCount / (progress.processedCount || 1)) * 100).toFixed(1)}%`,
  );
  console.log(`   Elapsed Time: ${elapsed.toFixed(1)} minutes`);
  console.log(
    `   ETA: ${eta.toFixed(1)} minutes (~${(eta / 60).toFixed(1)} hours)`,
  );
  console.log(`   Rate: ${rate.toFixed(2)} facilities/minute`);
  console.log("=".repeat(70));
}

/**
 * Main function
 */
async function enrichWithSerpApi() {
  console.log("🚀 SerpAPI Enrichment Script");
  console.log("=".repeat(70));

  if (TEST_LIMIT) {
    console.log(`🧪 TEST MODE: Processing only ${TEST_LIMIT} facilities`);
    console.log("   (Set TEST_LIMIT to null in the script to process all)");
  }

  console.log("\n📋 This script will:");
  console.log("   • Load high-quality Texas facilities");
  console.log("   • Fetch ALL photos and reviews from SerpAPI");
  console.log("   • Update database with enriched data");
  console.log("   • Track progress for resumable operation");
  console.log("\n⚠️  Important:");
  console.log("   • SerpAPI limit: 5,000 searches/month");
  console.log("   • Rate limit: 1 request every 2 seconds");
  console.log(
    "   • Note: Each facility requires 3 API calls (direct place_id lookup + photos + reviews)",
  );
  console.log(
    "   • Improved: Now uses direct place_id query instead of search (more reliable)",
  );

  if (TEST_LIMIT) {
    console.log(`   • This will use ~${TEST_LIMIT * 3} API calls (test mode)`);
    console.log(
      `   • Estimated time: ~${((TEST_LIMIT * 3 * 2.5) / 60).toFixed(1)} minutes`,
    );
  } else {
    console.log("   • This will use ~7,500 API calls (2,500 facilities × 3)");
    console.log("   • Estimated time: ~312 minutes (~5.2 hours)");
    console.log(
      "   • ⚠️  WARNING: Exceeds 5,000/month limit - consider running in batches!",
    );
  }

  console.log("=".repeat(70) + "\n");

  // Load facilities
  console.log("📂 Loading facilities...");
  const facilities = loadFacilities();
  console.log(`✅ Loaded ${facilities.length} facilities`);

  if (TEST_LIMIT) {
    console.log(`🧪 Test mode: Will process only ${TEST_LIMIT} facilities\n`);
  } else {
    console.log(`   Will process all ${facilities.length} facilities\n`);
  }

  // Load progress
  const progress = loadProgress();

  if (progress.processedCount > 0) {
    console.log("♻️  Resuming from previous session:");
    console.log(`   Last processed index: ${progress.lastProcessedIndex}`);
    console.log(
      `   Processed: ${progress.processedCount}/${facilities.length}`,
    );
    console.log(`   API calls used: ${progress.apiCallsUsed}\n`);
  }

  const startTime = Date.now();

  // Determine how many facilities to process
  const totalToProcess = TEST_LIMIT
    ? Math.min(TEST_LIMIT, facilities.length)
    : facilities.length;

  // Process each facility
  for (let i = progress.lastProcessedIndex + 1; i < totalToProcess; i++) {
    const facility = facilities[i];

    await processFacility(facility, progress, i, totalToProcess);

    // Save progress after each facility
    saveProgress(progress);

    // Print summary every 50 facilities
    if ((i + 1) % 50 === 0) {
      printProgressSummary(progress, totalToProcess, startTime);
    }

    // Rate limiting delay
    if (i < totalToProcess - 1) {
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
  console.log(
    `   Success Rate: ${((progress.successCount / progress.processedCount) * 100).toFixed(1)}%`,
  );
  console.log(
    `   Total Time: ${((Date.now() - startTime) / 1000 / 60).toFixed(1)} minutes`,
  );

  if (progress.errors.length > 0) {
    console.log(`\n⚠️  Errors (${progress.errors.length}):`);
    progress.errors.slice(0, 10).forEach((error, index) => {
      console.log(
        `   ${index + 1}. ${error.name} (${error.place_id}): ${error.error}`,
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
