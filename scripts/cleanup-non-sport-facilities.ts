import { createClient } from "@supabase/supabase-js";
import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: path.join(__dirname, "../.env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Error: Missing Supabase environment variables");
  console.error("   Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

// Use service role key for admin operations (bypasses RLS)
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Non-sport facility types that should be removed
const NON_SPORT_TYPES = [
  "food",
  "restaurant",
  "cafe",
  "bar",
  "lodging",
  "hotel",
  "motel",
  "store",
  "clothing_store",
  "shopping_mall",
  "amusement_park",
  "movie_theater",
  "aquarium",
  "night_club",
  "tourist_attraction",
  "bowling_alley",        // Entertainment, not athletic field
  "ice_skating_rink",     // Removed from collection
  "ski_resort",           // Removed from collection
  "playground",           // Removed from collection (not for organized sports)
];

// Athletic facility types we want to keep
const KEEP_TYPES = [
  "park",
  "gym",
  "stadium",
  "athletic_field",
  "fitness_center",
  "sports_complex",
  "sports_club",
  "swimming_pool",
  "tennis_court",
  "golf_course",
  "basketball_court",
  "baseball_field",
  "soccer_field",
  "football_field",
  "community_center",
  "recreation_center",
  "school",              // May have athletic fields
];

async function cleanupNonSportFacilities() {
  console.log("🧹 Starting Cleanup of Non-Sport Facilities");
  console.log("=".repeat(60));
  console.log(`🗑️  Will remove facilities with ONLY these types:`);
  console.log(`   ${NON_SPORT_TYPES.join(", ")}`);
  console.log("=".repeat(60) + "\n");

  try {
    // Get count before cleanup
    const { count: beforeCount, error: countError } = await supabase
      .from("sports_facilities")
      .select("*", { count: "exact", head: true });

    if (countError) {
      throw countError;
    }

    console.log(`📊 Current facility count: ${beforeCount}\n`);

    // Fetch all facilities to analyze (handle pagination)
    console.log("🔍 Analyzing all facilities...");
    const allFacilities: any[] = [];
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from("sports_facilities")
        .select("place_id, name, sport_types")
        .range(from, from + pageSize - 1);

      if (error) throw error;

      if (data && data.length > 0) {
        allFacilities.push(...data);
        from += pageSize;
        console.log(`   Loaded ${allFacilities.length} facilities so far...`);

        if (data.length < pageSize) {
          hasMore = false;
        }
      } else {
        hasMore = false;
      }
    }

    console.log(`   Total loaded: ${allFacilities.length} facilities\n`);

    if (!allFacilities || allFacilities.length === 0) {
      console.log("✅ No facilities found. Nothing to clean up.");
      return;
    }

    // Find facilities to delete
    const facilitiesToDelete: string[] = [];
    const facilitiesToKeep: string[] = [];

    for (const facility of allFacilities) {
      const types = facility.sport_types as string[];

      // Check if facility has ANY athletic/sport type we want to keep
      const hasAthletic = types.some(type =>
        KEEP_TYPES.includes(type) ||
        type.includes("sport") ||
        type.includes("field") ||
        type.includes("court")
      );

      // Check if facility has ANY non-sport type
      const hasNonSport = types.some(type => NON_SPORT_TYPES.includes(type));

      // Delete if: has non-sport types AND no athletic types
      if (hasNonSport && !hasAthletic) {
        facilitiesToDelete.push(facility.place_id);
        console.log(`  🗑️  Will delete: ${facility.name} (types: ${types.join(", ")})`);
      } else {
        facilitiesToKeep.push(facility.place_id);
      }
    }

    console.log("\n" + "=".repeat(60));
    console.log("📊 Analysis Results:");
    console.log(`   Facilities to keep: ${facilitiesToKeep.length}`);
    console.log(`   Facilities to delete: ${facilitiesToDelete.length}`);
    console.log("=".repeat(60) + "\n");

    if (facilitiesToDelete.length === 0) {
      console.log("✅ No non-sport facilities found. Database is clean!");
      return;
    }

    // Delete facilities in batches of 100
    console.log("🗑️  Deleting non-sport facilities...\n");
    const batchSize = 100;
    let deletedCount = 0;

    for (let i = 0; i < facilitiesToDelete.length; i += batchSize) {
      const batch = facilitiesToDelete.slice(i, i + batchSize);

      const { error: deleteError } = await supabase
        .from("sports_facilities")
        .delete()
        .in("place_id", batch);

      if (deleteError) {
        console.error(`  ⚠️  Error deleting batch: ${deleteError.message}`);
        continue;
      }

      deletedCount += batch.length;
      console.log(`  ✅ Deleted ${deletedCount}/${facilitiesToDelete.length} facilities`);
    }

    // Get count after cleanup
    const { count: afterCount, error: afterCountError } = await supabase
      .from("sports_facilities")
      .select("*", { count: "exact", head: true });

    if (afterCountError) {
      throw afterCountError;
    }

    console.log("\n" + "=".repeat(60));
    console.log("🎉 Cleanup Complete!");
    console.log("=".repeat(60));
    console.log(`📊 Final Statistics:`);
    console.log(`   Before: ${beforeCount} facilities`);
    console.log(`   After: ${afterCount} facilities`);
    console.log(`   Deleted: ${beforeCount! - afterCount!} facilities`);
    console.log("=".repeat(60));

  } catch (error: any) {
    console.error("❌ Fatal error:", error.message);
    process.exit(1);
  }
}

// Run the cleanup
cleanupNonSportFacilities().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
