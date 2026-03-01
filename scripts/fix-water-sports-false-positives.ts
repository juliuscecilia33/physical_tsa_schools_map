import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables
dotenv.config({ path: path.join(__dirname, "../.env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("❌ Error: Missing required environment variables");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Sport keywords for Rowing and Sailing
const ROWING_KEYWORDS = ["rowing"];
const SAILING_KEYWORDS = ["sailing"];

interface SportMetadata {
  score: number;
  sources: Array<"name" | "review" | "api" | "serp_review">;
  keywords_matched: string[];
  confidence: "high" | "medium" | "low";
  matched_text?: string | string[];
}

interface Review {
  author_name?: string;
  text?: string;
  snippet?: string;
  user?: {
    name: string;
  };
}

interface Facility {
  id: string;
  place_id: string;
  name: string;
  identified_sports: string[];
  sport_metadata: Record<string, SportMetadata>;
  reviews?: Review[];
  additional_reviews?: Review[];
}

/**
 * Find matching keywords in text using word boundaries
 * This prevents "rowing" from matching in "growing" or "throwing"
 */
function findMatchingKeywords(keywords: string[], text: string): string[] {
  const matched: string[] = [];

  for (const keyword of keywords) {
    // Use word boundary regex to match whole words only
    const regex = new RegExp(`\\b${keyword}\\b`, "i");
    if (regex.test(text)) {
      matched.push(keyword);
    }
  }

  return matched;
}

/**
 * Check if a sport is legitimately present in facility data
 */
function isSportLegitimate(
  sportKeywords: string[],
  facility: Facility
): boolean {
  // Check name
  const nameMatches = findMatchingKeywords(sportKeywords, facility.name);
  if (nameMatches.length > 0) {
    return true;
  }

  // Check regular reviews
  if (facility.reviews && facility.reviews.length > 0) {
    for (const review of facility.reviews) {
      const reviewText = review.text || "";
      const matches = findMatchingKeywords(sportKeywords, reviewText);
      if (matches.length > 0) {
        return true;
      }
    }
  }

  // Check additional reviews (SerpAPI)
  if (facility.additional_reviews && facility.additional_reviews.length > 0) {
    for (const review of facility.additional_reviews) {
      const reviewText = review.snippet || review.text || "";
      const matches = findMatchingKeywords(sportKeywords, reviewText);
      if (matches.length > 0) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Fix false positive sport identifications
 */
function fixFalsePositives(facility: Facility): {
  updated: boolean;
  removedSports: string[];
  restoredWaterSports: boolean;
  finalIdentifiedSports: string[];
  finalSportMetadata: Record<string, SportMetadata>;
} {
  const currentSports = new Set(facility.identified_sports);
  const currentMetadata = { ...facility.sport_metadata };
  const removedSports: string[] = [];
  let updated = false;

  // Check if Rowing is a false positive
  if (currentSports.has("Rowing")) {
    const isLegit = isSportLegitimate(ROWING_KEYWORDS, facility);
    if (!isLegit) {
      currentSports.delete("Rowing");
      delete currentMetadata["Rowing"];
      removedSports.push("Rowing");
      updated = true;
    }
  }

  // Check if Sailing is a false positive
  if (currentSports.has("Sailing")) {
    const isLegit = isSportLegitimate(SAILING_KEYWORDS, facility);
    if (!isLegit) {
      currentSports.delete("Sailing");
      delete currentMetadata["Sailing"];
      removedSports.push("Sailing");
      updated = true;
    }
  }

  // If we removed sports and there are no kayak/canoe water sports, restore "Water Sports"
  let restoredWaterSports = false;
  if (removedSports.length > 0 && !currentSports.has("Water Sports")) {
    // Check if facility originally had water sports indicators
    // (We can't know for sure, but we'll add it back since we removed rowing/sailing)
    currentSports.add("Water Sports");

    // Create basic metadata for restored Water Sports
    currentMetadata["Water Sports"] = {
      score: 30,
      sources: ["review"],
      keywords_matched: [],
      confidence: "low",
      matched_text: "Restored after removing false positive water sports",
    };

    restoredWaterSports = true;
    updated = true;
  }

  return {
    updated,
    removedSports,
    restoredWaterSports,
    finalIdentifiedSports: Array.from(currentSports),
    finalSportMetadata: currentMetadata,
  };
}

/**
 * Main script
 */
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const batchSize = parseInt(
    args.find((arg) => arg.startsWith("--batch-size="))?.split("=")[1] || "100"
  );
  const offset = parseInt(
    args.find((arg) => arg.startsWith("--offset="))?.split("=")[1] || "0"
  );

  console.log("🔧 Fixing Water Sports False Positives");
  console.log("================================================");
  console.log(`Mode: ${dryRun ? "DRY RUN (no database updates)" : "LIVE"}`);
  console.log(`Batch size: ${batchSize}`);
  console.log(`Starting offset: ${offset}`);
  console.log("");

  // Query facilities with Rowing or Sailing
  const { data: facilities, error } = await supabase
    .from("sports_facilities")
    .select(
      "id, place_id, name, identified_sports, sport_metadata, reviews, additional_reviews"
    )
    .or("identified_sports.cs.{Rowing},identified_sports.cs.{Sailing}")
    .range(offset, offset + batchSize - 1);

  if (error) {
    console.error("❌ Error fetching facilities:", error);
    process.exit(1);
  }

  if (!facilities || facilities.length === 0) {
    console.log("✅ No Rowing/Sailing facilities found to check");
    return;
  }

  console.log(`📊 Found ${facilities.length} facilities with Rowing/Sailing to validate\n`);

  // Statistics
  let processed = 0;
  let updated = 0;
  let rowingRemoved = 0;
  let sailingRemoved = 0;
  let waterSportsRestored = 0;
  let legitimate = 0;
  let errors = 0;

  for (const facility of facilities) {
    try {
      const result = fixFalsePositives(facility);

      processed++;

      if (result.updated) {
        updated++;

        if (result.removedSports.includes("Rowing")) {
          rowingRemoved++;
        }

        if (result.removedSports.includes("Sailing")) {
          sailingRemoved++;
        }

        if (result.restoredWaterSports) {
          waterSportsRestored++;
        }

        console.log(`\n🔧 ${facility.name}`);
        console.log(`   Place ID: ${facility.place_id}`);

        if (result.removedSports.length > 0) {
          console.log(
            `   ❌ Removed (false positives): ${result.removedSports.join(", ")}`
          );
        }

        if (result.restoredWaterSports) {
          console.log(`   ➕ Restored: Water Sports`);
        }

        // Show what sports remain
        const remainingSports = result.finalIdentifiedSports.filter(
          (s) => s !== "Water Sports"
        );
        if (remainingSports.length > 0) {
          console.log(`   ✅ Kept: ${remainingSports.join(", ")}`);
        }

        // Update database
        if (!dryRun) {
          const { error: updateError } = await supabase
            .from("sports_facilities")
            .update({
              identified_sports: result.finalIdentifiedSports,
              sport_metadata: result.finalSportMetadata,
            })
            .eq("place_id", facility.place_id);

          if (updateError) {
            console.error(`   ❌ Error updating facility: ${updateError.message}`);
            errors++;
          }
        }
      } else {
        legitimate++;
      }

      // Progress indicator
      if (processed % 10 === 0) {
        console.log(`\n📊 Progress: ${processed}/${facilities.length} facilities processed`);
      }
    } catch (err) {
      console.error(`❌ Error processing facility ${facility.name}:`, err);
      errors++;
    }
  }

  // Final statistics
  console.log("\n");
  console.log("================================================");
  console.log("📊 CLEANUP SUMMARY");
  console.log("================================================");
  console.log(`Facilities processed: ${processed}`);
  console.log(`Facilities corrected: ${updated}`);
  console.log(`Legitimate identifications: ${legitimate}`);
  console.log(`False positive "Rowing" removed: ${rowingRemoved}`);
  console.log(`False positive "Sailing" removed: ${sailingRemoved}`);
  console.log(`"Water Sports" restored: ${waterSportsRestored}`);
  console.log(`Errors: ${errors}`);
  console.log("");

  if (dryRun) {
    console.log("🔍 This was a DRY RUN - no changes were made to the database");
    console.log("   Run without --dry-run to apply changes");
  } else {
    console.log("✅ Database has been updated");
  }

  console.log("");
  console.log("💡 TIP: Run with --offset=" + (offset + batchSize) + " to process the next batch");
}

main().catch(console.error);
