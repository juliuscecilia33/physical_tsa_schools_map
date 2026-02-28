import { createClient } from "@supabase/supabase-js";
import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: path.join(__dirname, "../.env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("❌ Error: Missing required environment variables");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Canonical sports list from collect-high-quality-facilities.ts
const CANONICAL_SPORTS = [
  "Basketball",
  "Soccer",
  "Baseball",
  "Football",
  "Tennis",
  "Volleyball",
  "Swimming",
  "Track & Field",
  "Golf",
  "Hockey",
  "Lacrosse",
  "Softball",
  "Wrestling",
  "Gymnastics",
  "Pickleball",
  "Racquetball",
  "Squash",
  "Badminton",
  "Gym/Fitness",
  "CrossFit",
  "Yoga",
  "Pilates",
  "Martial Arts",
  "Boxing",
  "Bowling",
  "Skating",
  "Climbing",
  "Water Sports",
];

// Sport keyword mappings for fuzzy matching
const SPORT_KEYWORDS: Record<string, string[]> = {
  Basketball: ["basketball", "bball", "hoops", "basketkball", "basketbal"],
  Soccer: ["soccer", "futbol", "football", "soccor"],
  Baseball: ["baseball", "diamond", "basball"],
  Football: ["football", "gridiron", "footbal"],
  Tennis: ["tennis", "tenis"],
  Volleyball: ["volleyball", "vball", "volley ball", "voleyball"],
  Swimming: ["swimming", "pool", "aquatic", "natatorium", "swim"],
  "Track & Field": ["track", "track and field", "athletics", "track field"],
  Golf: ["golf", "putting green", "driving range", "golf course"],
  Hockey: ["hockey", "ice rink", "ice hockey"],
  Lacrosse: ["lacrosse", "lax"],
  Softball: ["softball", "soft ball"],
  Wrestling: ["wrestling", "mat room", "wrestle"],
  Gymnastics: ["gymnastics", "tumbling", "gymnastic"],
  Pickleball: ["pickleball", "pickle ball", "pickeball"],
  Racquetball: ["racquetball", "racquet ball", "raquetball"],
  Squash: ["squash court", "squash"],
  Badminton: ["badminton", "badmitton"],
  "Gym/Fitness": [
    "gym",
    "fitness",
    "training",
    "performance",
    "strength",
    "conditioning",
    "athletic",
    "gym/fitness",
    "fitness training",
  ],
  CrossFit: ["crossfit", "cross fit"],
  Yoga: ["yoga"],
  Pilates: ["pilates"],
  "Martial Arts": [
    "martial arts",
    "karate",
    "taekwondo",
    "jiu jitsu",
    "bjj",
    "judo",
    "kickboxing",
    "mma",
    "martial art",
    "jiujitsu",
  ],
  Boxing: ["boxing", "box"],
  Bowling: ["bowling", "bowl"],
  Skating: ["skating", "skate park", "roller", "ice skating"],
  Climbing: ["climbing", "bouldering", "rock climbing"],
  "Water Sports": ["kayak", "canoe", "rowing", "sailing", "water sports"],
};

interface SportMetadata {
  score: number;
  sources: Array<"name" | "review" | "api" | "serp_review">;
  keywords_matched: string[];
  confidence: "high" | "medium" | "low";
  matched_text?: string | string[];
}

interface Facility {
  place_id: string;
  name: string;
  identified_sports: string[];
  sport_metadata: Record<string, SportMetadata>;
  tags?: Array<{ id: string; name: string; color: string }>;
}

// Calculate Levenshtein distance for fuzzy matching
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]) + 1;
      }
    }
  }

  return dp[m][n];
}

// Calculate similarity score (0-100)
function similarityScore(str1: string, str2: string): number {
  const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
  const maxLength = Math.max(str1.length, str2.length);
  return ((maxLength - distance) / maxLength) * 100;
}

