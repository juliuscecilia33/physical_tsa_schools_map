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

// New sport keywords for Rowing and Sailing
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
  // Google Places API fields
  author_name?: string;
  text?: string;

  // SerpAPI fields
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
 * Find matching keywords in text
 */
function findMatchingKeywords(keywords: string[], text: string): string[] {
  const matched: string[] = [];

  for (const keyword of keywords) {
    // Use word boundary regex to match whole words only
    // This prevents "rowing" from matching in "growing" or "throwing"
    const regex = new RegExp(`\\b${keyword}\\b`, "i");
    if (regex.test(text)) {
      matched.push(keyword);
    }
  }

  return matched;
}

/**
 * Calculate score based on source and position
 */
function calculateScore(
  source: "name" | "review" | "serp_review",
  position: number = 0,
  keywordCount: number = 1
): number {
  if (source === "name") {
    // Name matches get highest score: 85-100
    return 85 + Math.min(15, keywordCount * 5);
  } else if (source === "serp_review") {
    // SERP review matches: 30-55 based on position
    const positionBonus = Math.max(0, 15 - Math.floor(position / 4));
    const keywordBonus = Math.min(10, keywordCount * 2);
    return 30 + positionBonus + keywordBonus;
  } else {
    // Regular review matches: 25-50 based on position
    const positionBonus = Math.max(0, 15 - Math.floor(position / 2));
    const keywordBonus = Math.min(10, keywordCount * 2);
    return 25 + positionBonus + keywordBonus;
  }
}

/**
 * Identify a specific sport from facility data
 */
function identifySport(
  sportName: string,
  keywords: string[],
  facility: Facility
): SportMetadata | null {
  const matchedSources: Array<"name" | "review" | "serp_review"> = [];
  const allKeywordsMatched = new Set<string>();
  const matchedReviews: string[] = [];
  let highestScore = 0;
  let matchedText: string | string[] = "";

  // Check name
  const nameMatches = findMatchingKeywords(keywords, facility.name);
  if (nameMatches.length > 0) {
    matchedSources.push("name");
    nameMatches.forEach((k) => allKeywordsMatched.add(k));
    const score = calculateScore("name", 0, nameMatches.length);
    highestScore = Math.max(highestScore, score);
    matchedText = facility.name;
  }

  // Check regular reviews (Google Places, up to 5)
  if (facility.reviews && facility.reviews.length > 0) {
    facility.reviews.forEach((review, idx) => {
      const reviewText = review.text || "";
      const matches = findMatchingKeywords(keywords, reviewText);
      if (matches.length > 0) {
        if (!matchedSources.includes("review")) {
          matchedSources.push("review");
        }
        matches.forEach((k) => allKeywordsMatched.add(k));
        const score = calculateScore("review", idx, matches.length);
        if (score > highestScore) {
          highestScore = score;
          if (!matchedSources.includes("name")) {
            matchedText = reviewText;
          }
        }
      }
    });
  }

  // Check additional reviews (SerpAPI, can be 50+)
  if (facility.additional_reviews && facility.additional_reviews.length > 0) {
    facility.additional_reviews.forEach((review, idx) => {
      const reviewText = review.snippet || review.text || "";
      const matches = findMatchingKeywords(keywords, reviewText);
      if (matches.length > 0) {
        if (!matchedSources.includes("serp_review")) {
          matchedSources.push("serp_review");
        }
        matches.forEach((k) => allKeywordsMatched.add(k));
        matchedReviews.push(reviewText);
        const score = calculateScore("serp_review", idx, matches.length);
        highestScore = Math.max(highestScore, score);
      }
    });

    // If we found SERP review matches, store all matching reviews
    if (matchedReviews.length > 0 && !matchedSources.includes("name")) {
      matchedText = matchedReviews;
    }
  }

  // If no matches found, return null
  if (allKeywordsMatched.size === 0) {
    return null;
  }

  // Determine confidence based on score
  const confidence =
    highestScore >= 70 ? "high" : highestScore >= 30 ? "medium" : "low";

  return {
    score: highestScore,
    sources: matchedSources,
    keywords_matched: Array.from(allKeywordsMatched),
    confidence,
    matched_text: matchedText,
  };
}

/**
 * Reanalyze a Water Sports facility to separate into Rowing and/or Sailing
 */
