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
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!GOOGLE_API_KEY || !supabaseUrl || !supabaseAnonKey) {
  console.error("❌ Error: Missing required environment variables");
  process.exit(1);
}

if (!supabaseServiceKey) {
  console.error("❌ Error: SUPABASE_SERVICE_ROLE_KEY not found");
  console.error("   This script requires service role key to bypass RLS policies");
  console.error("   Add SUPABASE_SERVICE_ROLE_KEY to your .env.local file");
  process.exit(1);
}

// Create admin client with service role key (bypasses RLS)
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// ===== TARGET CITIES =====
// Original large cities (already collected - commented out)
/*
const TARGET_CITIES = [
  "Houston, Texas",
  "San Antonio, Texas",
  "Dallas, Texas",
  "Austin, Texas",
  "Fort Worth, Texas",
  "El Paso, Texas",
  "Arlington, Texas",
  "Corpus Christi, Texas",
  "Plano, Texas",
  "Laredo, Texas",
  "Lubbock, Texas",
  "Irving, Texas",
  "Garland, Texas",
  "Frisco, Texas",
  "McKinney, Texas",
  "Grand Prairie, Texas",
  "Amarillo, Texas",
  "Brownsville, Texas",
  "Pasadena, Texas",
  "Mesquite, Texas",
  "Killeen, Texas",
  "McAllen, Texas",
  "Denton, Texas",
  "Waco, Texas",
  "Carrollton, Texas",
  "Pearland, Texas",
  "College Station, Texas",
  "Round Rock, Texas",
  "Richardson, Texas",
  "League City, Texas",
];
*/

// ===== SMALL TEXAS CITIES =====
// Focus on county seats and regional hubs (1,000-50,000 population)
// Organized by region for better tracking
const SMALL_TEXAS_CITIES = [
  // PANHANDLE & PLAINS
  "Dumas, Texas",
  "Childress, Texas",
  "Perryton, Texas",
  "Dalhart, Texas",
  "Hereford, Texas",
  "Tulia, Texas",
  "Canadian, Texas",
  "Borger, Texas",
  "Muleshoe, Texas",
  "Levelland, Texas",
  "Post, Texas",
  "Slaton, Texas",
  "Spur, Texas",
  "Clarendon, Texas",
  "Memphis, Texas",
  "Wellington, Texas",
  "Quanah, Texas",
  "Snyder, Texas",
  "Lamesa, Texas",
  "Seminole, Texas",
  "Kermit, Texas",
  "Seagraves, Texas",
  "Brownfield, Texas",
  "Tahoka, Texas",
  "Morton, Texas",
  "Littlefield, Texas",
  "Abernathy, Texas",
  "Crosbyton, Texas",
  "Floydada, Texas",
  "Matador, Texas",
  "Paducah, Texas",
  "Crowell, Texas",

  // WEST TEXAS & PERMIAN BASIN
  "Mentone, Texas",
  "Crane, Texas",
  "McCamey, Texas",
  "Rankin, Texas",
  "Garden City, Texas",
  "Sterling City, Texas",

  // TRANS-PECOS
  "Alpine, Texas",
  "Marfa, Texas",
  "Fort Davis, Texas",
  "Van Horn, Texas",
  "Sierra Blanca, Texas",
  "Pecos, Texas",
  "Fort Stockton, Texas",
  "Sanderson, Texas",
  "Presidio, Texas",

  // NORTH CENTRAL
  "Breckenridge, Texas",
  "Graham, Texas",
  "Decatur, Texas",
  "Granbury, Texas",
  "Hillsboro, Texas",
  "Mineral Wells, Texas",
  "Jacksboro, Texas",
  "Eastland, Texas",
  "Comanche, Texas",
  "Hamilton, Texas",
  "Meridian, Texas",
  "Glen Rose, Texas",
  "Hico, Texas",
  "Dublin, Texas",
  "Cisco, Texas",

  // HILL COUNTRY
  "Brady, Texas",
  "Fredericksburg, Texas",
  "Llano, Texas",
  "Burnet, Texas",
  "Marble Falls, Texas",
  "Johnson City, Texas",
  "Lampasas, Texas",
  "Goldthwaite, Texas",
  "San Saba, Texas",
  "Mason, Texas",
  "Junction, Texas",
  "Rocksprings, Texas",
  "Bandera, Texas",
  "Comfort, Texas",
  "Blanco, Texas",
  "Wimberley, Texas",
  "Dripping Springs, Texas",
  "Uvalde, Texas",

  // EAST TEXAS
  "Crockett, Texas",
  "Jasper, Texas",
  "Center, Texas",
  "Carthage, Texas",
  "Gilmer, Texas",
  "Henderson, Texas",
  "Rusk, Texas",
  "Athens, Texas",
  "Canton, Texas",
  "Mt. Vernon, Texas",
  "Quitman, Texas",
  "Pittsburg, Texas",
  "Winnsboro, Texas",
  "Mineola, Texas",
  "Jefferson, Texas",
  "San Augustine, Texas",
  "Hemphill, Texas",
  "Woodville, Texas",
  "Livingston, Texas",

  // SOUTHEAST TEXAS
  "Liberty, Texas",
  "Silsbee, Texas",
  "Kountze, Texas",
  "Anahuac, Texas",
  "Dayton, Texas",
  "Winnie, Texas",

  // SOUTH TEXAS
  "Karnes City, Texas",
  "Falfurrias, Texas",
  "Hebbronville, Texas",
  "Carrizo Springs, Texas",
  "Crystal City, Texas",
  "Cotulla, Texas",
  "Pleasanton, Texas",
  "Jourdanton, Texas",
  "Pearsall, Texas",
  "Dilley, Texas",
  "Beeville, Texas",
  "Goliad, Texas",
  "Cuero, Texas",
  "Yorktown, Texas",
  "Hallettsville, Texas",
  "Yoakum, Texas",
  "Gonzales, Texas",
  "Kenedy, Texas",
  "Rio Grande City, Texas",
  "Roma, Texas",
  "Zapata, Texas",
  "Raymondville, Texas",
  "Port Isabel, Texas",

  // CENTRAL CORRIDOR
  "Cameron, Texas",
  "Groesbeck, Texas",
  "Madisonville, Texas",
  "Rockdale, Texas",
  "Caldwell, Texas",
  "Franklin, Texas",
  "Hearne, Texas",
  "Mexia, Texas",
  "Marlin, Texas",
  "Navasota, Texas",
];

