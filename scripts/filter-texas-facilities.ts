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
  hidden: boolean;
}

// Check if --execute flag is passed
const isExecuteMode = process.argv.includes("--execute");

/**
 * Check if a facility is in Texas based on its address
 */
function isTexasFacility(address: string): boolean {
  if (!address) return false;

  const lowerAddress = address.toLowerCase();

  // Check for ", TX" or ", Texas" in the address
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

async function filterTexasFacilities() {
  console.log("🗺️  Texas Facility Filter Script\n");
  console.log("=" .repeat(60));

  if (isExecuteMode) {
    console.log("⚠️  EXECUTE MODE: Will update database");
  } else {
    console.log("🔍 DRY-RUN MODE: Preview only (use --execute to apply changes)");
  }

  console.log("=" .repeat(60) + "\n");

  try {
    // Fetch all facilities
    console.log("📥 Fetching all facilities from database...\n");

    const { data: facilities, error } = await supabase
      .from("sports_facilities")
      .select("place_id, name, address, hidden")
      .order("name");

    if (error) {
      throw new Error(`Failed to fetch facilities: ${error.message}`);
    }

    if (!facilities || facilities.length === 0) {
      console.log("ℹ️  No facilities found in database.");
      return;
    }

    console.log(`✅ Found ${facilities.length} total facilities\n`);

    // Filter to find non-Texas facilities that aren't already hidden
    const nonTexasFacilities = facilities.filter(
      (facility: FacilityRecord) =>
        !isTexasFacility(facility.address) && !facility.hidden
    );

    console.log("=" .repeat(60));
    console.log("📊 Analysis Results:");
    console.log("=" .repeat(60));
    console.log(`  🏆 Texas facilities: ${facilities.length - nonTexasFacilities.length}`);
    console.log(`  🌎 Non-Texas facilities (to be hidden): ${nonTexasFacilities.length}`);
    console.log("=" .repeat(60) + "\n");

    if (nonTexasFacilities.length === 0) {
      console.log("✨ All facilities are already in Texas or hidden. Nothing to do!");
      return;
    }

    // Display non-Texas facilities
    console.log("🌎 Non-Texas Facilities to be Hidden:\n");
    nonTexasFacilities.forEach((facility: FacilityRecord, index: number) => {
      console.log(`  ${index + 1}. ${facility.name}`);
      console.log(`     📍 ${facility.address}`);
      console.log(`     🆔 ${facility.place_id}\n`);
    });

    console.log("=" .repeat(60) + "\n");

    // If dry-run mode, exit here
    if (!isExecuteMode) {
      console.log("💡 This was a dry-run. No changes were made to the database.");
      console.log("💡 To apply these changes, run with --execute flag:\n");
      console.log("   npm run filter:texas:execute\n");
      return;
    }

    // Execute mode - ask for confirmation
    console.log("⚠️  WARNING: You are about to mark these facilities as hidden.\n");
    const confirmed = await askConfirmation(
      `❓ Do you want to hide ${nonTexasFacilities.length} non-Texas facilities? (y/N): `
    );

    if (!confirmed) {
      console.log("\n❌ Operation cancelled by user.");
      return;
    }

    console.log("\n🔄 Updating facilities...\n");

    // Update facilities in batches
    const placeIds = nonTexasFacilities.map((f: FacilityRecord) => f.place_id);

    const { data, error: updateError } = await supabase
      .from("sports_facilities")
      .update({ hidden: true })
      .in("place_id", placeIds)
      .select();

    if (updateError) {
      throw new Error(`Failed to update facilities: ${updateError.message}`);
    }

    console.log("=" .repeat(60));
    console.log("✅ Update Complete!");
    console.log("=" .repeat(60));
    console.log(`  🙈 Hidden facilities: ${data?.length || 0}`);
    console.log("=" .repeat(60) + "\n");

    console.log("🎉 Successfully filtered non-Texas facilities!");
    console.log("\n💡 Tip: You can unhide facilities by updating hidden=false in the database\n");

  } catch (error: any) {
    console.error("\n❌ Fatal error:", error.message);
    process.exit(1);
  }
}

filterTexasFacilities().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
