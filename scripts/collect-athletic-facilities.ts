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

// Top 50 Texas cities by population
const TEXAS_CITIES = [
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
  "Garland, Texas",
  "Irving, Texas",
  "Amarillo, Texas",
  "Grand Prairie, Texas",
  "Brownsville, Texas",
  "McKinney, Texas",
  "Frisco, Texas",
  "Pasadena, Texas",
  "Mesquite, Texas",
  "Killeen, Texas",
  "McAllen, Texas",
  "Waco, Texas",
  "Carrollton, Texas",
  "Denton, Texas",
  "Midland, Texas",
  "Abilene, Texas",
  "Beaumont, Texas",
  "Round Rock, Texas",
  "Odessa, Texas",
  "Wichita Falls, Texas",
  "Richardson, Texas",
  "Lewisville, Texas",
  "Tyler, Texas",
  "College Station, Texas",
  "Pearland, Texas",
  "San Angelo, Texas",
  "Allen, Texas",
  "League City, Texas",
  "Sugar Land, Texas",
  "Longview, Texas",
  "Edinburg, Texas",
  "Mission, Texas",
  "Bryan, Texas",
  "Baytown, Texas",
  "Pharr, Texas",
  "Temple, Texas",
  "Missouri City, Texas",
  "Flower Mound, Texas",
  "Harlingen, Texas",
];

// Athletic facility search queries (field and court-based mainstream sports)
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

interface ProgressState {
  processedCities: string[];
  totalFacilities: number;
  lastUpdated: Date;
}

const PROGRESS_FILE = path.join(__dirname, "../.athletic-facilities-progress.json");

// Rate limiting helper
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Load progress from file
function loadProgress(): ProgressState {
  if (fs.existsSync(PROGRESS_FILE)) {
    const data = fs.readFileSync(PROGRESS_FILE, "utf-8");
    return JSON.parse(data);
  }
  return {
    processedCities: [],
    totalFacilities: 0,
    lastUpdated: new Date(),
  };
}

// Save progress to file
function saveProgress(progress: ProgressState) {
  progress.lastUpdated = new Date();
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

// Check if facility already exists in database
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

// Search for places using text search
async function searchPlacesByText(
  query: string
): Promise<string[]> {
  try {
    const response = await client.textSearch({
      params: {
        query,
        key: GOOGLE_API_KEY,
      },
    });

    if (response.data.status !== "OK" && response.data.status !== "ZERO_RESULTS") {
      console.error(`  ⚠️  Search status: ${response.data.status}`);
      return [];
    }

    return response.data.results.map((place) => place.place_id!).filter(Boolean);
  } catch (error: any) {
    console.error(`  ⚠️  Error searching:`, error.message);
    return [];
  }
}

// Get place details and insert into Supabase
async function fetchAndInsertPlace(placeId: string): Promise<boolean> {
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
      return false;
    }

    const place = response.data.result;

    const facilityData = {
      place_id: place.place_id!,
      name: place.name || "Unknown",
      sport_types: place.types || [],
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

    const { error } = await supabase
      .from("sports_facilities")
      .upsert(facilityData, { onConflict: "place_id" });

    if (error) {
      console.error(`  ⚠️  Error inserting ${place.name}:`, error.message);
      return false;
    }

    return true;
  } catch (error: any) {
    console.error(`  ⚠️  Error processing place:`, error.message);
    return false;
  }
}