// ===== MEDIUM TEXAS CITIES =====
// Cities with 50,000-140,000 population not covered in TARGET_CITIES
// These are major cities that were missing from the original collection
const MEDIUM_TEXAS_CITIES = [
  // HOUSTON METRO AREA
  "The Woodlands, Texas",
  "Sugar Land, Texas",
  "Atascocita, Texas",
  "Baytown, Texas",
  "Missouri City, Texas",
  "Spring, Texas",
  "Texas City, Texas",
  "Conroe, Texas",

  // DFW METROPLEX
  "Lewisville, Texas",
  "Allen, Texas",
  "Flower Mound, Texas",
  "Mansfield, Texas",
  "North Richland Hills, Texas",
  "Rowlett, Texas",
  "Euless, Texas",
  "Wylie, Texas",
  "Little Elm, Texas",
  "Burleson, Texas",
  "Rockwall, Texas",
  "Grapevine, Texas",
  "DeSoto, Texas",

  // AUSTIN METRO AREA
  "Georgetown, Texas",
  "Cedar Park, Texas",
  "Leander, Texas",
  "Pflugerville, Texas",
  "Kyle, Texas",
  "San Marcos, Texas",

  // RIO GRANDE VALLEY
  "Edinburg, Texas",
  "Mission, Texas",
  "Pharr, Texas",
  "Harlingen, Texas",

  // WEST TEXAS
  "Midland, Texas",
  "Odessa, Texas",
  "Abilene, Texas",
  "San Angelo, Texas",

  // EAST TEXAS
  "Tyler, Texas",
  "Longview, Texas",

  // SOUTHEAST TEXAS
  "Beaumont, Texas",
  "Port Arthur, Texas",

  // CENTRAL/HILL COUNTRY
  "New Braunfels, Texas",
  "Temple, Texas",
  "Bryan, Texas",

  // NORTH TEXAS
  "Wichita Falls, Texas",

  // GULF COAST
  "Galveston, Texas",
  "Victoria, Texas",
];

