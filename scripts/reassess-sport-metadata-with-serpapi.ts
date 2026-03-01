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

// Sport keywords organized by sport type (same as identify-facility-sports.ts)
const SPORT_KEYWORDS = {
  // Core Sports
  Basketball: ["basketball", "bball", "hoops"],
  Soccer: ["soccer", "futbol"],
  Baseball: ["baseball", "diamond"],
  Football: ["football", "gridiron"],
  Tennis: ["tennis"],
  Volleyball: ["volleyball", "vball"],
  Swimming: ["swimming", "pool", "aquatic", "natatorium"],
  "Track & Field": ["track", "track and field", "athletics"],

  // Extended Sports
  Golf: ["golf", "putting green", "driving range"],
  Hockey: ["hockey", "ice rink"],
  Lacrosse: ["lacrosse", "lax"],
  Softball: ["softball"],
  Wrestling: ["wrestling", "mat room"],
  Gymnastics: ["gymnastics", "tumbling"],
  Pickleball: ["pickleball"],
  Racquetball: ["racquetball"],
  Squash: ["squash court"],
  Badminton: ["badminton"],

  // Fitness Activities
  "Gym/Fitness": ["gym", "fitness", "24 hour fitness", "la fitness", "anytime fitness", "planet fitness", "gold's gym", "lifetime fitness"],
  CrossFit: ["crossfit"],
  Yoga: ["yoga"],
  Pilates: ["pilates"],
  "Martial Arts": ["martial arts", "karate", "taekwondo", "jiu jitsu", "bjj", "judo", "kickboxing", "mma"],
  Boxing: ["boxing"],

  // Other Sports
  Bowling: ["bowling"],
  Skating: ["skating", "skate park", "roller"],
  Climbing: ["climbing", "bouldering"],
  Rowing: ["rowing"],
  Sailing: ["sailing"],
  "Water Sports": ["kayak", "canoe"],
};

interface SportMetadata {
  score: number;
  sources: Array<'name' | 'review' | 'api' | 'serp_review'>;
  keywords_matched: string[];
  confidence: 'high' | 'medium' | 'low';
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
  identified_sports?: string[];
  sport_metadata?: Record<string, SportMetadata>;
  additional_reviews?: Review[];
}

/**
 * Find matching keywords in text and return full review text
 */
function findMatchingKeywordsInReview(
  sport: string,
  reviewText: string
): { keywords: string[]; fullReview: string } {
  const keywords = SPORT_KEYWORDS[sport as keyof typeof SPORT_KEYWORDS] || [];
  const matched: string[] = [];

  for (const keyword of keywords) {
    // Use word boundary regex to match whole words only
    // This prevents "rowing" from matching in "growing" or "throwing"
    const regex = new RegExp(`\\b${keyword}\\b`, "i");
    if (regex.test(reviewText)) {
      matched.push(keyword);
    }
  }

  return { keywords: matched, fullReview: reviewText };
}

/**
 * Calculate confidence score for serp_review matches
 */
function calculateSerpReviewScore(
  keywordCount: number,
  reviewPosition: number
): number {
  // Base score: 30-55 based on review position (earlier reviews = higher score)
  const positionBonus = Math.max(0, 15 - Math.floor(reviewPosition / 4));
  const keywordBonus = Math.min(10, keywordCount * 2);
  return 30 + positionBonus + keywordBonus;
}

/**
 * Analyze additional_reviews from SerpAPI to identify sports
 */
