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
  console.error("❌ Error: SUPABASE_SERVICE_ROLE_KEY not found");
  console.error("   This script requires service role key to bypass RLS policies");
  console.error("   Add SUPABASE_SERVICE_ROLE_KEY to your .env.local file");
  process.exit(1);
}

// Create admin client with service role key (bypasses RLS)
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// The "Close Data Included" tag ID
const CLOSE_DATA_TAG_ID = "ef3537b6-4d83-4eb8-84a5-9bc74e776c72";

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;
const QUERY_TIMEOUT_MS = 30000;

// Batch configuration to avoid header overflow
const BATCH_SIZE = 100;

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
 * Validate that required tables exist and the tag is present
 */
async function validateTables(): Promise<boolean> {
  console.log("\n🔍 Validating database tables...");

  try {
    // Check facility_lead_links table
    const { error: linksError } = await queryWithRetry(
      async () =>
        supabaseAdmin.from("facility_lead_links").select("place_id").limit(1),
      "Validate facility_lead_links table exists"
    );

    if (linksError) {
      console.error(
        `   ❌ facility_lead_links table validation failed: ${linksError.message}`
      );
      return false;
    }
    console.log("   ✅ facility_lead_links table exists");

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
          .eq("id", CLOSE_DATA_TAG_ID)
          .single(),
      "Validate Close Data Included tag exists"
    );

    if (tagError || !tagData) {
      console.error(
        `   ❌ Close Data Included tag validation failed: ${tagError?.message || "Tag not found"}`
      );
      console.error(`   Expected tag ID: ${CLOSE_DATA_TAG_ID}`);
      return false;
    }
    console.log(`   ✅ Close Data Included tag exists: "${tagData.name}"`);

    return true;
  } catch (error: any) {
    console.error(`   ❌ Table validation exception: ${error.message}`);
    return false;
  }
}

/**
 * Fetch distinct place_ids from facility_lead_links that don't already have the tag
 */
async function getPlaceIdsNeedingTag(): Promise<string[]> {
  console.log("\n🔍 Step 1: Fetching distinct place_ids from facility_lead_links...");

  const { data, error } = await queryWithRetry(
    async () =>
      supabaseAdmin
        .from("facility_lead_links")
        .select("place_id"),
    "Fetch place_ids from facility_lead_links"
  );

  if (error) {
    console.error(`❌ Error fetching facility_lead_links: ${error.message}`);
    console.error(`   Error code: ${error.code}`);
    console.error(`   Error details: ${JSON.stringify(error.details)}`);
    throw new Error(`Failed to fetch facility_lead_links: ${error.message}`);
  }

  if (!data || data.length === 0) {
    console.log("   ℹ️  No place_ids found in facility_lead_links");
    return [];
  }

  // Deduplicate place_ids
  const distinctPlaceIds = [...new Set(data.map((row) => row.place_id))];
  console.log(
    `   ✅ Found ${distinctPlaceIds.length} distinct place_ids (from ${data.length} total links)`
  );

  console.log("\n🔍 Step 2: Checking existing tag assignments...");

  const allExistingAssignments: Array<{ place_id: string }> = [];

  for (let i = 0; i < distinctPlaceIds.length; i += BATCH_SIZE) {
    const batch = distinctPlaceIds.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(distinctPlaceIds.length / BATCH_SIZE);

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
            .eq("tag_id", CLOSE_DATA_TAG_ID),
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

  // Filter out place_ids that already have the tag
  const assignedPlaceIds = new Set(
    allExistingAssignments.map((a) => a.place_id)
  );
  const placeIdsNeedingTag = distinctPlaceIds.filter(
    (id) => !assignedPlaceIds.has(id)
  );

  console.log(
    `   ✅ ${placeIdsNeedingTag.length} facilities need the tag assigned`
  );

  return placeIdsNeedingTag;
}

/**
 * Assign the Close Data Included tag to a facility
 */
async function assignTagToFacility(placeId: string): Promise<boolean> {
  const { error } = await queryWithRetry(
    async () =>
      supabaseAdmin.from("facility_tag_assignments").insert({
        place_id: placeId,
        tag_id: CLOSE_DATA_TAG_ID,
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
 * Main function
 */
async function assignCloseDataTag() {
  console.log("🏷️  Close Data Tag Assignment Script");
  console.log("=".repeat(70));
  console.log("\n📋 This script will:");
  console.log("   • Find facilities linked to Close CRM leads (via facility_lead_links)");
  console.log("   • Skip facilities that already have the 'Close Data Included' tag");
  console.log("   • Assign the tag to facilities that don't have it yet");
  console.log(`   • Tag ID: ${CLOSE_DATA_TAG_ID}`);
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

  // Fetch place_ids that need the tag
  const placeIds = await getPlaceIdsNeedingTag();

  if (placeIds.length === 0) {
    console.log("✅ No facilities need tagging. All done!");
    console.log(
      "   (All linked facilities already have the 'Close Data Included' tag)"
    );
    return;
  }

  console.log(`✅ Found ${placeIds.length} facilities that need the tag\n`);

  // Track progress
  let assignedCount = 0;
  let failedCount = 0;
  const errors: Array<{ place_id: string; error: string }> = [];

  // Assign tag to each facility
  for (let i = 0; i < placeIds.length; i++) {
    const placeId = placeIds[i];
    console.log(
      `[${i + 1}/${placeIds.length}] Assigning tag to: ${placeId}`
    );

    const success = await assignTagToFacility(placeId);

    if (success) {
      console.log(`   ✅ Tag assigned successfully`);
      assignedCount++;
    } else {
      console.log(`   ❌ Failed to assign tag`);
      failedCount++;
      errors.push({
        place_id: placeId,
        error: "Failed to insert tag assignment",
      });
    }
  }

  // Final summary
  console.log("\n" + "=".repeat(70));
  console.log("🎉 TAG ASSIGNMENT COMPLETE!");
  console.log("=".repeat(70));
  console.log(`   Total Facilities Found: ${placeIds.length}`);
  console.log(`   Successfully Assigned: ${assignedCount}`);
  console.log(`   Failed: ${failedCount}`);
  console.log(
    `   Success Rate: ${((assignedCount / placeIds.length) * 100).toFixed(1)}%`
  );

  if (errors.length > 0) {
    console.log(`\n⚠️  Errors (${errors.length}):`);
    errors.forEach((error, index) => {
      console.log(
        `   ${index + 1}. ${error.place_id}: ${error.error}`
      );
    });
  }

  console.log("\n✅ All facilities have been processed!");
  console.log("=".repeat(70));
}

assignCloseDataTag().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