// ===== HIGH-QUALITY SEARCH QUERIES =====
const HIGH_QUALITY_SEARCHES = [
  // Indoor multi-sport facilities
  "indoor sports complex",
  "indoor athletic facility",
  "fieldhouse",
  "sports dome",
  "indoor sports arena",

  // Basketball/Volleyball
  "indoor basketball facility",
  "volleyball training center",
  "basketball academy",

  // Baseball/Softball
  "baseball training facility",
  "batting cage complex",
  "indoor baseball academy",

  // Athletic performance/training
  "athletic performance center",
  "sports performance training",
  "speed and agility training center",
  "athlete training facility",

  // High-quality outdoor
  "premier sports complex",
  "championship sports fields",
  "tournament sports facility",
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

// Specific high-quality facility chains to search for
const FACILITY_CHAINS = [
  "FieldhouseUSA",
  "Game On Sports",
  "TOCA Soccer",
  "PIT Fitness",
  "D-BAT",
  "Athletic Republic",
  "Parisi Speed School",
  "Sports Academy",
  "Velocity Sports Performance",
];

// ===== QUALITY THRESHOLDS FOR MEDIUM CITIES =====
const MIN_RATING = 4.0; // Higher standard for larger cities
const MIN_REVIEWS = 10; // Higher standard for larger cities
const MIN_COMPLETENESS_SCORE = 40; // Higher standard for larger cities
const PROXIMITY_THRESHOLD_METERS = 50;

// Quality keywords in facility names
const QUALITY_KEYWORDS = [
  "academy",
  "complex",
  "center",
  "training",
  "performance",
  "indoor",
  "fieldhouse",
  "field",
  "premier",
  "elite",
  "championship",
  "professional",
  "tournament",
];

// ===== FACILITY VALIDATION CONSTANTS =====

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
  "playground",
];

const HIGH_QUALITY_TYPES = [
  "gym",
  "fitness_center",
  "sports_complex",
  "stadium",
  "athletic_field",
  "sports_club",
  "community_center",
  "recreation_center",
  "sports_facility",
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
    "training",
    "performance",
    "strength",
    "conditioning",
    "athletic",
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
  Rowing: ["rowing"],
  Sailing: ["sailing"],
  "Water Sports": ["kayak", "canoe"],
};

interface SportMetadata {
  score: number;
  sources: Array<"name" | "review" | "api">;
  keywords_matched: string[];
  confidence: "high" | "medium" | "low";
  matched_text?: string;
}

interface ProgressState {
  processedCities: string[];
  processedChains: string[];
  totalFacilities: number;
  statistics: {
    searched: number;
    filteredLowQuality: number;
    filteredDuplicate: number;
    filteredNonSport: number;
    inserted: number;
  };
  lastUpdated: Date;
}

const PROGRESS_FILE = path.join(
  __dirname,
  "../progress/medium-texas-cities-facilities-progress.json",
);

// ===== HELPER FUNCTIONS =====

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function loadProgress(): ProgressState {
  if (fs.existsSync(PROGRESS_FILE)) {
    const data = fs.readFileSync(PROGRESS_FILE, "utf-8");
    return JSON.parse(data);
  }
  return {
    processedCities: [],
    processedChains: [],
    totalFacilities: 0,
    statistics: {
      searched: 0,
      filteredLowQuality: 0,
      filteredDuplicate: 0,
      filteredNonSport: 0,
      inserted: 0,
    },
    lastUpdated: new Date(),
  };
}

