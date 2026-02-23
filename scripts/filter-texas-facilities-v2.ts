import { createClient } from "@supabase/supabase-js";
import * as path from "path";
import * as dotenv from "dotenv";
import * as readline from "readline";

// Load environment variables
dotenv.config({ path: path.join(__dirname, "../.env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("❌ Error: Missing Supabase environment variables");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface FacilityRecord {
  place_id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  hidden: boolean;
}

// Texas geographic boundaries
const TEXAS_BOUNDS = {
  minLat: 25.8,
  maxLat: 36.5,
  minLng: -106.6,
  maxLng: -93.5,
};

// Parse command line arguments
const args = process.argv.slice(2);
const isExecuteMode = args.includes("--execute");
const isCompareMode = args.includes("--compare");

/**
 * Check if a facility is in Texas based on geographic coordinates
 */
function isTexasFacilityByGeo(latitude: number, longitude: number): boolean {
  return (
    latitude >= TEXAS_BOUNDS.minLat &&
    latitude <= TEXAS_BOUNDS.maxLat &&
    longitude >= TEXAS_BOUNDS.minLng &&
    longitude <= TEXAS_BOUNDS.maxLng
  );
}

/**
 * OLD METHOD: Check if a facility is in Texas based on address text
 */
function isTexasFacilityByAddress(address: string): boolean {
  if (!address) return false;
  const lowerAddress = address.toLowerCase();
  return lowerAddress.includes(", tx") || lowerAddress.includes(", texas");
}

/**
 * Prompt user for confirmation
 */
function askConfirmation(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
    });
  });
}

/**
 * Calculate distance from point to nearest Texas border (approximate)
 */
function distanceFromTexasBorder(lat: number, lng: number): number {
  const latDist = Math.max(
    0,
    TEXAS_BOUNDS.minLat - lat,
    lat - TEXAS_BOUNDS.maxLat
  );
  const lngDist = Math.max(
    0,
    TEXAS_BOUNDS.minLng - lng,
    lng - TEXAS_BOUNDS.maxLng
  );

  // Rough approximation: 1 degree ≈ 69 miles
  return Math.sqrt(latDist * latDist + lngDist * lngDist) * 69;
}

