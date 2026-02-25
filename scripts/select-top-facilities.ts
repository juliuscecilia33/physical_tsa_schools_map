import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
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

// High-quality facility keywords for bonus scoring
const HIGH_QUALITY_KEYWORDS = [
  "indoor",
  "fieldhouse",
  "dome",
  "arena",
  "academy",
  "training facility",
  "training center",
  "premier",
  "championship",
  "tournament",
  "athletic complex",
  "performance center",
  "batting cage",
  "sports complex",
];

// Texas geographic bounds for filtering
const TEXAS_BOUNDS = {
  minLat: 25.8,
  maxLat: 36.5,
  minLng: -106.6,
  maxLng: -93.5,
};

interface Facility {
  id: string;
  place_id: string;
  name: string;
  rating: number;
  user_ratings_total: number;
  photo_references: string[];
  address: string;
  sport_types: string[];
  identified_sports: string[];
  sport_metadata: any;
  website: string | null;
  phone: string | null;
  location: {
    lat: number;
    lng: number;
  };
  cleaned_up?: boolean;
}

interface ScoredFacility extends Facility {
  quality_score: number;
  score_breakdown: {
    rating_score: number;
    review_score: number;
    photo_score: number;
    keyword_bonus: number;
    photo_limit_bonus: number;
    tourist_attraction_penalty: number;
  };
}

/**
 * Check if a facility is located in Texas based on geographic bounds
 */
function isTexasFacility(facility: Facility): boolean {
  if (!facility.location) return false;
  const { lat, lng } = facility.location;
  return (
    lat >= TEXAS_BOUNDS.minLat &&
    lat <= TEXAS_BOUNDS.maxLat &&
    lng >= TEXAS_BOUNDS.minLng &&
    lng <= TEXAS_BOUNDS.maxLng
  );
}

/**
 * Calculate quality score for a facility
 * Formula: ((0.4 × rating) + (0.3 × log(reviews)/5) + (0.2 × log(photos)/3) + (0.1 × keyword_bonus) + (0.15 × photo_limit_bonus)) × tourist_penalty
 */
function calculateQualityScore(facility: Facility): {
  score: number;
  breakdown: {
    rating_score: number;
    review_score: number;
    photo_score: number;
    keyword_bonus: number;
    photo_limit_bonus: number;
    tourist_attraction_penalty: number;
  };
} {
  // Rating component (40% weight) - normalized to 0-1 scale from 0-5 rating
  const ratingScore = (facility.rating || 0) / 5;

  // Review count component (30% weight) - logarithmic scale
  const reviewCount = facility.user_ratings_total || 0;
  const reviewScore = Math.log(reviewCount + 1) / 5;

  // Photo count component (20% weight) - logarithmic scale
  const photoCount = facility.photo_references?.length || 0;
  const photoScore = Math.log(photoCount + 1) / 3;

  // Keyword bonus component (10% weight)
  const nameLower = facility.name.toLowerCase();
  const sportTypesStr = (facility.sport_types || []).join(" ").toLowerCase();

  let keywordMatches = 0;
  for (const keyword of HIGH_QUALITY_KEYWORDS) {
    if (nameLower.includes(keyword) || sportTypesStr.includes(keyword)) {
      keywordMatches++;
    }
  }

  // Bonus is 0-1 based on keyword matches (capped at 5 matches for full bonus)
  const keywordBonus = Math.min(keywordMatches / 5, 1);

  // Photo limit bonus (15% weight) - prioritize facilities with 10+ photos
  // These are likely hitting the Google Places API limit and have more photos available
  const photoLimitBonus = photoCount >= 10 ? 1 : 0;

  // Calculate weighted total
  const baseScore =
    0.4 * ratingScore +
    0.3 * reviewScore +
    0.2 * photoScore +
    0.1 * keywordBonus +
    0.15 * photoLimitBonus;

  // Apply penalty for tourist attractions without identified sports
  const nonSportsTypes = ["tourist_attraction", "park"];
  const hasBadType = (facility.sport_types || []).some((type) =>
    nonSportsTypes.includes(type)
  );
  const hasIdentifiedSports =
    facility.identified_sports && facility.identified_sports.length > 0;

  // Only penalize if facility has non-sports type AND no identified sports
  let touristPenalty = 1.0; // No penalty by default
  if (hasBadType && !hasIdentifiedSports) {
    touristPenalty = 0.85; // 15% penalty
  }

  const finalScore = baseScore * touristPenalty;

  return {
    score: finalScore,
    breakdown: {
      rating_score: ratingScore,
      review_score: reviewScore,
      photo_score: photoScore,
      keyword_bonus: keywordBonus,
      photo_limit_bonus: photoLimitBonus,
      tourist_attraction_penalty: touristPenalty,
    },
  };
}