function saveProgress(progress: ProgressState) {
  progress.lastUpdated = new Date();
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

// ===== VALIDATION FUNCTIONS =====

async function facilityExists(placeId: string): Promise<boolean> {
  // Check if facility exists (including cleaned_up facilities)
  const { data, error } = await supabaseAdmin
    .from("sports_facilities")
    .select("place_id, cleaned_up")
    .eq("place_id", placeId)
    .limit(1);

  if (error) {
    console.error(`  ⚠️  Error checking existence: ${error.message}`);
    return false;
  }

  return data && data.length > 0;
}

async function findNearbyFacility(lat: number, lng: number): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc("find_nearby_facilities", {
    lat,
    lng,
    radius_meters: PROXIMITY_THRESHOLD_METERS,
  });

  if (error) {
    if (error.message.includes("does not exist")) {
      return false;
    }
    console.error(`  ⚠️  Error checking proximity: ${error.message}`);
    return false;
  }

  return data && data.length > 0;
}

function isHighQualityFacility(place: any): {
  passed: boolean;
  reason?: string;
} {
  // Check 1: Must have minimum rating
  if (!place.rating || place.rating < MIN_RATING) {
    return {
      passed: false,
      reason: `Low rating (${place.rating || 0} < ${MIN_RATING})`,
    };
  }

  // Check 2: Must have minimum reviews
  if (!place.user_ratings_total || place.user_ratings_total < MIN_REVIEWS) {
    return {
      passed: false,
      reason: `Few reviews (${place.user_ratings_total || 0} < ${MIN_REVIEWS})`,
    };
  }

  // Check 3: Must have photos
  if (!place.photos || place.photos.length === 0) {
    return {
      passed: false,
      reason: "No photos",
    };
  }

  // Check 4: Calculate completeness score
  const completeness = calculateCompletenessScore(place);
  if (completeness < MIN_COMPLETENESS_SCORE) {
    return {
      passed: false,
      reason: `Low completeness (${completeness} < ${MIN_COMPLETENESS_SCORE})`,
    };
  }

  // Check 5: Check for non-sport types
  const types = place.types || [];
  const hasNonSport = types.some((type: string) =>
    NON_SPORT_TYPES.includes(type),
  );
  const hasAthletic = types.some(
    (type: string) =>
      HIGH_QUALITY_TYPES.includes(type) ||
      type.includes("sport") ||
      type.includes("field") ||
      type.includes("court"),
  );

  if (hasNonSport && !hasAthletic) {
    return {
      passed: false,
      reason: "Non-sport facility",
    };
  }

  // Check 6: More lenient for small towns - accept if ANY indicator is present
  const nameLower = (place.name || "").toLowerCase();
  const hasQualityKeyword = QUALITY_KEYWORDS.some((keyword) =>
    nameLower.includes(keyword),
  );
  const hasMultipleSports = types.some((type: string) =>
    ["sports_complex", "recreation_center", "athletic_field"].includes(type),
  );

  // For medium cities: require higher rating/reviews if NO quality indicators
  if (!hasQualityKeyword && !hasMultipleSports && !hasAthletic) {
    if (place.rating < 4.2 || place.user_ratings_total < 15) {
      return {
        passed: false,
        reason: "No quality indicators and low engagement",
      };
    }
  }

  return { passed: true };
}

function calculateCompletenessScore(place: any): number {
  let score = 0;

  if (place.rating) score += 25;
  if (place.user_ratings_total) {
    const reviewPoints = Math.min(25, (place.user_ratings_total / 10) * 5);
    score += reviewPoints;
  }
  if (place.photos && place.photos.length > 0) score += 20;
  if (place.formatted_phone_number || place.website) score += 15;
  if (place.opening_hours) score += 15;

  return Math.round(score);
}

// ===== SPORT IDENTIFICATION FUNCTIONS =====

function findMatchingKeywords(
  sport: string,
  text: string,
): { keywords: string[]; matchedText: string } {
  const keywords = SPORT_KEYWORDS[sport as keyof typeof SPORT_KEYWORDS] || [];
  const matched: string[] = [];
  let matchedText = "";

  for (const keyword of keywords) {
    // Use word boundary regex to match whole words only
    const regex = new RegExp(`\\b${keyword}\\b`, "i");
    const match = text.match(regex);
    if (match) {
      matched.push(keyword);
      const index = match.index!;
      const start = Math.max(0, index - 20);
      const end = Math.min(text.length, index + keyword.length + 30);
      matchedText = text.substring(start, end).trim();
      if (start > 0) matchedText = "..." + matchedText;
      if (end < text.length) matchedText = matchedText + "...";
      break;
    }
  }

  return { keywords: matched, matchedText };
}

