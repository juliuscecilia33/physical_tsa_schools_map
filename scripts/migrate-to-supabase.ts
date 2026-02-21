import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import { Facility } from "../src/types/facility";

// Load environment variables
dotenv.config({ path: path.join(__dirname, "../.env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("❌ Error: Missing Supabase environment variables");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function migrateFacilities() {
  console.log("🚀 Starting migration of Houston facilities to Supabase\n");

  // Read the JSON file
  const filePath = path.join(__dirname, "../test-facilities-houston.json");
  const rawData = fs.readFileSync(filePath, "utf-8");
  const facilities: Facility[] = JSON.parse(rawData);

  console.log(`📊 Found ${facilities.length} facilities to migrate\n`);

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < facilities.length; i++) {
    const facility = facilities[i];

    try {
      // Transform facility data for Supabase
      const facilityData = {
        place_id: facility.place_id,
        name: facility.name,
        sport_types: facility.sport_types,
        address: facility.address,
        // Convert location to PostGIS POINT format
        location: `POINT(${facility.location.lng} ${facility.location.lat})`,
        phone: facility.phone,
        website: facility.website,
        rating: facility.rating,
        user_ratings_total: facility.user_ratings_total,
        reviews: facility.reviews || [],
        photo_references: facility.photo_references || [],
        opening_hours: facility.opening_hours || null,
        business_status: facility.business_status,
      };

      // Upsert facility (insert or update if place_id already exists)
      const { error } = await supabase
        .from("sports_facilities")
        .upsert(facilityData, { onConflict: "place_id" });

      if (error) {
        console.error(`  ❌ Error inserting ${facility.name}:`, error.message);
        errorCount++;
      } else {
        console.log(`  ✅ [${i + 1}/${facilities.length}] Migrated: ${facility.name}`);
        successCount++;
      }

      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error: any) {
      console.error(`  ❌ Error processing ${facility.name}:`, error.message);
      errorCount++;
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log("📊 Migration Summary:");
  console.log(`  ✅ Successfully migrated: ${successCount}`);
  console.log(`  ❌ Errors: ${errorCount}`);
  console.log("=".repeat(50) + "\n");

  if (successCount > 0) {
    console.log("🎉 Migration completed!");
    console.log(`\n💡 Tip: You can now query facilities from Supabase`);
  }
}

migrateFacilities().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