async function filterTexasFacilitiesV2() {
  console.log("🗺️  Texas Facility Filter v2.0 (Geographic Bounds)\n");
  console.log("=".repeat(60));

  if (isCompareMode) {
    console.log("🔬 COMPARE MODE: Analyzing detection method differences");
  } else if (isExecuteMode) {
    console.log("⚠️  EXECUTE MODE: Will update database");
  } else {
    console.log("🔍 DRY-RUN MODE: Preview only (use --execute to apply)");
  }

  console.log("=".repeat(60) + "\n");

  try {
    // Fetch all facilities with coordinates
    console.log("📥 Fetching all facilities with coordinates...\n");

    const { data: rawData, error } = await supabase.rpc(
      "get_facilities_with_coords",
      {
        row_limit: 20000,
        include_hidden: true, // Fetch all facilities including hidden ones
      }
    );

    if (error) {
      throw new Error(`Failed to fetch facilities: ${error.message}`);
    }

    if (!rawData || rawData.length === 0) {
      console.log("ℹ️  No facilities found in database.");
      return;
    }

    // Transform data to our interface
    const facilities: FacilityRecord[] = rawData.map((f: any) => ({
      place_id: f.place_id,
      name: f.name,
      address: f.address,
      latitude: f.lat, // RPC returns 'lat' not 'latitude'
      longitude: f.lng, // RPC returns 'lng' not 'longitude'
      hidden: f.hidden || false,
    }));

    console.log(`✅ Found ${facilities.length} total facilities\n`);

    // Filter using GEOGRAPHIC bounds
    const nonTexasByGeo = facilities.filter(
      (f) => !isTexasFacilityByGeo(f.latitude, f.longitude) && !f.hidden
    );

    // Filter using OLD address method
    const nonTexasByAddress = facilities.filter(
      (f) => !isTexasFacilityByAddress(f.address) && !f.hidden
    );

    if (isCompareMode) {
      // COMPARISON MODE
      console.log("=".repeat(60));
      console.log("🔬 METHOD COMPARISON:");
      console.log("=".repeat(60));
      console.log(
        `  📝 Old method (address text): ${nonTexasByAddress.length} non-TX facilities`
      );
      console.log(
        `  🌍 New method (geo bounds):  ${nonTexasByGeo.length} non-TX facilities`
      );
      console.log(
        `  📊 Difference:              ${nonTexasByGeo.length - nonTexasByAddress.length} additional facilities found`
      );
      console.log("=".repeat(60) + "\n");

      // Find facilities caught by new method but missed by old
      const missedByOldMethod = nonTexasByGeo.filter(
        (geoFacility) =>
          !nonTexasByAddress.some(
            (addrFacility) => addrFacility.place_id === geoFacility.place_id
          )
      );

      if (missedByOldMethod.length > 0) {
        console.log(
          `🚨 MISSED BY OLD METHOD (${missedByOldMethod.length} facilities):\n`
        );
        console.log(
          "These facilities were NOT detected by address-based filtering:\n"
        );

        missedByOldMethod
          .sort((a, b) => {
            const distA = distanceFromTexasBorder(a.latitude, a.longitude);
            const distB = distanceFromTexasBorder(b.latitude, b.longitude);
            return distB - distA;
          })
          .forEach((facility, index) => {
            const distance = distanceFromTexasBorder(
              facility.latitude,
              facility.longitude
            );
            console.log(`  ${index + 1}. ${facility.name}`);
            console.log(`     📍 ${facility.address}`);
            console.log(
              `     🗺️  Lat: ${facility.latitude.toFixed(4)}, Lng: ${facility.longitude.toFixed(4)}`
            );
            console.log(`     📏 ~${distance.toFixed(1)} miles from TX border`);
            console.log(`     🆔 ${facility.place_id}\n`);
          });
      }

      // Find facilities caught by old method but NOT by new (anomalies)
      const anomalies = nonTexasByAddress.filter(
        (addrFacility) =>
          !nonTexasByGeo.some(
            (geoFacility) => geoFacility.place_id === addrFacility.place_id
          )
      );

      if (anomalies.length > 0) {
        console.log(
          "=".repeat(60) +
            "\n⚠️  ANOMALIES: Caught by address method but IN Texas bounds:\n"
        );
        anomalies.forEach((facility, index) => {
          console.log(`  ${index + 1}. ${facility.name}`);
          console.log(`     📍 ${facility.address}`);
          console.log(
            `     🗺️  Lat: ${facility.latitude.toFixed(4)}, Lng: ${facility.longitude.toFixed(4)}`
          );
          console.log(`     ⚠️  Geographic coords ARE in Texas!`);
          console.log(`     🆔 ${facility.place_id}\n`);
        });
      }

      console.log("=".repeat(60));
      console.log("💡 RECOMMENDATION:");
      console.log(
        "   Use the NEW geographic method for accurate Texas detection."
      );
      console.log(
        `   This will correctly identify all ${nonTexasByGeo.length} non-Texas facilities.`
      );
      console.log("=".repeat(60) + "\n");

      return;
    }

    // STANDARD MODE (dry-run or execute)
    console.log("=".repeat(60));
    console.log("📊 Analysis Results (Geographic Bounds Method):");
    console.log("=".repeat(60));
    console.log(
      `  🏆 Texas facilities: ${facilities.length - nonTexasByGeo.length}`
    );
    console.log(
      `  🌎 Non-Texas facilities (to be hidden): ${nonTexasByGeo.length}`
    );
    console.log("=".repeat(60) + "\n");

    if (nonTexasByGeo.length === 0) {
      console.log(
        "✨ All facilities are already in Texas or hidden. Nothing to do!"
      );
      return;
    }

    // Group by state/region
    const byDistance = nonTexasByGeo
      .map((f) => ({
        ...f,
        distance: distanceFromTexasBorder(f.latitude, f.longitude),
      }))
      .sort((a, b) => b.distance - a.distance);

    console.log("🌎 Non-Texas Facilities (sorted by distance from border):\n");

    byDistance.forEach((facility, index) => {
      console.log(`  ${index + 1}. ${facility.name}`);
      console.log(`     📍 ${facility.address}`);
      console.log(
        `     🗺️  Lat: ${facility.latitude.toFixed(4)}, Lng: ${facility.longitude.toFixed(4)}`
      );
      console.log(
        `     📏 ~${facility.distance.toFixed(1)} miles from TX border`
      );
      console.log(`     🆔 ${facility.place_id}\n`);
    });

    console.log("=".repeat(60) + "\n");

    // If dry-run mode, exit here
    if (!isExecuteMode) {
      console.log(
        "💡 This was a dry-run. No changes were made to the database."
      );
      console.log("💡 To apply these changes, run with --execute flag:\n");
      console.log("   npm run filter:texas:v2:execute\n");
      console.log("💡 To compare with old address-based method:\n");
      console.log("   npm run filter:texas:v2:compare\n");
      return;
    }

    // Execute mode - ask for confirmation
    console.log("⚠️  WARNING: You are about to mark these facilities as hidden.\n");
    const confirmed = await askConfirmation(
      `❓ Do you want to hide ${nonTexasByGeo.length} non-Texas facilities? (y/N): `
    );

    if (!confirmed) {
      console.log("\n❌ Operation cancelled by user.");
      return;
    }

    console.log("\n🔄 Updating facilities...\n");

    // Update facilities in batches
    const placeIds = nonTexasByGeo.map((f) => f.place_id);

    const { data, error: updateError } = await supabase
      .from("sports_facilities")
      .update({ hidden: true })
      .in("place_id", placeIds)
      .select();

    if (updateError) {
      throw new Error(`Failed to update facilities: ${updateError.message}`);
    }

    console.log("=".repeat(60));
    console.log("✅ Update Complete!");
    console.log("=".repeat(60));
    console.log(`  🙈 Hidden facilities: ${data?.length || 0}`);
    console.log("=".repeat(60) + "\n");

    console.log("🎉 Successfully filtered non-Texas facilities!");
    console.log(
      "\n💡 Tip: You can unhide facilities by updating hidden=false in the database\n"
    );
  } catch (error: any) {
    console.error("\n❌ Fatal error:", error.message);
    process.exit(1);
  }
}

filterTexasFacilitiesV2().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