function calculateSportScore(
  sources: Array<"name" | "review" | "api">,
  keywordLength: number,
  reviewPosition?: number,
): number {
  let score = 0;

  if (sources.includes("name")) {
    score = 85 + Math.min(15, keywordLength);
  } else if (sources.includes("api")) {
    score = 70 + Math.min(10, keywordLength);
  } else if (sources.includes("review")) {
    const positionBonus =
      reviewPosition !== undefined ? Math.max(0, 10 - reviewPosition * 2) : 0;
    score = 25 + positionBonus + Math.min(15, keywordLength);
  }

  if (sources.length > 1) {
    score = Math.min(100, score + 10);
  }

  return score;
}

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
        ...match.keywords.map((k) => k.length),
      );
      const score = calculateSportScore(["name"], keywordSpecificity);

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
        const score = calculateSportScore(["review"], match.keywords.length, i);

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

function mergeSportMetadata(
  existing: SportMetadata | undefined,
  newMetadata: SportMetadata,
): SportMetadata {
  if (!existing) {
    return newMetadata;
  }

  const sourcesSet = new Set([...existing.sources, ...newMetadata.sources]);
  const mergedSources = Array.from(sourcesSet) as Array<
    "name" | "review" | "api"
  >;

  const keywordsSet = new Set([
    ...existing.keywords_matched,
    ...newMetadata.keywords_matched,
  ]);
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

function identifyFacilitySports(
  name: string,
  reviews: any[],
): {
  identified_sports: string[];
  sport_metadata: Record<string, SportMetadata>;
} {
  const allMetadata: Record<string, SportMetadata> = {};
  const sportsSet = new Set<string>();

  const nameResult = identifySportsFromName(name);
  nameResult.sports.forEach((sport) => sportsSet.add(sport));
  Object.entries(nameResult.metadata).forEach(([sport, metadata]) => {
    allMetadata[sport] = mergeSportMetadata(allMetadata[sport], metadata);
  });

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

    return response.data.results
      .map((place) => place.place_id!)
      .filter(Boolean);
  } catch (error: any) {
    console.error(`  ⚠️  Error searching:`, error.message);
    return [];
  }
}

async function fetchAndValidatePlace(
  placeId: string,
  progress: ProgressState,
): Promise<{ success: boolean; facility?: any; filterReason?: string }> {
  try {
    await delay(500);

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

    // High-quality filter
    const qualityResult = isHighQualityFacility(place);
    if (!qualityResult.passed) {
      progress.statistics.filteredLowQuality++;
      return {
        success: false,
        filterReason: qualityResult.reason,
      };
    }

    // Identify sports
    const sportIdentification = identifyFacilitySports(
      place.name || "",
      place.reviews || [],
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

async function insertFacility(facilityData: any): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin
      .from("sports_facilities")
      .upsert(facilityData, { onConflict: "place_id" });

    if (error) {
      console.error(
        `  ⚠️  Error inserting ${facilityData.name}:`,
        error.message,
      );
      return false;
    }

    return true;
  } catch (error: any) {
    console.error(`  ⚠️  Error inserting facility:`, error.message);
    return false;
  }
}

// ===== PROCESSING FUNCTIONS =====

async function processCity(
  city: string,
  cityIndex: number,
  totalCities: number,
  progress: ProgressState,
): Promise<void> {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`📍 [${cityIndex + 1}/${totalCities}] Processing: ${city}`);
  console.log("=".repeat(60));

  const placeIds = new Set<string>();

  for (let i = 0; i < HIGH_QUALITY_SEARCHES.length; i++) {
    const searchTerm = HIGH_QUALITY_SEARCHES[i];
    const query = `${searchTerm} in ${city}`;

    console.log(
      `  [${i + 1}/${HIGH_QUALITY_SEARCHES.length}] Searching: ${searchTerm}...`,
    );

    const ids = await searchPlacesByText(query);
    ids.forEach((id) => placeIds.add(id));

    console.log(`    Found ${ids.length} results`);

    await delay(500);
  }

  console.log(`\n  🔍 Total unique facilities found: ${placeIds.size}`);
  progress.statistics.searched += placeIds.size;

  await processFacilities(Array.from(placeIds), progress);
}

