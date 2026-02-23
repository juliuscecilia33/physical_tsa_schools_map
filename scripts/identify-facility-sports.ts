import { Client } from "@googlemaps/google-maps-services-js";
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: path.join(__dirname, "../.env.local") });

const client = new Client({});
const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY!;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!GOOGLE_API_KEY || !supabaseUrl || !supabaseAnonKey) {
  console.error("❌ Error: Missing required environment variables");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Sport keywords organized by sport type
// IMPROVED: Removed ambiguous keywords to reduce false positives
const SPORT_KEYWORDS = {
  // Core Sports
  Basketball: ["basketball", "bball", "hoops"],
  Soccer: ["soccer", "futbol"], // Removed "football" and "pitch" to avoid conflicts
  Baseball: ["baseball", "diamond"],
  Football: ["football", "gridiron"], // "football" still here but we handle conflicts in code
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
  "Water Sports": ["kayak", "canoe", "rowing", "sailing"],
};

interface SportMetadata {
  score: number;
  sources: Array<'name' | 'review' | 'api'>;
  keywords_matched: string[];
  confidence: 'high' | 'medium' | 'low';
  matched_text?: string;
}

interface Facility {
  id: string;
  place_id: string;
  name: string;
  sport_types: string[];
  identified_sports?: string[];
  sport_metadata?: Record<string, SportMetadata>;
  address: string;
  reviews?: any[];
}

interface IdentificationResult {
  place_id: string;
  name: string;
  identified_sports: string[];
  sport_metadata: Record<string, SportMetadata>;
  confidence: "high" | "medium" | "low";
  method: "name" | "places_api" | "reviews" | "web_search" | "multiple";
}

// Rate limiting helper
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Helper: Find matching keywords and extract context
 */
function findMatchingKeywords(
  sport: string,
  text: string
): { keywords: string[]; matchedText: string } {
  const keywords = SPORT_KEYWORDS[sport as keyof typeof SPORT_KEYWORDS] || [];
  const textLower = text.toLowerCase();
  const matched: string[] = [];
  let matchedText = "";

  for (const keyword of keywords) {
    const index = textLower.indexOf(keyword);
    if (index !== -1) {
      matched.push(keyword);
      // Extract a snippet around the match
      const start = Math.max(0, index - 20);
      const end = Math.min(textLower.length, index + keyword.length + 30);
      matchedText = text.substring(start, end).trim();
      if (start > 0) matchedText = "..." + matchedText;
      if (end < textLower.length) matchedText = matchedText + "...";
      break; // Use first match for context
    }
  }

  return { keywords: matched, matchedText };
}

/**
 * Helper: Calculate confidence score
 */
function calculateScore(
  sources: Array<'name' | 'review' | 'api'>,
  keywordLength: number,
  reviewPosition?: number
): number {
  let score = 0;

  if (sources.includes('name')) {
    // Name match: 85-100 based on keyword specificity
    score = 85 + Math.min(15, keywordLength);
  } else if (sources.includes('api')) {
    // API match: 70-80
    score = 70 + Math.min(10, keywordLength);
  } else if (sources.includes('review')) {
    // Review match: 25-50 based on position
    const positionBonus = reviewPosition !== undefined ? Math.max(0, 10 - reviewPosition * 2) : 0;
    score = 25 + positionBonus + Math.min(15, keywordLength);
  }

  // Multiple sources bonus
  if (sources.length > 1) {
    score = Math.min(100, score + 10);
  }

  return score;
}

/**
 * Step 1: Identify sports from facility name with metadata
 */
function identifySportsFromName(name: string): {
  sports: string[];
  metadata: Record<string, SportMetadata>;
} {
  const sports = new Set<string>();
  const metadata: Record<string, SportMetadata> = {};

  // Check for specific sports
  for (const [sport, keywords] of Object.entries(SPORT_KEYWORDS)) {
    const match = findMatchingKeywords(sport, name);
    if (match.keywords.length > 0) {
      sports.add(sport);
      const keywordSpecificity = Math.max(...match.keywords.map(k => k.length));
      const score = calculateScore(['name'], keywordSpecificity);

      metadata[sport] = {
        score,
        sources: ['name'],
        keywords_matched: match.keywords,
        confidence: score >= 70 ? 'high' : 'medium',
        matched_text: match.matchedText,
      };
    }
  }

  return { sports: Array.from(sports), metadata };
}

/**
 * Step 2: Get additional details from Google Places Details API with metadata
 */
async function identifySportsFromPlacesAPI(
  placeId: string
): Promise<{
  sports: string[];
  metadata: Record<string, SportMetadata>;
}> {
  const sports = new Set<string>();
  const metadata: Record<string, SportMetadata> = {};

  try {
    const response = await client.placeDetails({
      params: {
        place_id: placeId,
        key: GOOGLE_API_KEY,
        fields: ["name", "types", "editorial_summary", "reviews"],
      },
    });

    if (response.data.status !== "OK") {
      return { sports: Array.from(sports), metadata };
    }

    const result = response.data.result;

    // Check editorial summary
    if (result.editorial_summary?.overview) {
      const overview = result.editorial_summary.overview;
      for (const [sport, keywords] of Object.entries(SPORT_KEYWORDS)) {
        const match = findMatchingKeywords(sport, overview);
        if (match.keywords.length > 0) {
          sports.add(sport);
          const score = calculateScore(['api'], match.keywords.length);

          metadata[sport] = {
            score,
            sources: ['api'],
            keywords_matched: match.keywords,
            confidence: score >= 70 ? 'high' : 'medium',
            matched_text: match.matchedText,
          };
        }
      }
    }

    // Check fresh API reviews (separate from database reviews)
    if (result.reviews) {
      for (let i = 0; i < Math.min(5, result.reviews.length); i++) {
        const reviewText = result.reviews[i].text;
        for (const [sport, keywords] of Object.entries(SPORT_KEYWORDS)) {
          if (!sports.has(sport)) {
            const match = findMatchingKeywords(sport, reviewText);
            if (match.keywords.length > 0) {
              sports.add(sport);
              const score = calculateScore(['api', 'review'], match.keywords.length, i);

              metadata[sport] = {
                score,
                sources: ['api', 'review'],
                keywords_matched: match.keywords,
                confidence: score >= 70 ? 'high' : score >= 30 ? 'medium' : 'low',
                matched_text: match.matchedText,
              };
              break;
            }
          }
        }
      }
    }

    return { sports: Array.from(sports), metadata };
  } catch (error: any) {
    console.error(`  ⚠️  Error fetching place details: ${error.message}`);
    return { sports: Array.from(sports), metadata };
  }
}

/**
 * Step 3: Analyze existing reviews in database with metadata
 */
function identifySportsFromReviews(
  reviews: any[] | undefined
): {
  sports: string[];
  metadata: Record<string, SportMetadata>;
} {
  const sports = new Set<string>();
  const metadata: Record<string, SportMetadata> = {};

  if (!reviews || reviews.length === 0) {
    return { sports: Array.from(sports), metadata };
  }

  // Check for specific sports in reviews
  for (const [sport, keywords] of Object.entries(SPORT_KEYWORDS)) {
    // Find first review that matches
    let matchFound = false;
    for (let i = 0; i < Math.min(10, reviews.length); i++) {
      const reviewText = reviews[i].text || "";
      const match = findMatchingKeywords(sport, reviewText);

      if (match.keywords.length > 0) {
        sports.add(sport);
        const score = calculateScore(['review'], match.keywords.length, i);

        metadata[sport] = {
          score,
          sources: ['review'],
          keywords_matched: match.keywords,
          confidence: score >= 70 ? 'high' : score >= 30 ? 'medium' : 'low',
          matched_text: match.matchedText,
        };
        matchFound = true;
        break;
      }
    }

    if (matchFound) continue;
  }

  return { sports: Array.from(sports), metadata };
}

/**
 * Helper: Merge sport metadata from multiple sources
 */
function mergeSportMetadata(
  existing: SportMetadata | undefined,
  newMetadata: SportMetadata
): SportMetadata {
  if (!existing) {
    return newMetadata;
  }

  // Merge sources (deduplicate)
  const mergedSources = [...new Set([...existing.sources, ...newMetadata.sources])] as Array<'name' | 'review' | 'api'>;

  // Merge keywords (deduplicate)
  const mergedKeywords = [...new Set([...existing.keywords_matched, ...newMetadata.keywords_matched])];

  // Take the higher score
  const mergedScore = Math.max(existing.score, newMetadata.score);

  // Prefer name > api > review for matched text
  let mergedMatchedText = existing.matched_text || '';
  if (newMetadata.sources.includes('name')) {
    mergedMatchedText = newMetadata.matched_text || mergedMatchedText;
  } else if (!existing.sources.includes('name') && newMetadata.sources.includes('api')) {
    mergedMatchedText = newMetadata.matched_text || mergedMatchedText;
  }

  // Recalculate confidence
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
 * Main identification pipeline with metadata tracking
 */
async function identifyFacilitySports(
  facility: Facility,
  options: {
    usePlacesAPI?: boolean;
    useReviews?: boolean;
    existingSports?: string[];
    existingMetadata?: Record<string, SportMetadata>;
    confidenceThreshold?: number;
  } = {}
): Promise<IdentificationResult> {
  const methods: string[] = [];
  const sportsSet = new Set<string>(options.existingSports || []);
  const allMetadata: Record<string, SportMetadata> = { ...options.existingMetadata };

  // Step 1: Parse name
  const nameResult = identifySportsFromName(facility.name);
  if (nameResult.sports.length > 0) {
    nameResult.sports.forEach(sport => sportsSet.add(sport));
    // Merge metadata
    for (const [sport, metadata] of Object.entries(nameResult.metadata)) {
      allMetadata[sport] = mergeSportMetadata(allMetadata[sport], metadata);
    }
    methods.push("name");
  }

  // Step 2: Check reviews in database
  if (options.useReviews && facility.reviews) {
    const reviewResult = identifySportsFromReviews(facility.reviews);
    if (reviewResult.sports.length > 0) {
      reviewResult.sports.forEach(sport => sportsSet.add(sport));
      // Merge metadata
      for (const [sport, metadata] of Object.entries(reviewResult.metadata)) {
        allMetadata[sport] = mergeSportMetadata(allMetadata[sport], metadata);
      }
      methods.push("reviews");
    }
  }

  // Step 3: Use Google Places Details API
  if (options.usePlacesAPI) {
    const apiResult = await identifySportsFromPlacesAPI(facility.place_id);
    if (apiResult.sports.length > 0) {
      apiResult.sports.forEach(sport => sportsSet.add(sport));
      // Merge metadata
      for (const [sport, metadata] of Object.entries(apiResult.metadata)) {
        allMetadata[sport] = mergeSportMetadata(allMetadata[sport], metadata);
      }
      methods.push("places_api");
    }
    // Rate limit: 100 requests per second max
    await delay(100);
  }

  // Apply confidence threshold filtering if set
  const confidenceThreshold = options.confidenceThreshold || 0;
  const finalSports: string[] = [];
  const finalMetadata: Record<string, SportMetadata> = {};

  for (const sport of Array.from(sportsSet)) {
    const metadata = allMetadata[sport];
    if (metadata && metadata.score >= confidenceThreshold) {
      finalSports.push(sport);
      finalMetadata[sport] = metadata;
    } else if (!metadata) {
      // No metadata (from previous runs), keep it but warn
      finalSports.push(sport);
    }
  }

  // Determine overall confidence level
  let confidence: "high" | "medium" | "low" = "low";
  if (methods.includes("name")) {
    confidence = "high";
  } else if (methods.includes("reviews") || methods.includes("places_api")) {
    confidence = "medium";
  }

  return {
    place_id: facility.place_id,
    name: facility.name,
    identified_sports: finalSports,
    sport_metadata: finalMetadata,
    confidence,
    method: methods.length > 1 ? "multiple" : (methods[0] as any) || "none",
  };
}

/**
 * Batch process all facilities
 */
async function processAllFacilities(options: {
  batchSize?: number;
  usePlacesAPI?: boolean;
  useReviews?: boolean;
  offset?: number;
  confidenceThreshold?: number;
}) {
  const { batchSize = 100, usePlacesAPI = false, useReviews = true, offset = 0, confidenceThreshold = 0 } = options;

  console.log("🏃 Starting sport identification process...\n");
  console.log(`📊 Options:`);
  console.log(`   - Batch size: ${batchSize}`);
  console.log(`   - Use Places API: ${usePlacesAPI ? "✅" : "❌"}`);
  console.log(`   - Use Reviews: ${useReviews ? "✅" : "❌"}`);
  console.log(`   - Confidence threshold: ${confidenceThreshold} (0 = no filtering)`);
  console.log(`   - Starting offset: ${offset}\n`);

  let processedCount = 0;
  let totalIdentified = 0;
  let currentOffset = offset;
  const results: IdentificationResult[] = [];

  while (true) {
    // Fetch batch of facilities
    console.log(`📥 Fetching facilities ${currentOffset} to ${currentOffset + batchSize}...`);

    const { data: facilities, error } = await supabase
      .from("sports_facilities")
      .select("id, place_id, name, sport_types, identified_sports, sport_metadata, address, reviews")
      .range(currentOffset, currentOffset + batchSize - 1);

    if (error) {
      console.error(`❌ Error fetching facilities: ${error.message}`);
      break;
    }

    if (!facilities || facilities.length === 0) {
      console.log("✅ No more facilities to process");
      break;
    }

    console.log(`🔍 Processing ${facilities.length} facilities...\n`);

    // Process each facility
    for (const facility of facilities) {
      const existingSports = facility.identified_sports || [];
      const existingMetadata = facility.sport_metadata || {};
      const result = await identifyFacilitySports(facility, {
        usePlacesAPI,
        useReviews,
        existingSports,
        existingMetadata,
        confidenceThreshold,
      });

      // Check if new sports were added
      const hasNewSports = result.identified_sports.length > existingSports.length;
      const addedSports = result.identified_sports.filter(s => !existingSports.includes(s));

      results.push(result);
      processedCount++;

      if (result.identified_sports.length > 0) {
        totalIdentified++;

        // Format sports with scores for display
        const sportsWithScores = result.identified_sports.map(sport => {
          const metadata = result.sport_metadata[sport];
          return metadata ? `${sport}(${metadata.score})` : sport;
        }).join(", ");

        if (hasNewSports && addedSports.length > 0) {
          const addedWithScores = addedSports.map(sport => {
            const metadata = result.sport_metadata[sport];
            return metadata ? `${sport}(${metadata.score})` : sport;
          }).join(", ");
          console.log(
            `  ✓ [${processedCount}] ${facility.name.substring(0, 50)}... → ${sportsWithScores} (+${addedWithScores}) (${result.confidence})`
          );
        } else if (existingSports.length > 0) {
          console.log(
            `  = [${processedCount}] ${facility.name.substring(0, 50)}... → ${sportsWithScores} (unchanged)`
          );
        } else {
          console.log(
            `  ✓ [${processedCount}] ${facility.name.substring(0, 50)}... → ${sportsWithScores} (${result.confidence})`
          );
        }
      } else {
        console.log(
          `  ○ [${processedCount}] ${facility.name.substring(0, 50)}... → No sports identified`
        );
      }

      // Update database every 10 facilities
      if (processedCount % 10 === 0) {
        await updateDatabase(results.splice(0));
      }
    }

    // Move to next batch
    currentOffset += batchSize;

    // Progress update
    console.log(`\n📈 Progress: ${processedCount} processed, ${totalIdentified} identified\n`);
  }

  // Update remaining results
  if (results.length > 0) {
    await updateDatabase(results);
  }

  // Generate final report
  await generateReport(results);

  console.log(`\n✅ Identification complete!`);
  console.log(`   - Total processed: ${processedCount}`);
  console.log(`   - Total identified: ${totalIdentified}`);
  console.log(`   - Success rate: ${((totalIdentified / processedCount) * 100).toFixed(1)}%`);
}

/**
 * Update database with identified sports and metadata
 */
async function updateDatabase(results: IdentificationResult[]) {
  if (results.length === 0) return;

  console.log(`💾 Updating database with ${results.length} results...`);

  for (const result of results) {
    const { error } = await supabase
      .from("sports_facilities")
      .update({
        identified_sports: result.identified_sports,
        sport_metadata: result.sport_metadata,
      })
      .eq("place_id", result.place_id);

    if (error) {
      console.error(`  ⚠️  Error updating ${result.place_id}: ${error.message}`);
    }
  }

  console.log(`  ✓ Database updated\n`);
}

/**
 * Generate CSV report
 */
async function generateReport(results: IdentificationResult[]) {
  const reportPath = path.join(__dirname, "../sport-identification-report.csv");

  const csvHeader = "Place ID,Facility Name,Identified Sports,Confidence,Method\n";
  const csvRows = results.map(r =>
    `"${r.place_id}","${r.name}","${r.identified_sports.join("; ")}","${r.confidence}","${r.method}"`
  ).join("\n");

  fs.writeFileSync(reportPath, csvHeader + csvRows);
  console.log(`\n📄 Report saved to: ${reportPath}`);
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const usePlacesAPI = args.includes("--use-places-api");
  const useReviews = !args.includes("--no-reviews");
  const batchSize = parseInt(args.find(arg => arg.startsWith("--batch-size="))?.split("=")[1] || "100");
  const offset = parseInt(args.find(arg => arg.startsWith("--offset="))?.split("=")[1] || "0");
  const confidenceThreshold = parseInt(args.find(arg => arg.startsWith("--threshold="))?.split("=")[1] || "0");

  console.log("🎯 Enhanced Sport Identification with Confidence Scoring");
  console.log("=" .repeat(60));
  console.log("\nNew features:");
  console.log("  ✓ Confidence scoring for each sport (0-100)");
  console.log("  ✓ Metadata tracking (sources, keywords, matched text)");
  console.log("  ✓ Improved keyword dictionary (removed ambiguous terms)");
  console.log("  ✓ Optional confidence threshold filtering");
  console.log("");

  await processAllFacilities({
    batchSize,
    usePlacesAPI,
    useReviews,
    offset,
    confidenceThreshold,
  });
}

main().catch(console.error);