// Normalize a single sport name to canonical form
function normalizeSportName(messySport: string): {
  canonical: string | null;
  confidence: number;
  matchType: "exact" | "keyword" | "fuzzy" | "none";
} {
  const messy = messySport.trim();
  const messy_lower = messy.toLowerCase();

  // Step 1: Check for exact match (case-insensitive)
  for (const canonical of CANONICAL_SPORTS) {
    if (canonical.toLowerCase() === messy_lower) {
      return { canonical, confidence: 100, matchType: "exact" };
    }
  }

  // Step 2: Check keyword mappings
  for (const [canonical, keywords] of Object.entries(SPORT_KEYWORDS)) {
    for (const keyword of keywords) {
      if (keyword.toLowerCase() === messy_lower) {
        return { canonical, confidence: 95, matchType: "keyword" };
      }
      // Check if messy sport contains the keyword or vice versa
      if (
        messy_lower.includes(keyword.toLowerCase()) ||
        keyword.toLowerCase().includes(messy_lower)
      ) {
        return { canonical, confidence: 85, matchType: "keyword" };
      }
    }
  }

  // Step 3: Fuzzy matching against canonical sports
  let bestMatch: string | null = null;
  let bestScore = 0;

  for (const canonical of CANONICAL_SPORTS) {
    const score = similarityScore(messy, canonical);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = canonical;
    }

    // Also check against keywords for fuzzy matching
    const keywords = SPORT_KEYWORDS[canonical] || [];
    for (const keyword of keywords) {
      const keywordScore = similarityScore(messy, keyword);
      if (keywordScore > bestScore) {
        bestScore = keywordScore;
        bestMatch = canonical;
      }
    }
  }

  // Only accept fuzzy matches with 75% or higher similarity
  if (bestMatch && bestScore >= 75) {
    return { canonical: bestMatch, confidence: bestScore, matchType: "fuzzy" };
  }

  // No match found
  return { canonical: null, confidence: 0, matchType: "none" };
}

// Normalize all sports for a facility
function normalizeFacilitySports(facility: Facility): {
  normalizedSports: string[];
  normalizedMetadata: Record<string, SportMetadata>;
  changes: Array<{
    original: string;
    normalized: string | null;
    confidence: number;
    matchType: string;
  }>;
} {
  const normalizedSports = new Set<string>();
  const normalizedMetadata: Record<string, SportMetadata> = {};
  const changes: Array<{
    original: string;
    normalized: string | null;
    confidence: number;
    matchType: string;
  }> = [];

  for (const sport of facility.identified_sports || []) {
    const normalization = normalizeSportName(sport);

    changes.push({
      original: sport,
      normalized: normalization.canonical,
      confidence: normalization.confidence,
      matchType: normalization.matchType,
    });

    if (normalization.canonical) {
      normalizedSports.add(normalization.canonical);

      // Preserve or update metadata
      const existingMetadata = facility.sport_metadata?.[sport];
      if (existingMetadata) {
        // Keep existing metadata but under normalized name
        if (!normalizedMetadata[normalization.canonical]) {
          normalizedMetadata[normalization.canonical] = existingMetadata;
        } else {
          // If we already have metadata for this canonical sport, merge them
          const existing = normalizedMetadata[normalization.canonical];
          normalizedMetadata[normalization.canonical] = {
            score: Math.max(existing.score, existingMetadata.score),
            sources: Array.from(
              new Set([...existing.sources, ...existingMetadata.sources])
            ),
            keywords_matched: Array.from(
              new Set([
                ...existing.keywords_matched,
                ...existingMetadata.keywords_matched,
              ])
            ),
            confidence:
              existing.score >= existingMetadata.score
                ? existing.confidence
                : existingMetadata.confidence,
            matched_text: existing.matched_text || existingMetadata.matched_text,
          };
        }
      } else {
        // Create new metadata with moderate score
        normalizedMetadata[normalization.canonical] = {
          score: 50,
          sources: ["name"],
          keywords_matched: [sport],
          confidence: "medium",
          matched_text: facility.name,
        };
      }
    }
  }

  return {
    normalizedSports: Array.from(normalizedSports),
    normalizedMetadata,
    changes,
  };
}

async function getPartnershipActiveFacilities(): Promise<Facility[]> {
  console.log("🔍 Fetching facilities with 'Partnership Active' tag...\n");

  // First, get the tag ID for "Partnership Active"
  const { data: tagData, error: tagError } = await supabase
    .from("facility_tags")
    .select("id, name, color")
    .eq("name", "Partnership Active")
    .single();

  if (tagError) {
    console.error("❌ Error fetching Partnership Active tag:", tagError.message);
    throw tagError;
  }

  if (!tagData) {
    console.log("⚠️  'Partnership Active' tag not found in database");
    return [];
  }

  // Get facilities with this tag
  const { data: assignmentData, error: assignmentError } = await supabase
    .from("facility_tag_assignments")
    .select("place_id")
    .eq("tag_id", tagData.id);

  if (assignmentError) {
    console.error("❌ Error fetching tag assignments:", assignmentError.message);
    throw assignmentError;
  }

  if (!assignmentData || assignmentData.length === 0) {
    console.log("ℹ️  No facilities found with 'Partnership Active' tag");
    return [];
  }

  const placeIds = assignmentData.map((a) => a.place_id);

  // Fetch the facilities
  const { data: facilityData, error: facilityError } = await supabase
    .from("sports_facilities")
    .select("place_id, name, identified_sports, sport_metadata")
    .in("place_id", placeIds);

  if (facilityError) {
    console.error("❌ Error fetching facilities:", facilityError.message);
    throw facilityError;
  }

  const facilities: Facility[] = (facilityData || []).map((facility: any) => ({
    place_id: facility.place_id,
    name: facility.name,
    identified_sports: facility.identified_sports || [],
    sport_metadata: facility.sport_metadata || {},
    tags: [tagData],
  }));

  console.log(`✅ Found ${facilities.length} facilities with 'Partnership Active' tag\n`);

  return facilities;
}

