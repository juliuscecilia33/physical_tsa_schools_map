import { Client } from "@googlemaps/google-maps-services-js";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: path.join(__dirname, "../.env.local") });

const client = new Client({});
const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY!;

if (!GOOGLE_API_KEY) {
  console.error("❌ Error: GOOGLE_PLACES_API_KEY not found in .env.local");
  process.exit(1);
}

// Houston, Texas coordinates
const HOUSTON_CENTER = {
  lat: 29.7604,
  lng: -95.3698,
};

// All sport-related place types from Google Places API
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

interface Facility {
  place_id: string;
  name: string;
  sport_types: string[];
  address: string;
  location: {
    lat: number;
    lng: number;
  };
  phone?: string;
  website?: string;
  rating?: number;
  user_ratings_total?: number;
  reviews?: Array<{
    author_name: string;
    rating: number;
    text: string;
    time: string;
    relative_time_description: string;
  }>;
  photo_references?: string[];
  opening_hours?: {
    open_now?: boolean;
    weekday_text?: string[];
  };
  business_status?: string;
}

// Rate limiting helper
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function searchNearbyPlaces(
  location: { lat: number; lng: number },
  type: string,
  radius: number = 50000 // 50km
): Promise<string[]> {
  try {
    console.log(`  🔍 Searching for ${type}...`);

    const response = await client.placesNearby({
      params: {
        location,
        radius,
        type,
        key: GOOGLE_API_KEY,
      },
    });

    if (response.data.status !== "OK" && response.data.status !== "ZERO_RESULTS") {
      console.error(`  ⚠️  Warning: ${response.data.status} for type ${type}`);
      return [];
    }

    const placeIds = response.data.results.map((place) => place.place_id!);
    console.log(`  ✅ Found ${placeIds.length} ${type} facilities`);

    return placeIds;
  } catch (error: any) {
    console.error(`  ❌ Error searching ${type}:`, error.message);
    return [];
  }
}

async function getPlaceDetails(placeId: string): Promise<Facility | null> {
  try {
    await delay(500); // Rate limiting: 2 requests/second

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
      console.error(`  ⚠️  Warning: ${response.data.status} for place ${placeId}`);
      return null;
    }

    const place = response.data.result;

    return {
      place_id: place.place_id!,
      name: place.name || "Unknown",
      sport_types: place.types || [],
      address: place.formatted_address || "",
      location: {
        lat: place.geometry?.location.lat || 0,
        lng: place.geometry?.location.lng || 0,
      },
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
        : undefined,
      business_status: place.business_status,
    };
  } catch (error: any) {
    console.error(`  ❌ Error fetching details for ${placeId}:`, error.message);
    return null;
  }
}

async function collectFacilities() {
  console.log("🚀 Starting Houston Sports Facilities Collection");
  console.log(`📍 Center: Houston, TX (${HOUSTON_CENTER.lat}, ${HOUSTON_CENTER.lng})`);
  console.log(`🏃 Searching ${SPORT_TYPES.length} sport types...\n`);

  // Step 1: Search for all place IDs
  const allPlaceIds = new Set<string>();

  for (const sportType of SPORT_TYPES) {
    const placeIds = await searchNearbyPlaces(HOUSTON_CENTER, sportType);
    placeIds.forEach((id) => allPlaceIds.add(id));
    await delay(500); // Rate limiting between searches
  }

  console.log(`\n✅ Found ${allPlaceIds.size} unique facilities\n`);

  // Step 2: Fetch details for each facility
  console.log("📊 Fetching detailed information for each facility...\n");
  const facilities: Facility[] = [];
  let count = 0;

  for (const placeId of allPlaceIds) {
    count++;
    console.log(`  [${count}/${allPlaceIds.size}] Fetching details...`);

    const facility = await getPlaceDetails(placeId);
    if (facility) {
      facilities.push(facility);
    }
  }

  console.log(`\n✅ Successfully collected ${facilities.length} facilities\n`);

  // Step 3: Save to JSON file
  const outputPath = path.join(__dirname, "../test-facilities-houston.json");
  fs.writeFileSync(outputPath, JSON.stringify(facilities, null, 2));

  console.log(`💾 Saved to: ${outputPath}`);

  // Print summary
  console.log("\n📊 Summary:");
  console.log(`  - Total facilities: ${facilities.length}`);
  console.log(`  - With photos: ${facilities.filter(f => f.photo_references?.length).length}`);
  console.log(`  - With reviews: ${facilities.filter(f => f.reviews?.length).length}`);
  console.log(`  - With phone: ${facilities.filter(f => f.phone).length}`);
  console.log(`  - With website: ${facilities.filter(f => f.website).length}`);
  console.log(`  - Average rating: ${(facilities.filter(f => f.rating).reduce((sum, f) => sum + (f.rating || 0), 0) / facilities.filter(f => f.rating).length).toFixed(2)}`);
}

// Run the collection
collectFacilities().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