function identifySportsFromAdditionalReviews(
  additionalReviews: Review[] | undefined
): {
  sports: string[];
  metadata: Record<string, SportMetadata>;
} {
  const sportsFound = new Set<string>();
  const metadata: Record<string, SportMetadata> = {};

  if (!additionalReviews || additionalReviews.length === 0) {
    return { sports: Array.from(sportsFound), metadata };
  }

  // Map to store all matching reviews for each sport
  const sportReviewsMap: Record<string, string[]> = {};

  // Check each sport against all additional_reviews
  for (const [sport, _keywords] of Object.entries(SPORT_KEYWORDS)) {
    const matchingReviews: string[] = [];

    // Check all additional reviews
    for (let i = 0; i < additionalReviews.length; i++) {
      const review = additionalReviews[i];
      const reviewText = review.snippet || review.text || "";

      if (!reviewText) continue;

      const match = findMatchingKeywordsInReview(sport, reviewText);

      if (match.keywords.length > 0) {
        matchingReviews.push(match.fullReview);
      }
    }

    // If we found matching reviews, add this sport
    if (matchingReviews.length > 0) {
      sportsFound.add(sport);
      sportReviewsMap[sport] = matchingReviews;

      // Calculate score based on first matching review position
      const firstMatchIndex = additionalReviews.findIndex(r => {
        const text = r.snippet || r.text || "";
        return findMatchingKeywordsInReview(sport, text).keywords.length > 0;
      });

      const allKeywords = new Set<string>();
      matchingReviews.forEach(reviewText => {
        const match = findMatchingKeywordsInReview(sport, reviewText);
        match.keywords.forEach(k => allKeywords.add(k));
      });

      const score = calculateSerpReviewScore(allKeywords.size, firstMatchIndex);

      metadata[sport] = {
        score,
        sources: ['serp_review'],
        keywords_matched: Array.from(allKeywords),
        confidence: score >= 70 ? 'high' : score >= 30 ? 'medium' : 'low',
        matched_text: matchingReviews, // Store all matching reviews
      };
    }
  }

  return { sports: Array.from(sportsFound), metadata };
}

/**
 * Merge new sport metadata from serp_review with existing metadata
 */
function mergeSportMetadata(
  existing: SportMetadata | undefined,
  newMetadata: SportMetadata
): SportMetadata {
  if (!existing) {
    return newMetadata;
  }

  // Merge sources (deduplicate)
  const mergedSources = [...new Set([...existing.sources, ...newMetadata.sources])] as Array<'name' | 'review' | 'api' | 'serp_review'>;

  // Merge keywords (deduplicate)
  const mergedKeywords = [...new Set([...existing.keywords_matched, ...newMetadata.keywords_matched])];

  // Take the higher score
  const mergedScore = Math.max(existing.score, newMetadata.score);

  // Merge matched_text - handle both string and array formats
  let mergedMatchedText: string | string[] = existing.matched_text || '';

  if (newMetadata.matched_text) {
    // If new metadata has serp_review evidence (array of full reviews)
    if (Array.isArray(newMetadata.matched_text) && newMetadata.sources.includes('serp_review')) {
      // Keep existing text and add serp reviews
      if (Array.isArray(existing.matched_text)) {
        mergedMatchedText = [...existing.matched_text, ...newMetadata.matched_text];
      } else if (existing.matched_text) {
        mergedMatchedText = [existing.matched_text, ...newMetadata.matched_text];
      } else {
        mergedMatchedText = newMetadata.matched_text;
      }
    } else {
      // For non-serp sources, prefer: name > api > review > serp_review
      if (newMetadata.sources.includes('name')) {
        mergedMatchedText = newMetadata.matched_text;
      } else if (!existing.sources.includes('name') && newMetadata.sources.includes('api')) {
        mergedMatchedText = newMetadata.matched_text;
      } else if (!existing.sources.includes('name') && !existing.sources.includes('api') && newMetadata.sources.includes('review')) {
        mergedMatchedText = newMetadata.matched_text;
      }
    }
  }

  // Recalculate confidence based on merged score
  const confidence = mergedScore >= 70 ? 'high' : mergedScore >= 30 ? 'medium' : 'low';

  return {
    score: mergedScore,
    sources: mergedSources,
    keywords_matched: mergedKeywords,
    confidence,
    matched_text: mergedMatchedText,
  };
}

/**
 * Re-assess sport metadata for a single facility using additional_reviews
 */
function reassessFacilitySportMetadata(
  facility: Facility,
  minScore: number = 30
): {
  updated: boolean;
  newSports: string[];
  improvedSports: string[];
  finalIdentifiedSports: string[];
  finalSportMetadata: Record<string, SportMetadata>;
} {
  const existingSports = new Set(facility.identified_sports || []);
  const existingMetadata = facility.sport_metadata || {};

  // Identify sports from additional_reviews
  const { sports: newSportsFromReviews, metadata: newMetadata } =
    identifySportsFromAdditionalReviews(facility.additional_reviews);

  // Track what changed
  const newSports: string[] = [];
  const improvedSports: string[] = [];
  let updated = false;

  // Merge findings
  const finalMetadata: Record<string, SportMetadata> = { ...existingMetadata };

  for (const sport of newSportsFromReviews) {
    const mergedMetadata = mergeSportMetadata(existingMetadata[sport], newMetadata[sport]);

    // Only include if meets minimum score threshold
    if (mergedMetadata.score >= minScore) {
      finalMetadata[sport] = mergedMetadata;

      if (!existingSports.has(sport)) {
        newSports.push(sport);
        existingSports.add(sport);
        updated = true;
      } else if (JSON.stringify(mergedMetadata) !== JSON.stringify(existingMetadata[sport])) {
        improvedSports.push(sport);
        updated = true;
      }
    }
  }

  return {
    updated,
    newSports,
    improvedSports,
    finalIdentifiedSports: Array.from(existingSports),
    finalSportMetadata: finalMetadata,
  };
}

