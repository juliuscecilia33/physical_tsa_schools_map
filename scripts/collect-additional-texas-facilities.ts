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

// Additional Texas cities (ranks 51-200 by population)
const ADDITIONAL_TEXAS_CITIES = [
  "Longview, Texas",
  "Pharr, Texas",
  "Flower Mound, Texas",
  "Cedar Park, Texas",
  "Mansfield, Texas",
  "Missouri City, Texas",
  "Leander, Texas",
  "Harlingen, Texas",
  "San Marcos, Texas",
  "North Richland Hills, Texas",
  "Spring, Texas",
  "Pflugerville, Texas",
  "Victoria, Texas",
  "Rowlett, Texas",
  "Euless, Texas",
  "Wylie, Texas",
  "Kyle, Texas",
  "DeSoto, Texas",
  "Port Arthur, Texas",
  "Texas City, Texas",
  "Little Elm, Texas",
  "Galveston, Texas",
  "Burleson, Texas",
  "Rockwall, Texas",
  "Grapevine, Texas",
  "Bedford, Texas",
  "Cedar Hill, Texas",
  "Huntsville, Texas",
  "Sherman, Texas",
  "Keller, Texas",
  "Haltom City, Texas",
  "The Colony, Texas",
  "Waxahachie, Texas",
  "Schertz, Texas",
  "Channelview, Texas",
  "Weslaco, Texas",
  "Coppell, Texas",
  "Friendswood, Texas",
  "Lancaster, Texas",
  "Rosenberg, Texas",
  "Hurst, Texas",
  "Duncanville, Texas",
  "Midlothian, Texas",
  "Copperas Cove, Texas",
  "Prosper, Texas",
  "Socorro, Texas",
  "La Porte, Texas",
  "Farmers Branch, Texas",
  "Mission Bend, Texas",
  "San Juan, Texas",
  "Texarkana, Texas",
  "Weatherford, Texas",
  "Hutto, Texas",
  "Timberwood Park, Texas",
  "Cibolo, Texas",
  "Fulshear, Texas",
  "Del Rio, Texas",
  "Cleburne, Texas",
  "Celina, Texas",
  "Lufkin, Texas",
  "Harker Heights, Texas",
  "Deer Park, Texas",
  "Canyon Lake, Texas",
  "Seguin, Texas",
  "West Odessa, Texas",
  "Nacogdoches, Texas",
  "Forney, Texas",
  "Greenville, Texas",
  "Southlake, Texas",
  "Sachse, Texas",
  "Converse, Texas",
  "Eagle Pass, Texas",
  "Alvin, Texas",
  "Lake Jackson, Texas",
  "Balch Springs, Texas",
  "Fort Hood, Texas",
  "Colleyville, Texas",
  "Denison, Texas",
  "Corsicana, Texas",
  "Princeton, Texas",
  "Katy, Texas",
  "University Park, Texas",
  "Kingsville, Texas",
  "Sienna, Texas",
  "Saginaw, Texas",
  "Paris, Texas",
  "Kerrville, Texas",
  "San Benito, Texas",
  "Fresno, Texas",
  "Benbrook, Texas",
  "Belton, Texas",
  "Anna, Texas",
  "Pecan Grove, Texas",
  "Cloverleaf, Texas",
  "Big Spring, Texas",
  "Marshall, Texas",
  "Horizon City, Texas",
  "Corinth, Texas",
  "Watauga, Texas",
  "Fate, Texas",
  "Ennis, Texas",
  "Dickinson, Texas",
  "Stephenville, Texas",
  "Murphy, Texas",
  "Portland, Texas",
  "Boerne, Texas",
  "Terrell, Texas",
  "Alamo, Texas",
  "Alton, Texas",
  "Universal City, Texas",
  "Melissa, Texas",
  "Royse City, Texas",
  "Angleton, Texas",
  "Plainview, Texas",
  "Brushy Creek, Texas",
  "Crowley, Texas",
  "Seagoville, Texas",
  "Lakeway, Texas",
  "La Marque, Texas",
  "Orange, Texas",
  "Palestine, Texas",
  "Brownwood, Texas",
  "Brenham, Texas",
  "Steiner Ranch, Texas",
  "Cinco Ranch, Texas",
  "Manor, Texas",
  "Nederland, Texas",
  "White Settlement, Texas",
  "Glenn Heights, Texas",
  "Gainesville, Texas",
  "Bay City, Texas",
  "Alice, Texas",
  "Stafford, Texas",
  "Addison, Texas",
  "Bellaire, Texas",
  "Aldine, Texas",
  "Taylor, Texas",
  "Red Oak, Texas",
  "Groves, Texas",
  "Donna, Texas",
  "Mercedes, Texas",
  "Pampa, Texas",
  "Humble, Texas",
  "Hewitt, Texas",
  "Sulphur Springs, Texas",
  "Gatesville, Texas",
  "Mount Pleasant, Texas",
  "Highland Village, Texas",
  "South Houston, Texas",
  "Live Oak, Texas",
  "Palmview, Texas",
  "Buda, Texas",
  "Canyon, Texas",
];

