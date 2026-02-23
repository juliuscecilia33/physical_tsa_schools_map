import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables
dotenv.config({ path: path.join(__dirname, "../.env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Error: Missing required environment variables");
  console.error("   Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

// Use service role key for admin operations
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ===== FACILITY VALIDATION CONSTANTS =====

// Unrelated facility types to filter out (government buildings, food, entertainment, lodging, shopping)
const UNRELATED_TYPES = [
  // Government buildings
  "courthouse",
  "local_government_office",
  "city_hall",
  "post_office",
  "embassy",
  // Food and dining
  "food",
  "restaurant",
  "cafe",
  "bar",
  "bakery",
  "meal_takeaway",
  // Lodging
  "lodging",
  "hotel",
  "motel",
  // Shopping
  "store",
  "clothing_store",
  "shopping_mall",
  "supermarket",
  "convenience_store",
  // Entertainment
  "amusement_park",
  "movie_theater",
  "aquarium",
  "museum",
  "art_gallery",
  "night_club",
  "casino",
  // Other
  "tourist_attraction",
  "library",
  "place_of_worship",
  "funeral_home",
  "car_dealer",
  "gas_station",
];

// Athletic facility types to keep (these override UNRELATED_TYPES)
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
  "school",
  "university",
];

interface Facility {
  id: string;
  place_id: string;
  name: string;
  sport_types: string[];
  identified_sports: string[] | null;
  photo_references: string[] | null;
  reviews: any[] | null;
  rating: number | null;
  user_ratings_total: number | null;
  cleaned_up: boolean;
}

interface CleanupStats {
  total: number;
  alreadyCleanedUp: number;
  unrelatedTypes: number;
  noPhotosOrReviews: number;
  protectedBySports: number;
  totalToCleanUp: number;
}

// ===== VALIDATION FUNCTIONS =====

/**
 * Check if facility has identified sports (protection criterion)
 */
function hasIdentifiedSports(facility: Facility): boolean {
  const identifiedSports = facility.identified_sports || [];
  return identifiedSports.length > 0;
}

/**
 * Check if facility has unrelated types and no athletic types
 */
function hasUnrelatedTypes(facility: Facility): boolean {
  const types = facility.sport_types || [];

  const hasAthletic = types.some(
    (type) =>
      KEEP_TYPES.includes(type) ||
      type.includes("sport") ||
      type.includes("field") ||
      type.includes("court")
  );

  const hasUnrelated = types.some((type) => UNRELATED_TYPES.includes(type));

  // Clean up if: has unrelated types AND no athletic types
  return hasUnrelated && !hasAthletic;
}

/**
 * Check if facility has no photos OR no reviews
 */
function hasNoPhotosOrReviews(facility: Facility): boolean {
  const hasNoPhotos = !facility.photo_references || facility.photo_references.length === 0;
  const hasNoReviews = !facility.reviews || facility.reviews.length === 0;

  // Clean up if: no photos OR no reviews (using OR logic as requested)
  return hasNoPhotos || hasNoReviews;
}

// ===== CLEANUP FUNCTIONS =====

/**
 * Load all facilities from database (paginated)
 */
async function loadAllFacilities(): Promise<Facility[]> {
  const facilities: Facility[] = [];
  const pageSize = 1000;
  let offset = 0;
  let hasMore = true;

  console.log("📥 Loading facilities from database...");

  while (hasMore) {
    const { data, error } = await supabase
      .from("sports_facilities")
      .select("id, place_id, name, sport_types, identified_sports, photo_references, reviews, rating, user_ratings_total, cleaned_up")
      .range(offset, offset + pageSize - 1);

    if (error) {
      console.error("❌ Error loading facilities:", error.message);
      throw error;
    }

    if (!data || data.length === 0) {
      hasMore = false;
      break;
    }

    facilities.push(...data);
    offset += pageSize;

    console.log(`   Loaded ${facilities.length} facilities...`);
  }

  console.log(`✅ Loaded ${facilities.length} total facilities\n`);
  return facilities;
}

/**
 * Analyze facilities and identify which ones to clean up
 */
function analyzeFacilities(facilities: Facility[]): {
  toCleanUp: Map<string, string[]>; // place_id -> reasons
  stats: CleanupStats;
} {
  console.log("🔍 Analyzing facilities...\n");

  const stats: CleanupStats = {
    total: facilities.length,
    alreadyCleanedUp: 0,
    unrelatedTypes: 0,
    noPhotosOrReviews: 0,
    protectedBySports: 0,
    totalToCleanUp: 0,
  };

  const toCleanUp = new Map<string, string[]>();

  for (const facility of facilities) {
    if (facility.cleaned_up) {
      stats.alreadyCleanedUp++;
      continue;
    }

    // PROTECTION CHECK: Skip if facility has identified sports
    if (hasIdentifiedSports(facility)) {
      stats.protectedBySports++;
      continue;
    }

    const reasons: string[] = [];

    // Check 1: Unrelated facility types
    if (hasUnrelatedTypes(facility)) {
      const unrelatedInFacility = (facility.sport_types || []).filter(type =>
        UNRELATED_TYPES.includes(type)
      );
      reasons.push(`Unrelated types: ${unrelatedInFacility.join(", ")}`);
      stats.unrelatedTypes++;
    }

    // Check 2: No photos or no reviews
    if (hasNoPhotosOrReviews(facility)) {
      const hasNoPhotos = !facility.photo_references || facility.photo_references.length === 0;
      const hasNoReviews = !facility.reviews || facility.reviews.length === 0;

      if (hasNoPhotos && hasNoReviews) {
        reasons.push("No photos AND no reviews");
      } else if (hasNoPhotos) {
        reasons.push("No photos");
      } else {
        reasons.push("No reviews");
      }
      stats.noPhotosOrReviews++;
    }

    if (reasons.length > 0) {
      toCleanUp.set(facility.place_id, reasons);
    }
  }

  stats.totalToCleanUp = toCleanUp.size;

  return { toCleanUp, stats };
}

/**
 * Mark facilities as cleaned_up in database
 */
async function cleanUpFacilities(facilitiesToCleanUp: Map<string, string[]>): Promise<number> {
  console.log(`\n🧹 Marking ${facilitiesToCleanUp.size} facilities as cleaned_up...\n`);

  const placeIds = Array.from(facilitiesToCleanUp.keys());
  const batchSize = 100;
  let cleanedUpCount = 0;

  for (let i = 0; i < placeIds.length; i += batchSize) {
    const batch = placeIds.slice(i, i + batchSize);

    const { error } = await supabase
      .from("sports_facilities")
      .update({ cleaned_up: true })
      .in("place_id", batch);

    if (error) {
      console.error(`❌ Error cleaning up batch ${i / batchSize + 1}:`, error.message);
      continue;
    }

    cleanedUpCount += batch.length;
    console.log(`   ✓ Cleaned up ${cleanedUpCount}/${placeIds.length} facilities`);
  }

  return cleanedUpCount;
}

/**
 * Generate a detailed report
 */
function generateReport(
  toCleanUp: Map<string, string[]>,
  stats: CleanupStats,
  facilities: Facility[]
): void {
  console.log("\n" + "=".repeat(60));
  console.log("📊 CLEANUP ANALYSIS REPORT");
  console.log("=".repeat(60));
  console.log(`\n📈 Statistics:`);
  console.log(`   Total facilities: ${stats.total}`);
  console.log(`   Already cleaned up: ${stats.alreadyCleanedUp}`);
  console.log(`   Active facilities: ${stats.total - stats.alreadyCleanedUp}`);
  console.log(`   Protected (has identified sports): ${stats.protectedBySports}`);
  console.log(`\n🔍 Facilities to clean up: ${stats.totalToCleanUp}`);
  console.log(`   - Unrelated types: ${stats.unrelatedTypes}`);
  console.log(`   - No photos or reviews: ${stats.noPhotosOrReviews}`);

  if (stats.totalToCleanUp > 0) {
    const percentage = ((stats.totalToCleanUp / (stats.total - stats.alreadyCleanedUp)) * 100).toFixed(1);
    console.log(`   - Percentage: ${percentage}%`);
  }

  // Show sample facilities to be cleaned up
  console.log(`\n📋 Sample facilities to clean up (first 10):`);
  const samples = Array.from(toCleanUp.entries()).slice(0, 10);

  for (const [placeId, reasons] of samples) {
    const facility = facilities.find((f) => f.place_id === placeId);
    if (facility) {
      console.log(`\n   • ${facility.name}`);
      console.log(`     Place ID: ${placeId}`);
      console.log(`     Types: ${facility.sport_types?.join(", ") || "none"}`);
      console.log(`     Photos: ${facility.photo_references?.length || 0}`);
      console.log(`     Reviews: ${facility.reviews?.length || 0}`);
      console.log(`     Rating: ${facility.rating || "N/A"} (${facility.user_ratings_total || 0} ratings)`);
      console.log(`     Identified sports: ${facility.identified_sports?.join(", ") || "none"}`);
      console.log(`     Reasons: ${reasons.join("; ")}`);
    }
  }

  console.log("\n" + "=".repeat(60) + "\n");
}

// ===== MAIN FUNCTION =====

async function cleanup() {
  console.log("🧹 Unrelated Facilities Cleanup Tool");
  console.log("=".repeat(60));
  console.log("This script will analyze and mark unrelated facilities:");
  console.log("  ✓ Government buildings (courthouse, local_government_office, etc.)");
  console.log("  ✓ Food/dining (restaurant, cafe, bar, etc.)");
  console.log("  ✓ Lodging (hotel, motel, etc.)");
  console.log("  ✓ Shopping (mall, store, etc.)");
  console.log("  ✓ Entertainment (movie theater, amusement park, etc.)");
  console.log("  ✓ Facilities with no photos OR no reviews");
  console.log("\n🛡️  Protection:");
  console.log("  ✓ Facilities with identified sports will be preserved");
  console.log('\n💡 Note: Facilities will be marked as "cleaned_up" (not deleted)');
  console.log('   The "hidden" column remains for manual customization.');
  console.log("=".repeat(60) + "\n");

  try {
    // Step 1: Load all facilities
    const facilities = await loadAllFacilities();

    // Step 2: Analyze and identify facilities to clean up
    const { toCleanUp, stats } = analyzeFacilities(facilities);

    // Step 3: Generate report
    generateReport(toCleanUp, stats, facilities);

    // Step 4: Confirm with user (if running interactively)
    if (stats.totalToCleanUp === 0) {
      console.log("✅ No facilities to clean up. Database is clean!");
      return;
    }

    console.log("⚠️  Ready to mark facilities as cleaned_up. Press Ctrl+C to cancel, or wait 5 seconds to proceed...");
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Step 5: Clean up facilities
    const cleanedUpCount = await cleanUpFacilities(toCleanUp);

    // Step 6: Final summary
    console.log("\n" + "=".repeat(60));
    console.log("✅ CLEANUP COMPLETE");
    console.log("=".repeat(60));
    console.log(`   Facilities marked as cleaned_up: ${cleanedUpCount}`);
    console.log(`   Database updated successfully`);
    console.log('   💡 "hidden" column remains available for manual use');
    console.log("=".repeat(60) + "\n");
  } catch (error: any) {
    console.error("\n❌ Fatal error:", error.message);
    process.exit(1);
  }
}

// Run cleanup
cleanup();
