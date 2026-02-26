import { createClient } from "@supabase/supabase-js";
import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: path.join(__dirname, "../.env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("❌ Error: Missing required environment variables");
  console.error("   Required: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}

if (!supabaseServiceKey) {
  console.warn("⚠️  Warning: SUPABASE_SERVICE_ROLE_KEY not found");
  console.warn("   Using anon key instead (may have RLS restrictions)");
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Create admin client with service role key (bypasses RLS)
const supabaseAdmin = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : supabase;

// The "Scraped by SerpAPI" tag ID
const SERPAPI_TAG_ID = "e326fe36-5536-4209-87ed-f99528e1d1ee";

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;
const QUERY_TIMEOUT_MS = 30000;

// Batch configuration to avoid header overflow
const BATCH_SIZE = 100;

interface FacilityToTag {
  place_id: string;
  name: string;
}

/**
 * Helper function to execute a query with retry logic and timeout
 */
async function queryWithRetry<T>(
  queryFn: () => Promise<T>,
  operation: string,
  retryCount = 0
): Promise<T> {
  try {
    console.log(
      `   ${retryCount > 0 ? `Retry ${retryCount}/${MAX_RETRIES}: ` : ""}Executing: ${operation}`
    );

    const result = await Promise.race<T>([
      queryFn(),
      new Promise<T>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Query timeout after ${QUERY_TIMEOUT_MS}ms`)),
          QUERY_TIMEOUT_MS
        )
      ),
    ]);

    return result;
  } catch (error: any) {
    console.error(`   ⚠️  Error during ${operation}: ${error.message}`);

    if (retryCount < MAX_RETRIES) {
      const delay = RETRY_DELAY_MS * Math.pow(2, retryCount);
      console.log(`   ⏳ Waiting ${delay}ms before retry...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return queryWithRetry(queryFn, operation, retryCount + 1);
    }

    console.error(`   ❌ Failed after ${MAX_RETRIES} retries`);
    throw error;
  }
}

/**
 * Fetch facilities that have been scraped by SerpAPI but don't have the tag assigned yet
 */
async function getFacilitiesNeedingTag(): Promise<FacilityToTag[]> {
  console.log("\n🔍 Step 1: Fetching facilities with serp_scraped = true...");

  // Query facilities where serp_scraped = true
  const { data, error } = await queryWithRetry(
    async () =>
      supabaseAdmin
        .from("sports_facilities")
        .select("place_id, name")
        .eq("serp_scraped", true),
    "Fetch facilities with serp_scraped = true"
  );

  if (error) {
    console.error(`❌ Error fetching facilities: ${error.message}`);
    console.error(`   Error code: ${error.code}`);
    console.error(`   Error details: ${JSON.stringify(error.details)}`);
    throw new Error(`Failed to fetch facilities: ${error.message}`);
  }

  if (!data || data.length === 0) {
    console.log("   ℹ️  No facilities found with serp_scraped = true");
    return [];
  }

  console.log(`   ✅ Found ${data.length} facilities with serp_scraped = true`);

  console.log("\n🔍 Step 2: Checking existing tag assignments...");

  // Get all existing tag assignments for these facilities
  // Batch the queries to avoid header overflow with large arrays
  const placeIds = data.map((f) => f.place_id);
  const allExistingAssignments: Array<{ place_id: string }> = [];

  for (let i = 0; i < placeIds.length; i += BATCH_SIZE) {
    const batch = placeIds.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(placeIds.length / BATCH_SIZE);

    console.log(
      `   Processing batch ${batchNum}/${totalBatches} (${batch.length} place_ids)...`
    );

    const { data: batchAssignments, error: assignmentError } =
      await queryWithRetry(
        async () =>
          supabaseAdmin
            .from("facility_tag_assignments")
            .select("place_id")
            .in("place_id", batch)
            .eq("tag_id", SERPAPI_TAG_ID),
        `Fetch existing tag assignments (batch ${batchNum}/${totalBatches})`
      );

    if (assignmentError) {
      console.error(
        `❌ Error fetching existing assignments: ${assignmentError.message}`
      );
      console.error(`   Error code: ${assignmentError.code}`);
      console.error(
        `   Error details: ${JSON.stringify(assignmentError.details)}`
      );
      console.error(`   Hint: Does the 'facility_tag_assignments' table exist?`);
      throw new Error(
        `Failed to fetch existing assignments: ${assignmentError.message}`
      );
    }

    if (batchAssignments) {
      allExistingAssignments.push(...batchAssignments);
    }
  }

  console.log(
    `   ✅ Found ${allExistingAssignments.length} existing tag assignments`
  );

  // Filter out facilities that already have the tag
  const assignedPlaceIds = new Set(
    allExistingAssignments.map((a) => a.place_id)
  );
  const facilitiesNeedingTag = data.filter(
    (f) => !assignedPlaceIds.has(f.place_id)
  );

  console.log(
    `   ✅ ${facilitiesNeedingTag.length} facilities need the tag assigned`
  );

  return facilitiesNeedingTag;
}

/**
 * Assign the SerpAPI tag to a facility
 */
async function assignTagToFacility(placeId: string): Promise<boolean> {
  const { error } = await queryWithRetry(
    async () =>
      supabaseAdmin.from("facility_tag_assignments").insert({
        place_id: placeId,
        tag_id: SERPAPI_TAG_ID,
      }),
    `Assign tag to facility ${placeId}`
  );

  if (error) {
    // Check if it's a unique constraint violation (already exists)
    if (error.code === "23505") {
      console.log(`   ℹ️  Tag already assigned (unique constraint)`);
      return true;
    }
    console.error(`   ⚠️  Error: ${error.message}`);
    console.error(`   Error code: ${error.code}`);
    console.error(`   Error details: ${JSON.stringify(error.details)}`);
    return false;
  }

  return true;
}

/**
 * Validate that required tables exist
 */
async function validateTables(): Promise<boolean> {
  console.log("\n🔍 Validating database tables...");

  try {
    // Check sports_facilities table
    const { error: facilitiesError } = await queryWithRetry(
      async () =>
        supabaseAdmin.from("sports_facilities").select("place_id").limit(1),
      "Validate sports_facilities table exists"
    );

    if (facilitiesError) {
      console.error(
        `   ❌ sports_facilities table validation failed: ${facilitiesError.message}`
      );
      return false;
    }
    console.log("   ✅ sports_facilities table exists");

    // Check facility_tag_assignments table
    const { error: assignmentsError } = await queryWithRetry(
      async () =>
        supabaseAdmin.from("facility_tag_assignments").select("id").limit(1),
      "Validate facility_tag_assignments table exists"
    );

    if (assignmentsError) {
      console.error(
        `   ❌ facility_tag_assignments table validation failed: ${assignmentsError.message}`
      );
      return false;
    }
    console.log("   ✅ facility_tag_assignments table exists");

    // Check facility_tags table and the specific tag
    const { data: tagData, error: tagError } = await queryWithRetry(
      async () =>
        supabaseAdmin
          .from("facility_tags")
          .select("id, name")
          .eq("id", SERPAPI_TAG_ID)
          .single(),
      "Validate SerpAPI tag exists"
    );

    if (tagError || !tagData) {
      console.error(
        `   ❌ SerpAPI tag validation failed: ${tagError?.message || "Tag not found"}`
      );
      console.error(`   Expected tag ID: ${SERPAPI_TAG_ID}`);
      return false;
    }
    console.log(`   ✅ SerpAPI tag exists: "${tagData.name}"`);

    return true;
  } catch (error: any) {
    console.error(`   ❌ Table validation exception: ${error.message}`);
    return false;
  }
}

/**
 * Main function
 */
async function assignSerpApiTag() {
  console.log("🏷️  SerpAPI Tag Assignment Script");
  console.log("=".repeat(70));
  console.log("\n📋 This script will:");
  console.log("   • Find facilities where serp_scraped = true");
  console.log("   • Skip facilities that already have the 'Scraped by SerpAPI' tag");
  console.log("   • Assign the tag to facilities that don't have it yet");
  console.log(`   • Tag ID: ${SERPAPI_TAG_ID}`);
  console.log(
    `   • Using: ${supabaseServiceKey ? "Service Role Key (Admin)" : "Anon Key"}`
  );
  console.log("=".repeat(70));

  // Validate tables exist
  const tablesValid = await validateTables();
  if (!tablesValid) {
    console.error("\n❌ Table validation failed. Exiting.");
    process.exit(1);
  }

  // Fetch facilities that need the tag
  const facilities = await getFacilitiesNeedingTag();

  if (facilities.length === 0) {
    console.log("✅ No facilities need tagging. All done!");
    console.log(
      "   (All serp_scraped facilities already have the 'Scraped by SerpAPI' tag)"
    );
    return;
  }

  console.log(`✅ Found ${facilities.length} facilities that need the tag\n`);

  // Track progress
  let assignedCount = 0;
  let failedCount = 0;
  const errors: Array<{ place_id: string; name: string; error: string }> = [];

  // Assign tag to each facility
  for (let i = 0; i < facilities.length; i++) {
    const facility = facilities[i];
    console.log(
      `[${i + 1}/${facilities.length}] Assigning tag to: ${facility.name}`
    );
    console.log(`   Place ID: ${facility.place_id}`);

    const success = await assignTagToFacility(facility.place_id);

    if (success) {
      console.log(`   ✅ Tag assigned successfully`);
      assignedCount++;
    } else {
      console.log(`   ❌ Failed to assign tag`);
      failedCount++;
      errors.push({
        place_id: facility.place_id,
        name: facility.name,
        error: "Failed to insert tag assignment",
      });
    }
  }

  // Final summary
  console.log("\n" + "=".repeat(70));
  console.log("🎉 TAG ASSIGNMENT COMPLETE!");
  console.log("=".repeat(70));
  console.log(`   Total Facilities Found: ${facilities.length}`);
  console.log(`   Successfully Assigned: ${assignedCount}`);
  console.log(`   Failed: ${failedCount}`);
  console.log(
    `   Success Rate: ${((assignedCount / facilities.length) * 100).toFixed(1)}%`
  );

  if (errors.length > 0) {
    console.log(`\n⚠️  Errors (${errors.length}):`);
    errors.forEach((error, index) => {
      console.log(
        `   ${index + 1}. ${error.name} (${error.place_id}): ${error.error}`
      );
    });
  }

  console.log("\n✅ All facilities have been processed!");
  console.log("=".repeat(70));
}

assignSerpApiTag().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