async function processChain(
  chain: string,
  chainIndex: number,
  totalChains: number,
  progress: ProgressState,
): Promise<void> {
  console.log(`\n${"=".repeat(60)}`);
  console.log(
    `🏢 [${chainIndex + 1}/${totalChains}] Searching chain: ${chain}`,
  );
  console.log("=".repeat(60));

  const query = `${chain} Texas`;
  console.log(`  Searching: ${query}...`);

  const placeIds = await searchPlacesByText(query);
  console.log(`  Found ${placeIds.length} results`);

  progress.statistics.searched += placeIds.length;

  await processFacilities(placeIds, progress);
}

async function processFacilities(
  placeIds: string[],
  progress: ProgressState,
): Promise<void> {
  let insertedCount = 0;
  let processed = 0;
  const filterStats = {
    duplicate: 0,
    lowQuality: 0,
    nonSport: 0,
  };

  for (const placeId of placeIds) {
    processed++;

    // Check if already exists
    const exists = await facilityExists(placeId);
    if (exists) {
      filterStats.duplicate++;
      progress.statistics.filteredDuplicate++;
      continue;
    }

    // Fetch and validate
    const result = await fetchAndValidatePlace(placeId, progress);

    if (!result.success) {
      if (
        result.filterReason?.includes("Low rating") ||
        result.filterReason?.includes("Few reviews") ||
        result.filterReason?.includes("No photos") ||
        result.filterReason?.includes("Low completeness")
      ) {
        filterStats.lowQuality++;
      } else if (result.filterReason?.includes("Non-sport")) {
        filterStats.nonSport++;
      }
      continue;
    }

    // Check proximity
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
          `  ✅ [${processed}/${placeIds.length}] Inserted ${insertedCount} facilities`,
        );
      }
      if (sports.length > 0) {
        console.log(
          `     Latest: ${result.facility.name.substring(0, 40)}... → ${sportsDisplay}`,
        );
      }
    }
  }

  console.log(`\n  ✅ Batch Complete:`);
  console.log(`     Searched: ${placeIds.length}`);
  console.log(`     Inserted: ${insertedCount}`);
  console.log(`     Filtered:`);
  console.log(`       - Duplicate: ${filterStats.duplicate}`);
  console.log(`       - Low quality: ${filterStats.lowQuality}`);
  console.log(`       - Non-sport: ${filterStats.nonSport}`);
  console.log(`     Total in database: ${progress.totalFacilities}`);
}

// ===== MAIN FUNCTION =====