// Athletic facility search queries
const FACILITY_SEARCHES = [
  "soccer field",
  "football field",
  "baseball field",
  "basketball court",
  "sports park",
  "athletic park",
  "athletic complex",
  "recreation park",
  "tennis court",
  "volleyball court",
];

// ===== FACILITY VALIDATION CONSTANTS =====

// Non-sport facility types to filter out
const NON_SPORT_TYPES = [
  "food",
  "restaurant",
  "cafe",
  "bar",
  "lodging",
  "hotel",
  "motel",
  "store",
  "clothing_store",
  "shopping_mall",
  "amusement_park",
  "movie_theater",
  "aquarium",
  "night_club",
  "tourist_attraction",
  "bowling_alley",
  "ice_skating_rink",
  "ski_resort",
  "playground",
];

// Athletic facility types to keep
const KEEP_TYPES = [
  "park",
  "gym",
  "stadium",
  "athletic_field",
  "fitness_center",
  "sports_complex",
  "sports_club",
  "swimming_pool",
  "tennis_court",
  "golf_course",
  "basketball_court",
  "baseball_field",
  "soccer_field",
  "football_field",
  "community_center",
  "recreation_center",
  "school",
];

// ===== SPORT IDENTIFICATION CONSTANTS =====

const SPORT_KEYWORDS = {
  Basketball: ["basketball", "bball", "hoops"],
  Soccer: ["soccer", "futbol"],
  Baseball: ["baseball", "diamond"],
  Football: ["football", "gridiron"],
  Tennis: ["tennis"],
  Volleyball: ["volleyball", "vball"],
  Swimming: ["swimming", "pool", "aquatic", "natatorium"],
  "Track & Field": ["track", "track and field", "athletics"],
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
  "Gym/Fitness": [
    "gym",
    "fitness",
    "24 hour fitness",
    "la fitness",
    "anytime fitness",
    "planet fitness",
    "gold's gym",
    "lifetime fitness",
  ],
  CrossFit: ["crossfit"],
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
  ],
  Boxing: ["boxing"],
  Bowling: ["bowling"],
  Skating: ["skating", "skate park", "roller"],
  Climbing: ["climbing", "bouldering"],
  "Water Sports": ["kayak", "canoe", "rowing", "sailing"],
};

interface SportMetadata {
  score: number;
  sources: Array<"name" | "review" | "api">;
  keywords_matched: string[];
  confidence: "high" | "medium" | "low";
  matched_text?: string;
}

interface EnhancedProgressState {
  processedCities: string[];
  totalFacilities: number;
  statistics: {
    searched: number;
    filteredNonSport: number;
    filteredDuplicate: number;
    filteredLowQuality: number;
    inserted: number;
  };
  lastUpdated: Date;
}

interface FilterResult {
  passed: boolean;
  reason?: string;
}

const PROGRESS_FILE = path.join(
  __dirname,
  "../.additional-facilities-progress.json"
);
const PROXIMITY_THRESHOLD_METERS = 50; // 50 meters for duplicate detection
const COMPLETENESS_THRESHOLD = 30; // Minimum completeness score (0-100)

// Rate limiting helper
const delay = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

// ===== PROGRESS TRACKING =====

function loadProgress(): EnhancedProgressState {
  if (fs.existsSync(PROGRESS_FILE)) {
    const data = fs.readFileSync(PROGRESS_FILE, "utf-8");
    return JSON.parse(data);
  }
  return {
    processedCities: [],
    totalFacilities: 0,
    statistics: {
      searched: 0,
      filteredNonSport: 0,
      filteredDuplicate: 0,
      filteredLowQuality: 0,
      inserted: 0,
    },
    lastUpdated: new Date(),
  };
}