function reanalyzeFacility(facility: Facility): {
  updated: boolean;
  addedSports: string[];
  removedWaterSports: boolean;
  finalIdentifiedSports: string[];
  finalSportMetadata: Record<string, SportMetadata>;
} {
  const currentSports = new Set(facility.identified_sports);
  const currentMetadata = { ...facility.sport_metadata };

  // Identify Rowing
  const rowingMetadata = identifySport("Rowing", ROWING_KEYWORDS, facility);

  // Identify Sailing
  const sailingMetadata = identifySport("Sailing", SAILING_KEYWORDS, facility);

  const addedSports: string[] = [];
  let updated = false;
  let removedWaterSports = false;

  // If we found Rowing or Sailing, remove Water Sports and add the specific sports
  if (rowingMetadata || sailingMetadata) {
    // Remove Water Sports
    if (currentSports.has("Water Sports")) {
      currentSports.delete("Water Sports");
      delete currentMetadata["Water Sports"];
      removedWaterSports = true;
      updated = true;
    }

    // Add Rowing
    if (rowingMetadata) {
      currentSports.add("Rowing");
      currentMetadata["Rowing"] = rowingMetadata;
      addedSports.push("Rowing");
      updated = true;
    }

    // Add Sailing
    if (sailingMetadata) {
      currentSports.add("Sailing");
      currentMetadata["Sailing"] = sailingMetadata;
      addedSports.push("Sailing");
      updated = true;
    }
  }

  return {
    updated,
    addedSports,
    removedWaterSports,
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

  console.log("🔄 Reanalyzing Water Sports Facilities");
  console.log("================================================");
  console.log(`Mode: ${dryRun ? "DRY RUN (no database updates)" : "LIVE"}`);
  console.log(`Batch size: ${batchSize}`);
  console.log(`Starting offset: ${offset}`);
  console.log("");

  // Query facilities with Water Sports that have been SERP scraped
  const { data: facilities, error } = await supabase
    .from("sports_facilities")
    .select(
      "id, place_id, name, identified_sports, sport_metadata, reviews, additional_reviews"
    )
    .eq("serp_scraped", true)
    .contains("identified_sports", ["Water Sports"])
    .range(offset, offset + batchSize - 1);

  if (error) {
    console.error("❌ Error fetching facilities:", error);
    process.exit(1);
  }

  if (!facilities || facilities.length === 0) {
    console.log("✅ No Water Sports facilities found to reanalyze");
    return;
  }

  console.log(`📊 Found ${facilities.length} Water Sports facilities to reanalyze\n`);

  // Statistics
  let processed = 0;
  let updated = 0;
  let rowingAdded = 0;
  let sailingAdded = 0;
  let waterSportsRemoved = 0;
  let unchanged = 0;
  let errors = 0;

  for (const facility of facilities) {
    try {
      const result = reanalyzeFacility(facility);

      processed++;

      if (result.updated) {
        updated++;

        if (result.removedWaterSports) {
          waterSportsRemoved++;
        }

        if (result.addedSports.includes("Rowing")) {
          rowingAdded++;
        }

        if (result.addedSports.includes("Sailing")) {
          sailingAdded++;
        }

        console.log(`\n✨ ${facility.name}`);
        console.log(`   Place ID: ${facility.place_id}`);

        if (result.removedWaterSports) {
          console.log(`   ➖ Removed: Water Sports`);
        }

        if (result.addedSports.length > 0) {
          console.log(`   ➕ Added: ${result.addedSports.join(", ")}`);
        }

        // Show evidence for added sports
        result.addedSports.forEach((sport) => {
          const meta = result.finalSportMetadata[sport];
          console.log(`   📝 Evidence for ${sport}:`);
          console.log(`      Score: ${meta.score}, Confidence: ${meta.confidence}`);
          console.log(`      Sources: ${meta.sources.join(", ")}`);
          console.log(`      Keywords: ${meta.keywords_matched.join(", ")}`);
          if (Array.isArray(meta.matched_text)) {
            console.log(`      ${meta.matched_text.length} matching review(s)`);
          } else if (meta.matched_text) {
            console.log(`      Matched in: ${meta.sources[0]}`);
          }
        });

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
        unchanged++;
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
  console.log("📊 REANALYSIS SUMMARY");
  console.log("================================================");
  console.log(`Facilities processed: ${processed}`);
  console.log(`Facilities updated: ${updated}`);
  console.log(`Facilities unchanged: ${unchanged}`);
  console.log(`"Water Sports" removed: ${waterSportsRemoved}`);
  console.log(`"Rowing" added: ${rowingAdded}`);
  console.log(`"Sailing" added: ${sailingAdded}`);
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