// Process a single city
async function processCity(
  city: string,
  cityIndex: number,
  totalCities: number,
  progress: ProgressState
): Promise<number> {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`📍 [${cityIndex + 1}/${totalCities}] Processing: ${city}`);
  console.log("=".repeat(60));

  const placeIds = new Set<string>();

  // Search all facility types in this city
  for (let i = 0; i < FACILITY_SEARCHES.length; i++) {
    const facilityType = FACILITY_SEARCHES[i];
    const query = `${facilityType} in ${city}`;

    console.log(`  [${i + 1}/${FACILITY_SEARCHES.length}] Searching: ${facilityType}...`);

    const ids = await searchPlacesByText(query);
    ids.forEach((id) => placeIds.add(id));

    console.log(`    Found ${ids.length} results`);

    await delay(500); // Rate limiting between searches
  }

  console.log(`\n  🔍 Total unique facilities found: ${placeIds.size}`);

  let newFacilities = 0;
  let skippedExisting = 0;
  let processed = 0;

  // Process each facility
  for (const placeId of placeIds) {
    processed++;

    // Check if already in database
    const exists = await facilityExists(placeId);
    if (exists) {
      skippedExisting++;
      continue;
    }

    const success = await fetchAndInsertPlace(placeId);
    if (success) {
      newFacilities++;
      progress.totalFacilities++;

      if (newFacilities % 10 === 0) {
        console.log(
          `  ✅ [${processed}/${placeIds.size}] Inserted ${newFacilities} new facilities (${skippedExisting} already existed)`
        );
      }
    }
  }

  console.log(`\n  ✅ City Complete:`);
  console.log(`     New facilities: ${newFacilities}`);
  console.log(`     Already existed: ${skippedExisting}`);
  console.log(`     Total in database: ${progress.totalFacilities}`);

  return newFacilities;
}

async function collectAthleticFacilities() {
  console.log("🚀 Starting Texas Athletic Facilities Collection");
  console.log("=" .repeat(60));
  console.log(`📊 Cities: ${TEXAS_CITIES.length} major Texas cities`);
  console.log(`🏃 Facility Types: ${FACILITY_SEARCHES.length} types per city`);
  console.log(`📋 Searches: soccer/football/baseball fields, basketball/tennis/volleyball courts, athletic parks`);
  console.log("=" .repeat(60) + "\n");

  const progress = loadProgress();

  if (progress.processedCities.length > 0) {
    console.log(
      `♻️  Resuming: ${progress.processedCities.length}/${TEXAS_CITIES.length} cities processed\n`
    );
    console.log(`   Total facilities: ${progress.totalFacilities}\n`);
  }

  const startTime = Date.now();

  for (let i = 0; i < TEXAS_CITIES.length; i++) {
    const city = TEXAS_CITIES[i];

    // Skip already processed cities
    if (progress.processedCities.includes(city)) {
      continue;
    }

    try {
      await processCity(city, i, TEXAS_CITIES.length, progress);

      progress.processedCities.push(city);
      saveProgress(progress);

      // Progress summary every 5 cities
      if (progress.processedCities.length % 5 === 0) {
        const elapsed = (Date.now() - startTime) / 1000 / 60; // minutes
        const rate = progress.processedCities.length / elapsed;
        const remaining = TEXAS_CITIES.length - progress.processedCities.length;
        const eta = remaining / rate;

        console.log("\n" + "=".repeat(60));
        console.log("📊 Overall Progress:");
        console.log(`   Cities: ${progress.processedCities.length}/${TEXAS_CITIES.length}`);
        console.log(`   Total Facilities: ${progress.totalFacilities}`);
        console.log(`   Elapsed: ${elapsed.toFixed(0)} minutes`);
        console.log(`   ETA: ${eta.toFixed(0)} minutes (~${(eta / 60).toFixed(1)} hours)`);
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
  console.log(`   Total Facilities: ${progress.totalFacilities}`);
  console.log(`   Cities Processed: ${progress.processedCities.length}/${TEXAS_CITIES.length}`);
  console.log(`   Runtime: ${((Date.now() - startTime) / 1000 / 60 / 60).toFixed(2)} hours`);
  console.log("=".repeat(60));

  // Clean up progress file
  if (fs.existsSync(PROGRESS_FILE)) {
    fs.unlinkSync(PROGRESS_FILE);
  }
}

// Run the collection
collectAthleticFacilities().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
