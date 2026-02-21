import { Client } from "@googlemaps/google-maps-services-js";
import { createClient } from "@supabase/supabase-js";
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

// Additional facilities organized by region with location hints
const FACILITIES = {
  DFW_Facilities: {
    location: "Dallas Fort Worth, Texas",
    facilities: [
      { name: "Harold Patterson Sports Center" },
      { name: "Russell Creek Park" },
      { name: "Carpenter Park" },
      { name: "Southlake Champions Club" },
      { name: "Parks at Texas Star" },
      { name: "FieldhouseUSA Frisco" },
      { name: "FieldhouseUSA Grapevine" },
      { name: "FieldhouseUSA Mansfield" },
      { name: "Game On Arena Sports Fort Worth" },
      { name: "Game On Sports Complex Fort Worth" },
      { name: "Performance Indoor Training Frisco" },
      { name: "Performance Indoor Training Plano" },
      { name: "DFW Indoor Sports Fort Worth" },
      { name: "Athlete Training and Health Allen" },
      { name: "Toyota Soccer Center (FC Dallas)" },
      { name: "Plano Sports Authority" },
    ],
  },
  Houston_Metro_Facilities: {
    location: "Houston, Texas",
    facilities: [
      { name: "Memorial Park Sports Complex" },
      { name: "Herman Brown Park" },
      { name: "Cullen Park" },
      { name: "Bear Creek Pioneers Park" },
      { name: "Meyer Park" },
      { name: "Chester L. Davis Sportsplex" },
      { name: "Baytown Soccer Park" },
      { name: "Katy Indoor Soccer Center" },
      { name: "Community Fieldhouse Spring" },
      { name: "Revolution Soccer Complex" },
      { name: "PSG Academy Houston" },
      { name: "Houston Sports Park" },
      { name: "George Bush Park Soccer Complex" },
      { name: "Dow Park Soccer Complex" },
      { name: "Carl Barton Jr. Park" },
      { name: "Shadow Creek Sports Complex" },
    ],
  },
  San_Antonio_Facilities: {
    location: "San Antonio, Texas",
    facilities: [
      { name: "STAR Soccer Complex" },
      { name: "UTSA Rec Field Complex" },
      { name: "Holy Spirit Sports Complex" },
      { name: "SoccerZone Live Oak" },
    ],
  },
  Austin_Round_Rock_Facilities: {
    location: "Austin, Texas",
    facilities: [
      { name: "NE Metropolitan Park" },
      { name: "Bee Creek Sports Complex" },
      { name: "Southwest Williamson County Regional Park" },
      { name: "1849 Park Pflugerville" },
      { name: "Round Rock Multipurpose Complex" },
      { name: "Hill Country Indoor Bee Cave" },
      { name: "SoccerZone South Austin" },
      { name: "SoccerZone Lakeline" },
      { name: "Quarries Recreation Center (The Texas Field)" },
    ],
  },
  West_Texas_Facilities: {
    location: "West Texas",
    facilities: [
      { name: "Berl Huffman Athletic Complex" },
      { name: "Scharbauer Sports Complex" },
      { name: "Astound Broadband Stadium Midland" },
      { name: "Basin Sports Complex Odessa" },
      { name: "Amy Bell Sports Complex Odessa" },
      { name: "Westside Sports Complex El Paso" },
      { name: "El Paso County Sportspark" },
      { name: "Texas Bank Sports Complex San Angelo" },
      { name: "Rockrose Sports Park Amarillo" },
    ],
  },
  South_Texas_RGV_Facilities: {
    location: "South Texas",
    facilities: [
      { name: "McAllen Sports Park" },
      { name: "Brownsville Sports Park" },
      { name: "Harlingen Sports Complexes" },
      { name: "Buena Vista Sports Complex Laredo" },
      { name: "Slaughter Sports Complex Laredo" },
      { name: "Southside Sports Complex Corpus Christi" },
    ],
  },
  East_Central_Texas_Facilities: {
    location: "Central Texas",
    facilities: [
      { name: "Veterans Park College Station" },
      { name: "Legends Event Center Bryan" },
      { name: "Swanger Complex Texarkana" },
      { name: "Wallace Complex Texarkana" },
      { name: "Lindsey Park Tyler" },
      { name: "Killeen Athletic Complex" },
      { name: "Dubl-R Fields Waco" },
      { name: "Lake Air Football Fields Waco" },
      { name: "Crossroads Park Temple" },
    ],
  },
};

interface Stats {
  total: number;
  found: number;
  notFound: number;
  alreadyExists: number;
  inserted: number;
  errors: number;
}

// Rate limiting helper
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