async function collectHighQualityFacilities() {
  console.log("🚀 Medium Texas Cities Athletic Facilities Collection");
  console.log("=".repeat(60));
  console.log(`📊 Target Cities: ${MEDIUM_TEXAS_CITIES.length}`);
  console.log(`🏢 Facility Chains: ${FACILITY_CHAINS.length}`);
  console.log(`🔍 Search Types: ${HIGH_QUALITY_SEARCHES.length}`);
  console.log(`\n🎯 Quality Criteria (Higher Standards for Medium Cities):`);
  console.log(`   ✓ Minimum rating: ${MIN_RATING}`);
  console.log(`   ✓ Minimum reviews: ${MIN_REVIEWS}`);
  console.log(`   ✓ Minimum completeness: ${MIN_COMPLETENESS_SCORE}/100`);
  console.log(`   ✓ Must have photos`);
  console.log(`   ✓ Quality keywords or high ratings required`);
  console.log("=".repeat(60) + "\n");

  const progress = loadProgress();

  if (
    progress.processedCities.length > 0 ||
    progress.processedChains.length > 0
  ) {
    console.log(`♻️  Resuming:`);
    console.log(
      `   Cities: ${progress.processedCities.length}/${MEDIUM_TEXAS_CITIES.length}`,
    );
    console.log(
      `   Chains: ${progress.processedChains.length}/${FACILITY_CHAINS.length}`,
    );
    console.log(`   Total facilities: ${progress.totalFacilities}\n`);
  }

  const startTime = Date.now();

  // Process facility chains first
  for (let i = 0; i < FACILITY_CHAINS.length; i++) {
    const chain = FACILITY_CHAINS[i];

    if (progress.processedChains.includes(chain)) {
      continue;
    }

    try {
      await processChain(chain, i, FACILITY_CHAINS.length, progress);
      progress.processedChains.push(chain);
      saveProgress(progress);
    } catch (error: any) {
      console.error(`\n❌ Error processing ${chain}:`, error.message);
      saveProgress(progress);
    }
  }

  // Process cities
  for (let i = 0; i < MEDIUM_TEXAS_CITIES.length; i++) {
    const city = MEDIUM_TEXAS_CITIES[i];

    if (progress.processedCities.includes(city)) {
      continue;
    }

    try {
      await processCity(city, i, MEDIUM_TEXAS_CITIES.length, progress);
      progress.processedCities.push(city);
      saveProgress(progress);

      // Progress summary every 5 cities
      if (progress.processedCities.length % 5 === 0) {
        const elapsed = (Date.now() - startTime) / 1000 / 60;
        const rate =
          (progress.processedCities.length + progress.processedChains.length) /
          elapsed;
        const remaining =
          MEDIUM_TEXAS_CITIES.length - progress.processedCities.length;
        const eta = remaining / rate;

        console.log("\n" + "=".repeat(60));
        console.log("📊 Overall Progress:");
        console.log(
          `   Cities: ${progress.processedCities.length}/${MEDIUM_TEXAS_CITIES.length}`,
        );
        console.log(
          `   Chains: ${progress.processedChains.length}/${FACILITY_CHAINS.length}`,
        );
        console.log(`   Total Facilities: ${progress.totalFacilities}`);
        console.log(`   Statistics:`);
        console.log(`     - Searched: ${progress.statistics.searched}`);
        console.log(`     - Inserted: ${progress.statistics.inserted}`);
        console.log(
          `     - Filtered Duplicate: ${progress.statistics.filteredDuplicate}`,
        );
        console.log(
          `     - Filtered Low Quality: ${progress.statistics.filteredLowQuality}`,
        );
        console.log(
          `     - Filtered Non-Sport: ${progress.statistics.filteredNonSport}`,
        );
        console.log(`   Elapsed: ${elapsed.toFixed(0)} minutes`);
        console.log(
          `   ETA: ${eta.toFixed(0)} minutes (~${(eta / 60).toFixed(1)} hours)`,
        );
        console.log("=".repeat(60) + "\n");
      }
    } catch (error: any) {
      console.error(`\n❌ Error processing ${city}:`, error.message);
      saveProgress(progress);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("🎉 Collection Complete!");
  console.log("=".repeat(60));
  console.log(`📊 Final Statistics:`);
  console.log(
    `   Cities Processed: ${progress.processedCities.length}/${MEDIUM_TEXAS_CITIES.length}`,
  );
  console.log(
    `   Chains Processed: ${progress.processedChains.length}/${FACILITY_CHAINS.length}`,
  );
  console.log(`   Total Facilities Added: ${progress.statistics.inserted}`);
  console.log(`   Quality Metrics:`);
  console.log(`     - Total Searched: ${progress.statistics.searched}`);
  console.log(`     - Passed All Filters: ${progress.statistics.inserted}`);
  console.log(
    `     - Filter Rate: ${((progress.statistics.inserted / progress.statistics.searched) * 100).toFixed(1)}%`,
  );
  console.log(`   Filters Applied:`);
  console.log(`     - Duplicate: ${progress.statistics.filteredDuplicate}`);
  console.log(`     - Low Quality: ${progress.statistics.filteredLowQuality}`);
  console.log(`     - Non-Sport: ${progress.statistics.filteredNonSport}`);
  console.log(
    `   Runtime: ${((Date.now() - startTime) / 1000 / 60 / 60).toFixed(2)} hours`,
  );
  console.log("=".repeat(60));

  if (fs.existsSync(PROGRESS_FILE)) {
    fs.unlinkSync(PROGRESS_FILE);
  }
}

collectHighQualityFacilities().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