async function updateFacilitySports(
  placeId: string,
  normalizedSports: string[],
  normalizedMetadata: Record<string, SportMetadata>
): Promise<boolean> {
  const { error } = await supabase
    .from("sports_facilities")
    .update({
      identified_sports: normalizedSports,
      sport_metadata: normalizedMetadata,
    })
    .eq("place_id", placeId);

  if (error) {
    console.error(`  ❌ Error updating ${placeId}:`, error.message);
    return false;
  }

  return true;
}

async function main() {
  console.log("🚀 Normalize Partnership Active Facilities Sports\n");
  console.log("=" .repeat(60));
  console.log(`📊 Canonical Sports: ${CANONICAL_SPORTS.length}`);
  console.log("=" .repeat(60) + "\n");

  try {
    // Fetch partnership facilities
    const facilities = await getPartnershipActiveFacilities();

    if (facilities.length === 0) {
      console.log("ℹ️  No facilities found with 'Partnership Active' tag");
      return;
    }

    let totalChanges = 0;
    let facilitiesUpdated = 0;
    let facilitiesWithNoChanges = 0;
    let sportsRemoved = 0;
    let sportsNormalized = 0;

    console.log("🔄 Processing facilities...\n");

    for (let i = 0; i < facilities.length; i++) {
      const facility = facilities[i];
      const { normalizedSports, normalizedMetadata, changes } =
        normalizeFacilitySports(facility);

      // Check if there are any changes
      const hasChanges =
        normalizedSports.length !== facility.identified_sports.length ||
        changes.some(
          (change) =>
            change.original !== change.normalized || change.normalized === null
        );

      if (!hasChanges) {
        facilitiesWithNoChanges++;
        continue;
      }

      // Log changes
      console.log(`[${i + 1}/${facilities.length}] ${facility.name}`);
      console.log(`  Place ID: ${facility.place_id}`);
      console.log(`  Original sports (${facility.identified_sports.length}):`);
      console.log(`    ${facility.identified_sports.join(", ") || "none"}`);
      console.log(`  Normalized sports (${normalizedSports.length}):`);
      console.log(`    ${normalizedSports.join(", ") || "none"}`);

      // Show detailed changes
      for (const change of changes) {
        if (change.normalized === null) {
          console.log(
            `    ❌ REMOVED: "${change.original}" (no match found)`
          );
          sportsRemoved++;
        } else if (change.original !== change.normalized) {
          console.log(
            `    ✏️  NORMALIZED: "${change.original}" → "${change.normalized}" (${change.confidence.toFixed(0)}% confidence, ${change.matchType})`
          );
          sportsNormalized++;
        }
      }

      // Update the facility
      const success = await updateFacilitySports(
        facility.place_id,
        normalizedSports,
        normalizedMetadata
      );

      if (success) {
        facilitiesUpdated++;
        totalChanges += changes.filter(
          (c) => c.normalized === null || c.original !== c.normalized
        ).length;
        console.log("  ✅ Updated successfully\n");
      } else {
        console.log("  ❌ Failed to update\n");
      }
    }

    // Final summary
    console.log("=" .repeat(60));
    console.log("🎉 Normalization Complete!\n");
    console.log("📊 Summary:");
    console.log(`  Total facilities processed: ${facilities.length}`);
    console.log(`  Facilities updated: ${facilitiesUpdated}`);
    console.log(`  Facilities with no changes: ${facilitiesWithNoChanges}`);
    console.log(`  Total sports normalized: ${sportsNormalized}`);
    console.log(`  Total sports removed: ${sportsRemoved}`);
    console.log("=" .repeat(60));
  } catch (error: any) {
    console.error("❌ Fatal error:", error.message);
    process.exit(1);
  }
}

main();
