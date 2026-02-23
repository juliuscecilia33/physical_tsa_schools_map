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

// Non-sport facility types to filter out
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
  "bowling_alley",
  "ice_skating_rink",
  "ski_resort",
  "playground",
];

// Athletic facility types to keep
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
];

// Generic park names that likely don't have sports facilities
const GENERIC_PARK_NAMES = [
  "city park",
  "memorial park",
  "community park",
  "neighborhood park",
  "pocket park",
  "dog park",
  "nature park",
  "linear park",
  "greenbelt",
  "greenway",
  "trail",
  "preserve",
];

// Quality thresholds
const MIN_RATING = 2.0;
const MIN_REVIEWS = 5;
const PROXIMITY_THRESHOLD_METERS = 50;

interface Facility {
  id: string;
  place_id: string;
  name: string;
  sport_types: string[];
  identified_sports: string[];
  rating: number | null;
  user_ratings_total: number | null;
  location: string;
  hidden: boolean;
  cleaned_up: boolean;
}

interface CleanupStats {
  total: number;
  alreadyCleanedUp: number;
  nonSportType: number;
  genericPark: number;
  lowQuality: number;
  duplicate: number;
  totalToCleanUp: number;
}

// ===== VALIDATION FUNCTIONS =====

/**
 * Check if facility has non-sport types and no athletic types
 */
function hasNonSportTypes(facility: Facility): boolean {
  const types = facility.sport_types || [];

  const hasAthletic = types.some(
    (type) =>
      KEEP_TYPES.includes(type) ||
      type.includes("sport") ||
      type.includes("field") ||
      type.includes("court")
  );

  const hasNonSport = types.some((type) => NON_SPORT_TYPES.includes(type));

  // Hide if: has non-sport types AND no athletic types
  return hasNonSport && !hasAthletic;
}

/**
 * Check if facility is a generic park with no identified sports
 */
function isGenericParkWithoutSports(facility: Facility): boolean {
  const types = facility.sport_types || [];
  const identifiedSports = facility.identified_sports || [];

  // Must be a park
  const isPark = types.includes("park");
  if (!isPark) return false;

  // Must have no identified sports
  if (identifiedSports.length > 0) return false;

  // Check if name is generic
  const nameLower = (facility.name || "").toLowerCase();
  const hasGenericName = GENERIC_PARK_NAMES.some((genericName) =>
    nameLower.includes(genericName)
  );

  return hasGenericName;
}

/**
 * Check if facility has low quality (poor rating and few reviews)
 */
function hasLowQuality(facility: Facility): boolean {
  const rating = facility.rating || 0;
  const reviews = facility.user_ratings_total || 0;

  // Hide if rating is low AND has few reviews
  return rating < MIN_RATING && reviews < MIN_REVIEWS;
}

/**
 * Parse location string to get lat/lng
 */
function parseLocation(locationString: string): { lat: number; lng: number } | null {
  if (!locationString) return null;

  // Location format: "POINT(lng lat)" or similar PostGIS format
  const match = locationString.match(/POINT\s*\(([0-9.-]+)\s+([0-9.-]+)\)/i);
  if (!match) return null;

  return {
    lng: parseFloat(match[1]),
    lat: parseFloat(match[2]),
  };
}

/**
 * Calculate distance between two points in meters using Haversine formula
 */
function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Calculate completeness score for a facility
 */
function calculateCompletenessScore(facility: Facility): number {
  let score = 0;

  if (facility.rating) score += 25;
  if (facility.user_ratings_total) {
    const reviewPoints = Math.min(25, (facility.user_ratings_total / 10) * 5);
    score += reviewPoints;
  }

  return Math.round(score);
}

/**
 * Find duplicate facilities within proximity threshold
 */