/**
 * Main script
 */
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const batchSize = parseInt(args.find(arg => arg.startsWith("--batch-size="))?.split("=")[1] || "100");
  const offset = parseInt(args.find(arg => arg.startsWith("--offset="))?.split("=")[1] || "0");
  const minScore = parseInt(args.find(arg => arg.startsWith("--min-score="))?.split("=")[1] || "30");

  console.log("🔄 Re-assessing Sport Metadata with SerpAPI Reviews");
  console.log("================================================");
  console.log(`Mode: ${dryRun ? "DRY RUN (no database updates)" : "LIVE"}`);
  console.log(`Batch size: ${batchSize}`);
  console.log(`Starting offset: ${offset}`);
  console.log(`Minimum score threshold: ${minScore}`);
  console.log("");

  // Query facilities that need reassessment
  const { data: facilities, error } = await supabase
    .from("sports_facilities")
    .select("id, place_id, name, identified_sports, sport_metadata, additional_reviews")
    .eq("serp_scraped", true)
    .neq("sport_metadata_reassessed", true)
    .not("additional_reviews", "is", null)
    .range(offset, offset + batchSize - 1);

  if (error) {
    console.error("❌ Error fetching facilities:", error);
    process.exit(1);
  }

  if (!facilities || facilities.length === 0) {
    console.log("✅ No facilities found that need reassessment");
    return;
  }

  console.log(`📊 Found ${facilities.length} facilities to reassess\n`);

  // Statistics
  let processed = 0;
  let updated = 0;
  let totalNewSports = 0;
  let totalImprovedSports = 0;
  let errors = 0;

  for (const facility of facilities) {
    try {
      const result = reassessFacilitySportMetadata(facility, minScore);

      processed++;

      if (result.updated) {
        updated++;
        totalNewSports += result.newSports.length;
        totalImprovedSports += result.improvedSports.length;

        console.log(`\n✨ ${facility.name}`);
        console.log(`   Place ID: ${facility.place_id}`);

        if (result.newSports.length > 0) {
          console.log(`   ➕ New sports found: ${result.newSports.join(", ")}`);
        }

        if (result.improvedSports.length > 0) {
          console.log(`   📈 Sports improved: ${result.improvedSports.join(", ")}`);
        }

        // Show example of evidence
        const exampleSport = result.newSports[0] || result.improvedSports[0];
        if (exampleSport) {
          const meta = result.finalSportMetadata[exampleSport];
          console.log(`   📝 Evidence for ${exampleSport}:`);
          console.log(`      Score: ${meta.score}, Confidence: ${meta.confidence}`);
          console.log(`      Sources: ${meta.sources.join(", ")}`);
          console.log(`      Keywords: ${meta.keywords_matched.join(", ")}`);
          if (Array.isArray(meta.matched_text)) {
            console.log(`      ${meta.matched_text.length} matching review(s)`);
          }
        }

        // Update database
        if (!dryRun) {
          const { error: updateError } = await supabase
            .from("sports_facilities")
            .update({
              identified_sports: result.finalIdentifiedSports,
              sport_metadata: result.finalSportMetadata,
              sport_metadata_reassessed: true,
            })
            .eq("place_id", facility.place_id);

          if (updateError) {
            console.error(`   ❌ Error updating facility: ${updateError.message}`);
            errors++;
          }
        }
      } else {
        // No changes but mark as reassessed
        if (!dryRun) {
          const { error: updateError } = await supabase
            .from("sports_facilities")
            .update({
              sport_metadata_reassessed: true,
            })
            .eq("place_id", facility.place_id);

          if (updateError) {
            console.error(`❌ Error marking facility as reassessed: ${updateError.message}`);
            errors++;
          }
        }
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
  console.log("📊 REASSESSMENT SUMMARY");
  console.log("================================================");
  console.log(`Facilities processed: ${processed}`);
  console.log(`Facilities updated: ${updated}`);
  console.log(`New sports identified: ${totalNewSports}`);
  console.log(`Existing sports improved: ${totalImprovedSports}`);
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
