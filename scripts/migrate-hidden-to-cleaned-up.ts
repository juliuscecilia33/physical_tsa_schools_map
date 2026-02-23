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

interface MigrationStats {
  totalFacilities: number;
  currentlyHidden: number;
  migrated: number;
  errors: number;
}

async function getTotalFacilities(): Promise<number> {
  const { count, error } = await supabase
    .from("sports_facilities")
    .select("*", { count: "exact", head: true });

  if (error) {
    console.error("❌ Error getting total count:", error.message);
    return 0;
  }

  return count || 0;
}

async function getHiddenFacilities(): Promise<any[]> {
  const facilities: any[] = [];
  const pageSize = 1000;
  let offset = 0;
  let hasMore = true;

  console.log("📥 Loading hidden facilities...");

  while (hasMore) {
    const { data, error } = await supabase
      .from("sports_facilities")
      .select("id, place_id, name, hidden")
      .eq("hidden", true)
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

    console.log(`   Loaded ${facilities.length} hidden facilities...`);
  }

  return facilities;
}

async function migrateFacilities(facilities: any[]): Promise<number> {
  console.log(`\n🔄 Migrating ${facilities.length} facilities...\n`);

  const batchSize = 100;
  let migratedCount = 0;
  let errorCount = 0;

  for (let i = 0; i < facilities.length; i += batchSize) {
    const batch = facilities.slice(i, i + batchSize);
    const placeIds = batch.map((f) => f.place_id);

    try {
      // Set cleaned_up = true and hidden = false for this batch
      const { error } = await supabase
        .from("sports_facilities")
        .update({
          cleaned_up: true,
          hidden: false,
        })
        .in("place_id", placeIds);

      if (error) {
        console.error(
          `❌ Error migrating batch ${i / batchSize + 1}:`,
          error.message
        );
        errorCount += batch.length;
        continue;
      }

      migratedCount += batch.length;
      console.log(`   ✓ Migrated ${migratedCount}/${facilities.length} facilities`);
    } catch (error: any) {
      console.error(
        `❌ Error processing batch ${i / batchSize + 1}:`,
        error.message
      );
      errorCount += batch.length;
    }
  }

  if (errorCount > 0) {
    console.log(`\n⚠️  ${errorCount} facilities encountered errors`);
  }

  return migratedCount;
}

async function verifyMigration(): Promise<{
  stillHidden: number;
  cleanedUp: number;
}> {
  console.log("\n🔍 Verifying migration...");

  // Count facilities still marked as hidden
  const { count: hiddenCount, error: hiddenError } = await supabase
    .from("sports_facilities")
    .select("*", { count: "exact", head: true })
    .eq("hidden", true);

  if (hiddenError) {
    console.error("❌ Error checking hidden count:", hiddenError.message);
  }

  // Count facilities marked as cleaned_up
  const { count: cleanedUpCount, error: cleanedUpError } = await supabase
    .from("sports_facilities")
    .select("*", { count: "exact", head: true })
    .eq("cleaned_up", true);

  if (cleanedUpError) {
    console.error(
      "❌ Error checking cleaned_up count:",
      cleanedUpError.message
    );
  }

  return {
    stillHidden: hiddenCount || 0,
    cleanedUp: cleanedUpCount || 0,
  };
}

async function migrate() {
  console.log("🔄 Hidden → Cleaned Up Migration");
  console.log("=".repeat(60));
  console.log("This script will:");
  console.log("  1. Find all facilities where hidden = true");
  console.log("  2. Set cleaned_up = true for those facilities");
  console.log("  3. Set hidden = false (reset for manual use)");
  console.log("=".repeat(60) + "\n");

  const stats: MigrationStats = {
    totalFacilities: 0,
    currentlyHidden: 0,
    migrated: 0,
    errors: 0,
  };

  try {
    // Step 1: Get total facilities count
    stats.totalFacilities = await getTotalFacilities();
    console.log(`📊 Total facilities in database: ${stats.totalFacilities}\n`);

    // Step 2: Get all hidden facilities
    const hiddenFacilities = await getHiddenFacilities();
    stats.currentlyHidden = hiddenFacilities.length;

    console.log(`✅ Found ${stats.currentlyHidden} hidden facilities\n`);

    if (stats.currentlyHidden === 0) {
      console.log("✅ No hidden facilities to migrate!");
      return;
    }

    // Show sample of facilities to be migrated
    console.log("📋 Sample facilities to migrate (first 5):");
    hiddenFacilities.slice(0, 5).forEach((f, i) => {
      console.log(`   ${i + 1}. ${f.name} (${f.place_id})`);
    });
    console.log("");

    // Step 3: Confirm
    console.log("⚠️  Ready to migrate. Press Ctrl+C to cancel, or wait 5 seconds to proceed...");
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Step 4: Migrate
    stats.migrated = await migrateFacilities(hiddenFacilities);

    // Step 5: Verify
    const verification = await verifyMigration();

    // Step 6: Final report
    console.log("\n" + "=".repeat(60));
    console.log("✅ MIGRATION COMPLETE");
    console.log("=".repeat(60));
    console.log(`📊 Statistics:`);
    console.log(`   Total facilities: ${stats.totalFacilities}`);
    console.log(`   Previously hidden: ${stats.currentlyHidden}`);
    console.log(`   Successfully migrated: ${stats.migrated}`);
    console.log(`\n📈 Verification:`);
    console.log(`   Facilities still hidden: ${verification.stillHidden}`);
    console.log(`   Facilities marked cleaned_up: ${verification.cleanedUp}`);

    if (verification.stillHidden === 0 && verification.cleanedUp === stats.migrated) {
      console.log(`\n✅ Migration successful! All hidden facilities moved to cleaned_up.`);
      console.log(`\n💡 The "hidden" column is now available for manual customization.`);
    } else if (verification.stillHidden > 0) {
      console.log(
        `\n⚠️  Warning: ${verification.stillHidden} facilities are still marked as hidden.`
      );
    }

    console.log("=".repeat(60) + "\n");
  } catch (error: any) {
    console.error("\n❌ Fatal error:", error.message);
    process.exit(1);
  }
}

// Run migration
migrate();