/**
 * Fetch all facilities from database and calculate quality scores
 */
async function fetchAndScoreFacilities(): Promise<ScoredFacility[]> {
  console.log("📊 Fetching facilities from database...\n");

  // Fetch all facilities with pagination to bypass Supabase's 1000 row limit
  const allFacilities: any[] = [];
  let from = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .rpc("get_facilities_with_coords", {
        row_limit: 100000,
        include_hidden: false,
        include_cleaned_up: false,
      })
      .range(from, from + pageSize - 1);

    if (error) {
      console.error("❌ Error fetching facilities:", error.message);
      process.exit(1);
    }

    if (data && data.length > 0) {
      allFacilities.push(...data);
      from += pageSize;

      console.log(`   Fetched ${allFacilities.length} facilities so far...`);

      // If we got fewer rows than pageSize, we've reached the end
      if (data.length < pageSize) {
        hasMore = false;
      }
    } else {
      hasMore = false;
    }
  }

  console.log(`✅ Total fetched: ${allFacilities.length} facilities\n`);

  // Transform data to match Facility interface (RPC returns flat lat/lng, we need nested location)
  const transformedData = allFacilities.map((f: any) => ({
    ...f,
    location: {
      lat: f.lat,
      lng: f.lng,
    },
  }));

  // Filter for rating >= 3.0 and must have photos
  const filteredFacilities = transformedData.filter(
    (f: Facility) =>
      f.rating >= 3.0 &&
      f.photo_references &&
      f.photo_references.length > 0
  );

  console.log(
    `✅ Fetched ${filteredFacilities.length} facilities with rating >= 3.0 and photos\n`
  );

  // Filter for Texas facilities only
  const texasFacilities = filteredFacilities.filter(isTexasFacility);
  console.log(`🌵 Filtered to ${texasFacilities.length} Texas facilities\n`);

  console.log("🧮 Calculating quality scores...\n");

  // Calculate scores for all facilities
  const scoredFacilities: ScoredFacility[] = texasFacilities.map(
    (facility: Facility) => {
      const { score, breakdown } = calculateQualityScore(facility);
      return {
        ...facility,
        quality_score: score,
        score_breakdown: breakdown,
      };
    }
  );

  // Sort by quality score (descending)
  scoredFacilities.sort((a, b) => b.quality_score - a.quality_score);

  return scoredFacilities;
}

/**
 * Generate statistics about selected facilities
 */