function saveProgress(progress: EnhancedProgressState) {
  progress.lastUpdated = new Date();
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

// ===== VALIDATION FUNCTIONS =====

/**
 * Filter 1: Check if place_id already exists in database
 */
async function facilityExists(placeId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("sports_facilities")
    .select("place_id")
    .eq("place_id", placeId)
    .limit(1);

  if (error) {
    console.error(`  ⚠️  Error checking existence: ${error.message}`);
    return false;
  }

  return data && data.length > 0;
}

/**
 * Filter 2: Check if a facility exists within proximity threshold
 */
async function findNearbyFacility(
  lat: number,
  lng: number
): Promise<boolean> {
  const { data, error } = await supabase.rpc("find_nearby_facilities", {
    lat,
    lng,
    radius_meters: PROXIMITY_THRESHOLD_METERS,
  });

  if (error) {
    // If function doesn't exist, skip this check
    if (error.message.includes("does not exist")) {
      return false;
    }
    console.error(`  ⚠️  Error checking proximity: ${error.message}`);
    return false;
  }

  return data && data.length > 0;
}

/**
 * Filter 3: Validate if facility is an athletic facility
 */
function isValidAthleticFacility(types: string[]): FilterResult {
  // Check if facility has ANY athletic/sport type we want to keep
  const hasAthletic = types.some(
    (type) =>
      KEEP_TYPES.includes(type) ||
      type.includes("sport") ||
      type.includes("field") ||
      type.includes("court")
  );

  // Check if facility has ANY non-sport type
  const hasNonSport = types.some((type) => NON_SPORT_TYPES.includes(type));

  // Keep if: has athletic types OR (no non-sport types)
  // Filter out if: has non-sport types AND no athletic types
  if (hasNonSport && !hasAthletic) {
    const nonSportFound = types.filter((t) => NON_SPORT_TYPES.includes(t));
    return {
      passed: false,
      reason: `Non-sport facility (${nonSportFound.join(", ")})`,
    };
  }

  if (!hasAthletic) {
    return {
      passed: false,
      reason: "No athletic/sport types found",
    };
  }

  return { passed: true };
}

/**
 * Filter 4: Calculate facility completeness score
 */
function calculateCompletenessScore(place: any): number {
  let score = 0;

  // Has rating (25 points)
  if (place.rating) {
    score += 25;
  }

  // Has reviews (25 points, scaled by count)
  if (place.user_ratings_total) {
    const reviewPoints = Math.min(25, (place.user_ratings_total / 10) * 5);
    score += reviewPoints;
  }

  // Has photos (20 points)
  if (place.photos && place.photos.length > 0) {
    score += 20;
  }

  // Has contact info (15 points)
  if (place.formatted_phone_number || place.website) {
    score += 15;
  }

  // Has opening hours (15 points)
  if (place.opening_hours) {
    score += 15;
  }

  return Math.round(score);
}

// ===== SPORT IDENTIFICATION FUNCTIONS =====

/**
 * Find matching keywords in text
 */
function findMatchingKeywords(
  sport: string,
  text: string
): { keywords: string[]; matchedText: string } {
  const keywords =
    SPORT_KEYWORDS[sport as keyof typeof SPORT_KEYWORDS] || [];
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
 * Calculate confidence score for sport identification
 */
function calculateScore(
  sources: Array<"name" | "review" | "api">,
  keywordLength: number,
  reviewPosition?: number
): number {
  let score = 0;

  if (sources.includes("name")) {
    // Name match: 85-100 based on keyword specificity
    score = 85 + Math.min(15, keywordLength);
  } else if (sources.includes("api")) {
    // API match: 70-80
    score = 70 + Math.min(10, keywordLength);
  } else if (sources.includes("review")) {
    // Review match: 25-50 based on position
    const positionBonus =
      reviewPosition !== undefined ? Math.max(0, 10 - reviewPosition * 2) : 0;
    score = 25 + positionBonus + Math.min(15, keywordLength);
  }

  // Multiple sources bonus
  if (sources.length > 1) {
    score = Math.min(100, score + 10);
  }

  return score;
}

/**
 * Identify sports from facility name
 */
function identifySportsFromName(name: string): {
  sports: string[];
  metadata: Record<string, SportMetadata>;
} {
  const sports = new Set<string>();
  const metadata: Record<string, SportMetadata> = {};

  for (const [sport, keywords] of Object.entries(SPORT_KEYWORDS)) {
    const match = findMatchingKeywords(sport, name);
    if (match.keywords.length > 0) {
      sports.add(sport);
      const keywordSpecificity = Math.max(
        ...match.keywords.map((k) => k.length)
      );
      const score = calculateScore(["name"], keywordSpecificity);

      metadata[sport] = {
        score,
        sources: ["name"],
        keywords_matched: match.keywords,
        confidence: score >= 70 ? "high" : "medium",
        matched_text: match.matchedText,
      };
    }
  }

  return { sports: Array.from(sports), metadata };
}

/**
 * Identify sports from reviews
 */
function identifySportsFromReviews(reviews: any[] | undefined): {
  sports: string[];
  metadata: Record<string, SportMetadata>;
} {
  const sports = new Set<string>();
  const metadata: Record<string, SportMetadata> = {};

  if (!reviews || reviews.length === 0) {
    return { sports: Array.from(sports), metadata };
  }

  for (const [sport, keywords] of Object.entries(SPORT_KEYWORDS)) {
    let matchFound = false;
    for (let i = 0; i < Math.min(10, reviews.length); i++) {
      const reviewText = reviews[i].text || "";
      const match = findMatchingKeywords(sport, reviewText);

      if (match.keywords.length > 0) {
        sports.add(sport);
        const score = calculateScore(["review"], match.keywords.length, i);

        metadata[sport] = {
          score,
          sources: ["review"],
          keywords_matched: match.keywords,
          confidence: score >= 70 ? "high" : score >= 30 ? "medium" : "low",
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
 * Merge sport metadata from multiple sources
 */
function mergeSportMetadata(
  existing: SportMetadata | undefined,
  newMetadata: SportMetadata
): SportMetadata {
  if (!existing) {
    return newMetadata;
  }

  const sourcesSet = new Set([...existing.sources, ...newMetadata.sources]);
  const mergedSources = Array.from(sourcesSet) as Array<"name" | "review" | "api">;

  const keywordsSet = new Set([...existing.keywords_matched, ...newMetadata.keywords_matched]);
  const mergedKeywords = Array.from(keywordsSet);
  const mergedScore = Math.max(existing.score, newMetadata.score);

  let mergedMatchedText = existing.matched_text || "";
  if (newMetadata.sources.includes("name")) {
    mergedMatchedText = newMetadata.matched_text || mergedMatchedText;
  } else if (
    !existing.sources.includes("name") &&
    newMetadata.sources.includes("api")
  ) {
    mergedMatchedText = newMetadata.matched_text || mergedMatchedText;
  }

  const confidence =
    mergedScore >= 70 ? "high" : mergedScore >= 30 ? "medium" : "low";

  return {
    score: mergedScore,
    sources: mergedSources,
    keywords_matched: mergedKeywords,
    confidence,
    matched_text: mergedMatchedText,
  };
}

/**
 * Identify all sports for a facility
 */
function identifyFacilitySports(
  name: string,
  reviews: any[]
): {
  identified_sports: string[];
  sport_metadata: Record<string, SportMetadata>;
} {
  const allMetadata: Record<string, SportMetadata> = {};
  const sportsSet = new Set<string>();

  // Step 1: Analyze name
  const nameResult = identifySportsFromName(name);
  nameResult.sports.forEach((sport) => sportsSet.add(sport));
  Object.entries(nameResult.metadata).forEach(([sport, metadata]) => {
    allMetadata[sport] = mergeSportMetadata(allMetadata[sport], metadata);
  });

  // Step 2: Analyze reviews
  const reviewResult = identifySportsFromReviews(reviews);
  reviewResult.sports.forEach((sport) => sportsSet.add(sport));
  Object.entries(reviewResult.metadata).forEach(([sport, metadata]) => {
    allMetadata[sport] = mergeSportMetadata(allMetadata[sport], metadata);
  });

  const finalSports = Array.from(sportsSet);

  return {
    identified_sports: finalSports,
    sport_metadata: allMetadata,
  };
}

// ===== COLLECTION FUNCTIONS =====

/**
 * Search for places using text search
 */
async function searchPlacesByText(query: string): Promise<string[]> {
  try {
    const response = await client.textSearch({
      params: {
        query,
        key: GOOGLE_API_KEY,
      },
    });

    if (
      response.data.status !== "OK" &&
      response.data.status !== "ZERO_RESULTS"
    ) {
      console.error(`  ⚠️  Search status: ${response.data.status}`);
      return [];
    }

    return response.data.results.map((place) => place.place_id!).filter(Boolean);
  } catch (error: any) {
    console.error(`  ⚠️  Error searching:`, error.message);
    return [];
  }
}

/**
 * Fetch place details and apply all filters
 */
async function fetchAndValidatePlace(
  placeId: string,
  progress: EnhancedProgressState
): Promise<{ success: boolean; facility?: any; filterReason?: string }> {
  try {
    await delay(500); // Rate limiting

    const response = await client.placeDetails({
      params: {
        place_id: placeId,
        fields: [
          "place_id",
          "name",
          "types",
          "formatted_address",
          "geometry",
          "formatted_phone_number",
          "website",
          "rating",
          "user_ratings_total",
          "reviews",
          "photos",
          "opening_hours",
          "business_status",
        ],
        key: GOOGLE_API_KEY,
      },
    });

    if (response.data.status !== "OK") {
      return { success: false, filterReason: "API error" };
    }

    const place = response.data.result;

    // Filter 3: Validate athletic facility types
    const validationResult = isValidAthleticFacility(place.types || []);
    if (!validationResult.passed) {
      progress.statistics.filteredNonSport++;
      return {
        success: false,
        filterReason: validationResult.reason,
      };
    }

    // Filter 4: Check completeness score
    const completenessScore = calculateCompletenessScore(place);
    if (completenessScore < COMPLETENESS_THRESHOLD) {
      progress.statistics.filteredLowQuality++;
      return {
        success: false,
        filterReason: `Low quality (score: ${completenessScore}/${COMPLETENESS_THRESHOLD})`,
      };
    }

    // Identify sports
    const sportIdentification = identifyFacilitySports(
      place.name || "",
      place.reviews || []
    );

    // Build facility data
    const facilityData = {
      place_id: place.place_id!,
      name: place.name || "Unknown",
      sport_types: place.types || [],
      identified_sports: sportIdentification.identified_sports,
      sport_metadata: sportIdentification.sport_metadata,
      address: place.formatted_address || "",
      location: `POINT(${place.geometry?.location.lng || 0} ${
        place.geometry?.location.lat || 0
      })`,
      phone: place.formatted_phone_number,
      website: place.website,
      rating: place.rating,
      user_ratings_total: place.user_ratings_total,
      reviews: place.reviews?.map((review) => ({
        author_name: review.author_name,
        rating: review.rating,
        text: review.text,
        time: review.time,
        relative_time_description: review.relative_time_description,
      })),
      photo_references: place.photos?.map((photo) => photo.photo_reference),
      opening_hours: place.opening_hours
        ? {
            open_now: place.opening_hours.open_now,
            weekday_text: place.opening_hours.weekday_text,
          }
        : null,
      business_status: place.business_status,
    };

    return { success: true, facility: facilityData };
  } catch (error: any) {
    console.error(`  ⚠️  Error processing place:`, error.message);
    return { success: false, filterReason: "Processing error" };
  }
}

/**
 * Insert facility into database
 */
async function insertFacility(facilityData: any): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("sports_facilities")
      .upsert(facilityData, { onConflict: "place_id" });

    if (error) {
      console.error(
        `  ⚠️  Error inserting ${facilityData.name}:`,
        error.message
      );
      return false;
    }

    return true;
  } catch (error: any) {
    console.error(`  ⚠️  Error inserting facility:`, error.message);
    return false;
  }
}

/**
 * Process a single city
 */
async function processCity(
  city: string,
  cityIndex: number,
  totalCities: number,
  progress: EnhancedProgressState
): Promise<void> {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`📍 [${cityIndex + 1}/${totalCities}] Processing: ${city}`);
  console.log("=".repeat(60));

  const placeIds = new Set<string>();

  // Search all facility types in this city
  for (let i = 0; i < FACILITY_SEARCHES.length; i++) {
    const facilityType = FACILITY_SEARCHES[i];
    const query = `${facilityType} in ${city}`;

    console.log(
      `  [${i + 1}/${FACILITY_SEARCHES.length}] Searching: ${facilityType}...`
    );

    const ids = await searchPlacesByText(query);
    ids.forEach((id) => placeIds.add(id));

    console.log(`    Found ${ids.length} results`);

    await delay(500); // Rate limiting between searches
  }

  console.log(`\n  🔍 Total unique facilities found: ${placeIds.size}`);
  progress.statistics.searched += placeIds.size;

  let insertedCount = 0;
  let processed = 0;
  const filterStats = {
    duplicate: 0,
    nonSport: 0,
    lowQuality: 0,
  };

  // Convert Set to Array for iteration
  const placeIdsArray = Array.from(placeIds);

  // Process each facility
  for (const placeId of placeIdsArray) {
    processed++;

    // Filter 1: Check if already in database (by place_id)
    const exists = await facilityExists(placeId);
    if (exists) {
      filterStats.duplicate++;
      progress.statistics.filteredDuplicate++;
      continue;
    }

    // Fetch and validate
    const result = await fetchAndValidatePlace(placeId, progress);

    if (!result.success) {
      if (result.filterReason?.includes("Non-sport")) {
        filterStats.nonSport++;
      } else if (result.filterReason?.includes("Low quality")) {
        filterStats.lowQuality++;
      }
      continue;
    }

    // Filter 2: Check proximity (optional, only if facility has location)
    if (result.facility && result.facility.location) {
      const coords = result.facility.location
        .replace("POINT(", "")
        .replace(")", "")
        .split(" ");
      const lng = parseFloat(coords[0]);
      const lat = parseFloat(coords[1]);

      if (lng && lat) {
        const nearbyExists = await findNearbyFacility(lat, lng);
        if (nearbyExists) {
          filterStats.duplicate++;
          progress.statistics.filteredDuplicate++;
          continue;
        }
      }
    }

    // Insert facility
    const inserted = await insertFacility(result.facility);
    if (inserted) {
      insertedCount++;
      progress.totalFacilities++;
      progress.statistics.inserted++;

      // Show sports identified
      const sports = result.facility.identified_sports || [];
      const sportsDisplay =
        sports.length > 0
          ? sports
              .map((sport: string) => {
                const metadata = result.facility.sport_metadata[sport];
                return metadata ? `${sport}(${metadata.score})` : sport;
              })
              .join(", ")
          : "none";

      if (insertedCount % 5 === 0) {
        console.log(
          `  ✅ [${processed}/${placeIdsArray.length}] Inserted ${insertedCount} facilities`
        );
      }
      if (sports.length > 0) {
        console.log(
          `     Latest: ${result.facility.name.substring(0, 40)}... → ${sportsDisplay}`
        );
      }
    }
  }

  console.log(`\n  ✅ City Complete:`);
  console.log(`     Searched: ${placeIdsArray.length}`);
  console.log(`     Inserted: ${insertedCount}`);
  console.log(`     Filtered:`);
  console.log(`       - Duplicate: ${filterStats.duplicate}`);
  console.log(`       - Non-sport: ${filterStats.nonSport}`);
  console.log(`       - Low quality: ${filterStats.lowQuality}`);
  console.log(`     Total in database: ${progress.totalFacilities}`);
}

/**
 * Main collection function
 */
async function collectAdditionalFacilities() {
  console.log("🚀 Enhanced Texas Athletic Facilities Collection");
  console.log("=" .repeat(60));
  console.log(`📊 Cities: ${ADDITIONAL_TEXAS_CITIES.length} additional Texas cities (ranks 51-200)`);
  console.log(`🏃 Facility Types: ${FACILITY_SEARCHES.length} types per city`);
  console.log(`\n🔧 Robustness Features Enabled:`);
  console.log(`   ✓ Auto-cleanup (filters non-sport facilities)`);
  console.log(`   ✓ Proximity deduplication (${PROXIMITY_THRESHOLD_METERS}m threshold)`);
  console.log(`   ✓ Completeness scoring (min: ${COMPLETENESS_THRESHOLD}/100)`);
  console.log(`   ✓ Immediate sport identification with confidence scores`);
  console.log("=" .repeat(60) + "\n");

  const progress = loadProgress();

  if (progress.processedCities.length > 0) {
    console.log(
      `♻️  Resuming: ${progress.processedCities.length}/${ADDITIONAL_TEXAS_CITIES.length} cities processed\n`
    );
    console.log(`   Total facilities: ${progress.totalFacilities}`);
    console.log(`   Filters applied:`);
    console.log(`     - Duplicate: ${progress.statistics.filteredDuplicate}`);
    console.log(`     - Non-sport: ${progress.statistics.filteredNonSport}`);
    console.log(
      `     - Low quality: ${progress.statistics.filteredLowQuality}\n`
    );
  }

  const startTime = Date.now();

  for (let i = 0; i < ADDITIONAL_TEXAS_CITIES.length; i++) {
    const city = ADDITIONAL_TEXAS_CITIES[i];

    // Skip already processed cities
    if (progress.processedCities.includes(city)) {
      continue;
    }

    try {
      await processCity(city, i, ADDITIONAL_TEXAS_CITIES.length, progress);

      progress.processedCities.push(city);
      saveProgress(progress);

      // Progress summary every 5 cities
      if (progress.processedCities.length % 5 === 0) {
        const elapsed = (Date.now() - startTime) / 1000 / 60; // minutes
        const rate = progress.processedCities.length / elapsed;
        const remaining =
          ADDITIONAL_TEXAS_CITIES.length - progress.processedCities.length;
        const eta = remaining / rate;

        console.log("\n" + "=".repeat(60));
        console.log("📊 Overall Progress:");
        console.log(
          `   Cities: ${progress.processedCities.length}/${ADDITIONAL_TEXAS_CITIES.length}`
        );
        console.log(`   Total Facilities: ${progress.totalFacilities}`);
        console.log(`   Statistics:`);
        console.log(`     - Searched: ${progress.statistics.searched}`);
        console.log(`     - Inserted: ${progress.statistics.inserted}`);
        console.log(
          `     - Filtered Duplicate: ${progress.statistics.filteredDuplicate}`
        );
        console.log(
          `     - Filtered Non-Sport: ${progress.statistics.filteredNonSport}`
        );
        console.log(
          `     - Filtered Low Quality: ${progress.statistics.filteredLowQuality}`
        );
        console.log(`   Elapsed: ${elapsed.toFixed(0)} minutes`);
        console.log(
          `   ETA: ${eta.toFixed(0)} minutes (~${(eta / 60).toFixed(1)} hours)`
        );
        console.log("=".repeat(60) + "\n");
      }
    } catch (error: any) {
      console.error(`\n❌ Error processing ${city}:`, error.message);
      console.log("   Saving progress and continuing...\n");
      saveProgress(progress);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("🎉 Collection Complete!");
  console.log("=".repeat(60));
  console.log(`📊 Final Statistics:`);
  console.log(`   Cities Processed: ${progress.processedCities.length}/${ADDITIONAL_TEXAS_CITIES.length}`);
  console.log(`   Total Facilities Added: ${progress.statistics.inserted}`);
  console.log(`   Quality Metrics:`);
  console.log(`     - Total Searched: ${progress.statistics.searched}`);
  console.log(`     - Passed All Filters: ${progress.statistics.inserted}`);
  console.log(
    `     - Filter Rate: ${((progress.statistics.inserted / progress.statistics.searched) * 100).toFixed(1)}%`
  );
  console.log(`   Filters Applied:`);
  console.log(
    `     - Duplicate: ${progress.statistics.filteredDuplicate} (${((progress.statistics.filteredDuplicate / progress.statistics.searched) * 100).toFixed(1)}%)`
  );
  console.log(
    `     - Non-Sport: ${progress.statistics.filteredNonSport} (${((progress.statistics.filteredNonSport / progress.statistics.searched) * 100).toFixed(1)}%)`
  );
  console.log(
    `     - Low Quality: ${progress.statistics.filteredLowQuality} (${((progress.statistics.filteredLowQuality / progress.statistics.searched) * 100).toFixed(1)}%)`
  );
  console.log(
    `   Runtime: ${((Date.now() - startTime) / 1000 / 60 / 60).toFixed(2)} hours`
  );
  console.log("=".repeat(60));

  // Clean up progress file
  if (fs.existsSync(PROGRESS_FILE)) {
    fs.unlinkSync(PROGRESS_FILE);
  }
}

// Run the collection
collectAdditionalFacilities().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