// Search for a facility by name and location
async function searchFacilityByName(
  name: string,
  location: string
): Promise<string | null> {
  try {
    const query = `${name} ${location}`;

    const response = await client.textSearch({
      params: {
        query,
        key: GOOGLE_API_KEY,
      },
    });

    if (response.data.status !== "OK" && response.data.status !== "ZERO_RESULTS") {
      console.error(`  ⚠️  Search status: ${response.data.status}`);
      return null;
    }

    if (
      response.data.results.length === 0 ||
      !response.data.results[0].place_id
    ) {
      return null;
    }

    // Return the first (most relevant) result's place_id
    return response.data.results[0].place_id;
  } catch (error: any) {
    console.error(`  ⚠️  Error searching:`, error.message);
    return null;
  }
}

// Get place details and insert into Supabase
async function fetchAndInsertPlace(
  placeId: string,
  facilityName: string
): Promise<boolean> {
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
      console.error(`  ⚠️  Place details status: ${response.data.status}`);
      return false;
    }

    const place = response.data.result;

    const facilityData = {
      place_id: place.place_id!,
      name: place.name || facilityName,
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
      .insert(facilityData);

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

// Process facilities in a region
async function processRegion(
  regionName: string,
  regionLocation: string,
  facilities: Array<{ name: string }>,
  stats: Stats
): Promise<void> {
  console.log(`\n${"=".repeat(70)}`);
  console.log(`📍 Region: ${regionName} (${facilities.length} facilities)`);
  console.log(`   Location Hint: ${regionLocation}`);
  console.log("=".repeat(70));

  for (let i = 0; i < facilities.length; i++) {
    const facility = facilities[i];
    const facilityNum = i + 1;

    console.log(
      `\n  [${facilityNum}/${facilities.length}] ${facility.name}`
    );

    stats.total++;

    // Search for facility
    const placeId = await searchFacilityByName(facility.name, regionLocation);
    await delay(500); // Rate limiting

    if (!placeId) {
      console.log(`    ❌ Not found on Google Places`);
      stats.notFound++;
      continue;
    }

    console.log(`    🔍 Found place_id: ${placeId}`);
    stats.found++;

    // Check if already exists
    const exists = await facilityExists(placeId);
    if (exists) {
      console.log(`    ⏭️  Already exists in database (skipping)`);
      stats.alreadyExists++;
      continue;
    }

    // Fetch details and insert
    const success = await fetchAndInsertPlace(placeId, facility.name);
    if (success) {
      console.log(`    ✅ Successfully inserted`);
      stats.inserted++;
    } else {
      console.log(`    ❌ Failed to insert`);
      stats.errors++;
    }
  }

  console.log(`\n  ✅ Region Complete:`);
  console.log(`     Found: ${stats.found - stats.alreadyExists - stats.inserted}`);
  console.log(`     Already existed: ${stats.alreadyExists}`);
  console.log(`     Newly inserted: ${stats.inserted}`);
}

async function collectAdditionalFacilities() {
  console.log("🚀 Starting Additional Facilities Collection");
  console.log("=".repeat(70));

  const totalFacilities = Object.values(FACILITIES).reduce(
    (sum, region) => sum + region.facilities.length,
    0
  );

  console.log(`📊 Total Facilities: ${totalFacilities}`);
  console.log(`📋 Regions: ${Object.keys(FACILITIES).length} Texas regions`);
  console.log(`   - DFW, Houston Metro, San Antonio, Austin/Round Rock`);
  console.log(`   - West Texas, South Texas/RGV, East/Central Texas`);
  console.log("=".repeat(70));

  const startTime = Date.now();
  const stats: Stats = {
    total: 0,
    found: 0,
    notFound: 0,
    alreadyExists: 0,
    inserted: 0,
    errors: 0,
  };

  // Process each region
  for (const [regionName, regionData] of Object.entries(FACILITIES)) {
    await processRegion(
      regionName,
      regionData.location,
      regionData.facilities,
      stats
    );
  }

  // Final summary
  const endTime = Date.now();
  const durationMinutes = ((endTime - startTime) / 1000 / 60).toFixed(2);

  console.log("\n" + "=".repeat(70));
  console.log("🎉 Collection Complete!");
  console.log("=".repeat(70));
  console.log(`📊 Final Statistics:`);
  console.log(`   Total Facilities Processed: ${stats.total}`);
  console.log(`   Found on Google Places: ${stats.found}`);
  console.log(`   Not Found: ${stats.notFound}`);
  console.log(`   Already Existed (Skipped): ${stats.alreadyExists}`);
  console.log(`   Newly Inserted: ${stats.inserted}`);
  console.log(`   Errors: ${stats.errors}`);
  console.log(`   Runtime: ${durationMinutes} minutes`);
  console.log("=".repeat(70));

  // Show not found facilities if any
  if (stats.notFound > 0) {
    console.log(
      `\n⚠️  Note: ${stats.notFound} facilities were not found on Google Places.`
    );
    console.log(
      `   This could be due to name variations or facilities not listed on Google.`
    );
  }
}

// Run the collection
collectAdditionalFacilities().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