function generateStatistics(facilities: ScoredFacility[]): void {
  console.log("\n" + "=".repeat(70));
  console.log("📈 FACILITY STATISTICS");
  console.log("=".repeat(70));

  // Overall stats
  console.log("\n📊 Overall Metrics:");
  console.log(`   Total Facilities: ${facilities.length}`);
  console.log(
    `   Average Rating: ${(facilities.reduce((sum, f) => sum + f.rating, 0) / facilities.length).toFixed(2)}`
  );
  console.log(
    `   Average Reviews: ${Math.round(facilities.reduce((sum, f) => sum + f.user_ratings_total, 0) / facilities.length)}`
  );
  console.log(
    `   Average Photos: ${Math.round(facilities.reduce((sum, f) => sum + (f.photo_references?.length || 0), 0) / facilities.length)}`
  );
  console.log(
    `   Facilities with 10+ Photos: ${facilities.filter(f => (f.photo_references?.length || 0) >= 10).length} (${((facilities.filter(f => (f.photo_references?.length || 0) >= 10).length / facilities.length) * 100).toFixed(1)}%)`
  );
  console.log(
    `   Average Quality Score: ${(facilities.reduce((sum, f) => sum + f.quality_score, 0) / facilities.length).toFixed(3)}`
  );

  // Quality score distribution
  console.log("\n🎯 Quality Score Distribution:");
  const scoreRanges = [
    { min: 0.8, max: 1.0, label: "Excellent (0.8-1.0)" },
    { min: 0.6, max: 0.8, label: "Very Good (0.6-0.8)" },
    { min: 0.4, max: 0.6, label: "Good (0.4-0.6)" },
    { min: 0.2, max: 0.4, label: "Fair (0.2-0.4)" },
    { min: 0.0, max: 0.2, label: "Poor (0.0-0.2)" },
  ];

  for (const range of scoreRanges) {
    const count = facilities.filter(
      (f) => f.quality_score >= range.min && f.quality_score < range.max
    ).length;
    const percentage = ((count / facilities.length) * 100).toFixed(1);
    console.log(`   ${range.label}: ${count} (${percentage}%)`);
  }

  // Sport type distribution
  console.log("\n🏅 Top Sports Represented:");
  const sportCounts: Record<string, number> = {};
  facilities.forEach((f) => {
    f.identified_sports?.forEach((sport: string) => {
      sportCounts[sport] = (sportCounts[sport] || 0) + 1;
    });
  });

  const topSports = Object.entries(sportCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);

  topSports.forEach(([sport, count], index) => {
    console.log(`   ${index + 1}. ${sport}: ${count} facilities`);
  });

  // Geographic distribution (by city)
  console.log("\n🌎 Top Cities by Facility Count:");
  const cityCounts: Record<string, number> = {};
  facilities.forEach((f) => {
    const city = f.address.split(",")[1]?.trim() || "Unknown";
    cityCounts[city] = (cityCounts[city] || 0) + 1;
  });

  const topCities = Object.entries(cityCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);

  topCities.forEach(([city, count], index) => {
    console.log(`   ${index + 1}. ${city}: ${count} facilities`);
  });

  // Keyword analysis
  console.log("\n🔑 High-Quality Keyword Matches:");
  const keywordCounts: Record<string, number> = {};
  facilities.forEach((f) => {
    const nameLower = f.name.toLowerCase();
    const sportTypesStr = (f.sport_types || []).join(" ").toLowerCase();

    HIGH_QUALITY_KEYWORDS.forEach((keyword) => {
      if (nameLower.includes(keyword) || sportTypesStr.includes(keyword)) {
        keywordCounts[keyword] = (keywordCounts[keyword] || 0) + 1;
      }
    });
  });

  const topKeywords = Object.entries(keywordCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  topKeywords.forEach(([keyword, count], index) => {
    const percentage = ((count / facilities.length) * 100).toFixed(1);
    console.log(`   ${index + 1}. "${keyword}": ${count} (${percentage}%)`);
  });

  // Top facilities
  console.log("\n⭐ Top 10 Highest Scoring Facilities:");
  facilities.slice(0, 10).forEach((f, index) => {
    const photoCount = f.photo_references?.length || 0;
    const photoIndicator = photoCount >= 10 ? "📸 10+" : `${photoCount}`;
    console.log(
      `   ${index + 1}. ${f.name.substring(0, 50)}${f.name.length > 50 ? "..." : ""}`
    );
    console.log(`      Score: ${f.quality_score.toFixed(3)} | Rating: ${f.rating} | Reviews: ${f.user_ratings_total} | Photos: ${photoIndicator}`);
    console.log(
      `      Sports: ${f.identified_sports?.slice(0, 3).join(", ") || "None"}`
    );
  });

  console.log("\n" + "=".repeat(70));
}

/**
 * Main function
 */
async function selectTopFacilities() {
  console.log("🚀 High-Quality Texas Facility Selection");
  console.log("=".repeat(70));
  console.log("🎯 Goal: Select top 2,500 Texas facilities for SerpAPI enrichment");
  console.log("\n📋 Selection Criteria:");
  console.log("   • Location: Texas only (geographic bounds)");
  console.log("   • Rating >= 3.0");
  console.log("   • Must have photos");
  console.log("   • Ranked by quality score:");
  console.log("     - 40% Rating");
  console.log("     - 30% Review count (logarithmic)");
  console.log("     - 20% Photo count (logarithmic)");
  console.log("     - 10% High-quality keyword bonus");
  console.log("     - 15% Photo limit bonus (10+ photos = likely more available)");
  console.log("     - 15% penalty for tourist attractions without identified sports");
  console.log("=".repeat(70) + "\n");

  // Fetch and score facilities
  const allFacilities = await fetchAndScoreFacilities();

  // Select top 2,500
  const topFacilities = allFacilities.slice(0, 2500);

  console.log(`✅ Selected top ${topFacilities.length} Texas facilities\n`);

  // Generate statistics
  generateStatistics(topFacilities);

  // Export to JSON
  const outputDir = path.join(__dirname, "../data");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(
    outputDir,
    "top-2500-high-quality-texas-facilities.json"
  );

  const exportData = {
    metadata: {
      total_facilities: topFacilities.length,
      generated_at: new Date().toISOString(),
      selection_criteria: {
        location: "Texas only (geographic bounds)",
        texas_bounds: TEXAS_BOUNDS,
        min_rating: 3.0,
        must_have_photos: true,
        ranking_formula:
          "((0.4 × rating/5) + (0.3 × log(reviews)/5) + (0.2 × log(photos)/3) + (0.1 × keyword_bonus) + (0.15 × photo_limit_bonus)) × tourist_penalty",
        photo_limit_bonus_threshold: 10,
        tourist_attraction_penalty:
          "15% penalty (0.85x) for tourist_attraction or park without identified_sports",
      },
      average_rating: (
        topFacilities.reduce((sum, f) => sum + f.rating, 0) /
        topFacilities.length
      ).toFixed(2),
      average_reviews: Math.round(
        topFacilities.reduce((sum, f) => sum + f.user_ratings_total, 0) /
          topFacilities.length
      ),
      average_photos: Math.round(
        topFacilities.reduce(
          (sum, f) => sum + (f.photo_references?.length || 0),
          0
        ) / topFacilities.length
      ),
    },
    facilities: topFacilities.map((f) => ({
      id: f.id,
      place_id: f.place_id,
      name: f.name,
      rating: f.rating,
      user_ratings_total: f.user_ratings_total,
      photo_count: f.photo_references?.length || 0,
      address: f.address,
      location: f.location,
      sport_types: f.sport_types,
      identified_sports: f.identified_sports,
      website: f.website,
      phone: f.phone,
      quality_score: f.quality_score,
      score_breakdown: f.score_breakdown,
      has_photo_limit_bonus: (f.photo_references?.length || 0) >= 10,
    })),
  };

  fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2));

  console.log("\n💾 Export Complete:");
  console.log(`   File: ${outputPath}`);
  console.log(`   Size: ${(fs.statSync(outputPath).size / 1024 / 1024).toFixed(2)} MB`);
  console.log("\n✅ Done! Ready for SerpAPI enrichment.");
}

selectTopFacilities().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
