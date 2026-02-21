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

// Texas bounding box
const TEXAS_BOUNDS = {
  minLng: -106.6,
  maxLng: -93.5,
  minLat: 25.8,
  maxLat: 36.5,
};

// Grid cell size in degrees (roughly 50km)
const GRID_SIZE = 0.45;

// All sport-related place types
const SPORT_TYPES = [
  "gym",
  "stadium",
  "athletic_field",
  "fitness_center",
  "sports_complex",
  "sports_club",
  "swimming_pool",
  "tennis_court",
  "golf_course",
  "bowling_alley",
  "ice_skating_rink",
  "ski_resort",
  "playground",
  "community_center",
  "recreation_center",
];

interface GridCell {
  lat: number;
  lng: number;
  index: number;
}

interface ProgressState {
  processedCells: number[];
  totalFacilities: number;
  lastUpdated: Date;
}

const PROGRESS_FILE = path.join(__dirname, "../.texas-collection-progress.json");

// Rate limiting helper
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Generate grid cells covering all of Texas
function generateGrid(): GridCell[] {
  const cells: GridCell[] = [];
  let index = 0;

  for (
    let lat = TEXAS_BOUNDS.minLat;
    lat < TEXAS_BOUNDS.maxLat;
    lat += GRID_SIZE
  ) {
    for (
      let lng = TEXAS_BOUNDS.minLng;
      lng < TEXAS_BOUNDS.maxLng;
      lng += GRID_SIZE
    ) {
      cells.push({
        lat: lat + GRID_SIZE / 2,
        lng: lng + GRID_SIZE / 2,
        index: index++,
      });
    }
  }

  return cells;
}

// Load progress from file
function loadProgress(): ProgressState {
  if (fs.existsSync(PROGRESS_FILE)) {
    const data = fs.readFileSync(PROGRESS_FILE, "utf-8");
    return JSON.parse(data);
  }
  return {
    processedCells: [],
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

// Search for places near a location
async function searchNearbyPlaces(
  location: { lat: number; lng: number },
  type: string,
  radius: number = 50000
): Promise<string[]> {
  try {
    const response = await client.placesNearby({
      params: {
        location,
        radius,
        type,
        key: GOOGLE_API_KEY,
      },
    });

    if (response.data.status !== "OK" && response.data.status !== "ZERO_RESULTS") {
      return [];
    }

    return response.data.results.map((place) => place.place_id!).filter(Boolean);
  } catch (error: any) {
    console.error(`  ⚠️  Error searching ${type}:`, error.message);
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

// Process a single grid cell
async function processGridCell(
  cell: GridCell,
  progress: ProgressState
): Promise<number> {
  console.log(`\n📍 Processing Cell ${cell.index + 1} (${cell.lat.toFixed(2)}, ${cell.lng.toFixed(2)})`);

  const placeIds = new Set<string>();

  // Search all sport types in this cell
  for (const sportType of SPORT_TYPES) {
    const ids = await searchNearbyPlaces({ lat: cell.lat, lng: cell.lng }, sportType);
    ids.forEach((id) => placeIds.add(id));
    await delay(500); // Rate limiting between searches
  }

  console.log(`  🔍 Found ${placeIds.size} unique facilities in this cell`);

  let newFacilities = 0;

  // Process each facility
  for (const placeId of placeIds) {
    // Check if already in database
    const exists = await facilityExists(placeId);
    if (exists) {
      continue;
    }

    const success = await fetchAndInsertPlace(placeId);
    if (success) {
      newFacilities++;
      progress.totalFacilities++;

      console.log(
        `  ✅ [${progress.totalFacilities}] Inserted new facility`
      );
    }
  }

  console.log(`  ➕ Added ${newFacilities} new facilities from this cell`);

  return newFacilities;
}

async function collectTexasFacilities() {
  console.log("🚀 Starting Full Texas Sports Facilities Collection");
  console.log("=" .repeat(60));
  console.log(`📊 Coverage: All of Texas`);
  console.log(`📍 Grid Size: 50km x 50km cells`);
  console.log(`🏃 Sport Types: ${SPORT_TYPES.length} types`);
  console.log("=" .repeat(60) + "\n");

  const grid = generateGrid();
  console.log(`📐 Generated ${grid.length} grid cells\n`);

  const progress = loadProgress();

  if (progress.processedCells.length > 0) {
    console.log(
      `♻️  Resuming from previous run: ${progress.processedCells.length}/${grid.length} cells processed\n`
    );
    console.log(`   Total facilities so far: ${progress.totalFacilities}\n`);
  }

  const startTime = Date.now();

  for (const cell of grid) {
    // Skip already processed cells
    if (progress.processedCells.includes(cell.index)) {
      continue;
    }

    try {
      await processGridCell(cell, progress);

      progress.processedCells.push(cell.index);
      saveProgress(progress);

      // Progress summary every 10 cells
      if (progress.processedCells.length % 10 === 0) {
        const elapsed = (Date.now() - startTime) / 1000 / 60; // minutes
        const rate = progress.processedCells.length / elapsed;
        const remaining = grid.length - progress.processedCells.length;
        const eta = remaining / rate;

        console.log("\n" + "=".repeat(60));
        console.log("📊 Progress Summary:");
        console.log(`   Cells: ${progress.processedCells.length}/${grid.length}`);
        console.log(`   Total Facilities: ${progress.totalFacilities}`);
        console.log(`   Elapsed: ${elapsed.toFixed(0)} minutes`);
        console.log(`   ETA: ${eta.toFixed(0)} minutes (~${(eta / 60).toFixed(1)} hours)`);
        console.log("=".repeat(60) + "\n");
      }
    } catch (error: any) {
      console.error(`\n❌ Error processing cell ${cell.index}:`, error.message);
      console.log("   Saving progress and continuing...\n");
      saveProgress(progress);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("🎉 Collection Complete!");
  console.log("=".repeat(60));
  console.log(`📊 Final Statistics:`);
  console.log(`   Total Facilities: ${progress.totalFacilities}`);
  console.log(`   Cells Processed: ${progress.processedCells.length}/${grid.length}`);
  console.log(`   Runtime: ${((Date.now() - startTime) / 1000 / 60 / 60).toFixed(2)} hours`);
  console.log("=".repeat(60));

  // Clean up progress file
  if (fs.existsSync(PROGRESS_FILE)) {
    fs.unlinkSync(PROGRESS_FILE);
  }
}

// Run the collection
collectTexasFacilities().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
