import { createClient } from "@supabase/supabase-js";
import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: path.join(__dirname, "../.env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("❌ Error: Missing required environment variables");
  console.error("   Required: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// The "Scraped by SerpAPI" tag ID
const SERPAPI_TAG_ID = "e326fe36-5536-4209-87ed-f99528e1d1ee";

interface FacilityToTag {
  place_id: string;
  name: string;
}

/**
 * Fetch facilities that have been scraped by SerpAPI but don't have the tag assigned yet
 */
async function getFacilitiesNeedingTag(): Promise<FacilityToTag[]> {
  try {
    // Query facilities where serp_scraped = true
    // and they don't already have the SerpAPI tag assigned
    const { data, error } = await supabase
      .from("sports_facilities")
      .select("place_id, name")
      .eq("serp_scraped", true);

    if (error) {
      console.error(`❌ Error fetching facilities: ${error.message}`);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Get all existing tag assignments for these facilities
    const placeIds = data.map((f) => f.place_id);
    const { data: existingAssignments, error: assignmentError } = await supabase
      .from("facility_tag_assignments")
      .select("place_id")
      .in("place_id", placeIds)
      .eq("tag_id", SERPAPI_TAG_ID);

    if (assignmentError) {
      console.error(
        `❌ Error fetching existing assignments: ${assignmentError.message}`
      );
      return [];
    }

    // Filter out facilities that already have the tag
    const assignedPlaceIds = new Set(
      existingAssignments?.map((a) => a.place_id) || []
    );
    const facilitiesNeedingTag = data.filter(
      (f) => !assignedPlaceIds.has(f.place_id)
    );

    return facilitiesNeedingTag;
  } catch (error: any) {
    console.error(`❌ Exception: ${error.message}`);
    return [];
  }
}

/**
 * Assign the SerpAPI tag to a facility
 */
async function assignTagToFacility(placeId: string): Promise<boolean> {
  try {
    const { error } = await supabase.from("facility_tag_assignments").insert({
      place_id: placeId,
      tag_id: SERPAPI_TAG_ID,
    });

    if (error) {
      // Check if it's a unique constraint violation (already exists)
      if (error.code === "23505") {
        // Already exists, consider it a success
        return true;
      }
      console.error(`   ⚠️  Error: ${error.message}`);
      return false;
    }

    return true;
  } catch (error: any) {
    console.error(`   ⚠️  Exception: ${error.message}`);
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
  console.log("=".repeat(70) + "\n");

  // Fetch facilities that need the tag
  console.log("🔍 Fetching facilities that need the SerpAPI tag...");
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