function findDuplicates(facilities: Facility[]): Map<string, string[]> {
  const duplicateMap = new Map<string, string[]>(); // placeId -> array of duplicate placeIds

  for (let i = 0; i < facilities.length; i++) {
    const facility1 = facilities[i];
    const loc1 = parseLocation(facility1.location);
    if (!loc1) continue;

    const duplicates: string[] = [];

    for (let j = i + 1; j < facilities.length; j++) {
      const facility2 = facilities[j];
      const loc2 = parseLocation(facility2.location);
      if (!loc2) continue;

      const distance = calculateDistance(loc1.lat, loc1.lng, loc2.lat, loc2.lng);

      if (distance <= PROXIMITY_THRESHOLD_METERS) {
        // Found a duplicate - determine which to keep
        const score1 = calculateCompletenessScore(facility1);
        const score2 = calculateCompletenessScore(facility2);

        // Keep the one with higher score, hide the other
        if (score1 >= score2) {
          duplicates.push(facility2.place_id);
        } else {
          // If facility2 is better, we should hide facility1
          // But we'll handle this in the main loop
          if (!duplicateMap.has(facility2.place_id)) {
            duplicateMap.set(facility2.place_id, [facility1.place_id]);
          } else {
            duplicateMap.get(facility2.place_id)!.push(facility1.place_id);
          }
        }
      }
    }

    if (duplicates.length > 0) {
      duplicateMap.set(facility1.place_id, duplicates);
    }
  }

  return duplicateMap;
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
      .select("id, place_id, name, sport_types, identified_sports, rating, user_ratings_total, location, hidden, cleaned_up")
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
    nonSportType: 0,
    genericPark: 0,
    lowQuality: 0,
    duplicate: 0,
    totalToCleanUp: 0,
  };

  const toCleanUp = new Map<string, string[]>();

  // First pass: check all facilities except duplicates
  for (const facility of facilities) {
    if (facility.cleaned_up) {
      stats.alreadyCleanedUp++;
      continue;
    }

    const reasons: string[] = [];

    // Check 1: Non-sport facility types
    if (hasNonSportTypes(facility)) {
      reasons.push("Non-sport facility type");
      stats.nonSportType++;
    }

    // Check 2: Generic park without sports
    if (isGenericParkWithoutSports(facility)) {
      reasons.push("Generic park with no identified sports");
      stats.genericPark++;
    }

    // Check 3: Low quality
    if (hasLowQuality(facility)) {
      reasons.push(`Low quality (rating: ${facility.rating || 0}, reviews: ${facility.user_ratings_total || 0})`);
      stats.lowQuality++;
    }

    if (reasons.length > 0) {
      toCleanUp.set(facility.place_id, reasons);
    }
  }

  // Second pass: find duplicates (only among facilities not already marked for cleanup)
  const facilitiesNotMarked = facilities.filter(
    (f) => !f.cleaned_up && !toCleanUp.has(f.place_id)
  );

  console.log(`   Checking for duplicates among ${facilitiesNotMarked.length} facilities...`);
  const duplicateMap = findDuplicates(facilitiesNotMarked);

  duplicateMap.forEach((hidePlaceIds, keepPlaceId) => {
    for (const hidePlaceId of hidePlaceIds) {
      const existing = toCleanUp.get(hidePlaceId) || [];
      existing.push(`Duplicate within ${PROXIMITY_THRESHOLD_METERS}m (keeping ${keepPlaceId})`);
      toCleanUp.set(hidePlaceId, existing);
      stats.duplicate++;
    }
  });

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
  console.log(`\n🔍 Facilities to clean up: ${stats.totalToCleanUp}`);
  console.log(`   - Non-sport types: ${stats.nonSportType}`);
  console.log(`   - Generic parks: ${stats.genericPark}`);
  console.log(`   - Low quality: ${stats.lowQuality}`);
  console.log(`   - Duplicates: ${stats.duplicate}`);

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
      console.log(`     Rating: ${facility.rating || "N/A"} (${facility.user_ratings_total || 0} reviews)`);
      console.log(`     Reasons: ${reasons.join("; ")}`);
    }
  }

  console.log("\n" + "=".repeat(60) + "\n");
}

// ===== MAIN FUNCTION =====

async function cleanup() {
  console.log("🧹 Low-Quality Facilities Cleanup Tool");
  console.log("=".repeat(60));
  console.log("This script will analyze and mark low-quality facilities:");
  console.log("  ✓ Non-sport facility types");
  console.log("  ✓ Generic parks with no identified sports");
  console.log(`  ✓ Low quality (rating < ${MIN_RATING}, reviews < ${MIN_REVIEWS})`);
  console.log(`  ✓ Duplicates within ${PROXIMITY_THRESHOLD_METERS}m`);
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
