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

// Specific facilities organized by region
const FACILITIES = {
  Dallas_City: [
    { name: "MoneyGram Soccer Complex", location: "Dallas, Texas" },
    { name: "Samuell Hobby Soccer Complex", location: "Dallas, Texas" },
    { name: "Kiest Soccer Complex", location: "Dallas, Texas" },
    { name: "Gateway Park", location: "Dallas, Texas" },
    { name: "Crawford Memorial Park", location: "Dallas, Texas" },
    { name: "Hulcy Park", location: "Dallas, Texas" },
    { name: "Lake Highlands North Park", location: "Dallas, Texas" },
    { name: "Anderson Bonner Park", location: "Dallas, Texas" },
    { name: "Fair Oaks Soccer Complex", location: "Dallas, Texas" },
    { name: "Crown Park", location: "Dallas, Texas" },
    { name: "Grauwyler Park", location: "Dallas, Texas" },
    { name: "Holcomb Park", location: "Dallas, Texas" },
    { name: "Juanita J. Craft Park", location: "Dallas, Texas" },
    { name: "Lake Highlands Park", location: "Dallas, Texas" },
    { name: "Cottonwood Park", location: "Dallas, Texas" },
    { name: "Reverchon Park", location: "Dallas, Texas" },
    { name: "Exline Park", location: "Dallas, Texas" },
    { name: "Lawnview Park", location: "Dallas, Texas" },
    { name: "Pleasant Oaks Park", location: "Dallas, Texas" },
    { name: "Umphress Park", location: "Dallas, Texas" },
    { name: "Danieldale Park", location: "Dallas, Texas" },
    { name: "Cummings Park", location: "Dallas, Texas" },
    { name: "Arlington Park", location: "Dallas, Texas" },
    { name: "Beckley-Saner Park", location: "Dallas, Texas" },
    { name: "Benito Juarez Park", location: "Dallas, Texas" },
    { name: "Bluffview Park", location: "Dallas, Texas" },
    { name: "Buckner Park", location: "Dallas, Texas" },
    { name: "Cheyenne Park", location: "Dallas, Texas" },
    { name: "Ferguson Road Park", location: "Dallas, Texas" },
    { name: "J.P. Hawn Park", location: "Dallas, Texas" },
    { name: "Jaycee-Zaragoza Park", location: "Dallas, Texas" },
    { name: "John C. Phelps Park", location: "Dallas, Texas" },
    { name: "Lakeland Hills Park", location: "Dallas, Texas" },
    { name: "Tommie M. Allen Park", location: "Dallas, Texas" },
    { name: "Campbell Green Park", location: "Dallas, Texas" },
    { name: "Fretz Park", location: "Dallas, Texas" },
    { name: "Harry Moss Park", location: "Dallas, Texas" },
    { name: "Timberglen Park", location: "Dallas, Texas" },
    { name: "Valley View Park", location: "Dallas, Texas" },
    { name: "Webb Chapel Park", location: "Dallas, Texas" },
    { name: "Arden Terrace Park", location: "Dallas, Texas" },
    { name: "Randall Park", location: "Dallas, Texas" },
  ],
  DFW_Suburbs_Municipal: [
    { name: "Harold Patterson Sports Complex", location: "Plano, Texas" },
    { name: "Toyota Soccer Center", location: "Frisco, Texas" },
    { name: "McKinney Soccer Complex at Craig Ranch", location: "McKinney, Texas" },
    { name: "Russell Creek Park", location: "Plano, Texas" },
    { name: "Carpenter Park", location: "Plano, Texas" },
    { name: "Jack Carter Park", location: "Plano, Texas" },
    { name: "High Point Park", location: "Carrollton, Texas" },
    { name: "Cheyenne Park", location: "Plano, Texas" },
    { name: "Al Ruschhaupt Soccer Complex", location: "Garland, Texas" },
    { name: "Irving Soccer Complex", location: "Irving, Texas" },
    { name: "Mountain Creek Soccer Complex", location: "Grand Prairie, Texas" },
    { name: "Mike Lewis Park", location: "Grand Prairie, Texas" },
    { name: "Warren Sports Complex", location: "Frisco, Texas" },
    { name: "Northeast Park", location: "Frisco, Texas" },
    { name: "Harold Bacchus Park", location: "Garland, Texas" },
    { name: "Fort Worth Gateway Park", location: "Fort Worth, Texas" },
    { name: "Fort Worth North Park", location: "Fort Worth, Texas" },
    { name: "Alliance Soccer Complex", location: "Fort Worth, Texas" },
    { name: "Rolling Hills Soccer Complex", location: "Fort Worth, Texas" },
    { name: "G. Roland Vela Soccer Complex", location: "Fort Worth, Texas" },
    { name: "Breckinridge Park", location: "Richardson, Texas" },
    { name: "Huffhines Rec Center Fields", location: "Richardson, Texas" },
    { name: "Lookout Park", location: "Richardson, Texas" },
    { name: "Celebration Park", location: "Allen, Texas" },
    { name: "Ford Park", location: "Allen, Texas" },
    { name: "Audubon Park", location: "Garland, Texas" },
    { name: "McInnish Park", location: "Carrollton, Texas" },
    { name: "Bob Wiseman Soccer Complex", location: "Lewisville, Texas" },
    { name: "Bedford Boys Ranch", location: "Bedford, Texas" },
    { name: "Green Valley Community Park", location: "Coppell, Texas" },
    { name: "Bob Jones Soccer Complex", location: "Southlake, Texas" },
    { name: "Meadowmere Park", location: "Grapevine, Texas" },
    { name: "Bakersfield Park", location: "Flower Mound, Texas" },
    { name: "Andy Brown Park West", location: "Coppell, Texas" },
    { name: "Mansfield Sports Complex", location: "Mansfield, Texas" },
    { name: "KSA Soccer Complex", location: "Keller, Texas" },
    { name: "Hurst Athletic Complex", location: "Hurst, Texas" },
    { name: "Bruton Soccer Complex", location: "Mesquite, Texas" },
    { name: "Frontier Park", location: "Prosper, Texas" },
    { name: "Founders Park", location: "Euless, Texas" },
    { name: "Rowlett Community Park", location: "Rowlett, Texas" },
    { name: "Grimes Park", location: "Wylie, Texas" },
    { name: "Dionne Bagsby All Sports Complex", location: "DeSoto, Texas" },
    { name: "Corinth Community Park", location: "Corinth, Texas" },
    { name: "Chinn Chapel Soccer Complex", location: "Burleson, Texas" },
    { name: "Parks at Texas Star", location: "Euless, Texas" },
    { name: "YMCA Sports Complex", location: "Fort Worth, Texas" },
  ],
  DFW_Private_Indoor: [
    { name: "FieldhouseUSA Frisco", location: "Frisco, Texas" },
    { name: "FieldhouseUSA Grapevine", location: "Grapevine, Texas" },
    { name: "FieldhouseUSA Mansfield", location: "Mansfield, Texas" },
    { name: "Game On Arena Sports", location: "Plano, Texas" },
    { name: "PIT+ Frisco", location: "Frisco, Texas" },
    { name: "PIT+ Plano", location: "Plano, Texas" },
    { name: "Plano Sports Authority", location: "Plano, Texas" },
    { name: "TOCA Soccer Carrollton", location: "Carrollton, Texas" },
    { name: "Soccer Spectrum", location: "Irving, Texas" },
    { name: "Lords Indoor Sports", location: "Carrollton, Texas" },
    { name: "Blue Sky Sports Center", location: "Garland, Texas" },
    { name: "DFW Indoor Sports", location: "Grand Prairie, Texas" },
    { name: "Ford Center at The Star", location: "Frisco, Texas" },
  ],
  Houston_Metro: [
    { name: "George Bush Park", location: "Houston, Texas" },
    { name: "Meyer Park", location: "Houston, Texas" },
    { name: "Bear Creek Pioneers Park", location: "Houston, Texas" },
    { name: "Eldridge Park", location: "Houston, Texas" },
    { name: "Houston Soccer Field", location: "Houston, Texas" },
    { name: "Cullen Park", location: "Houston, Texas" },
    { name: "Katy ISC Sports Complex", location: "Katy, Texas" },
    { name: "Community Park", location: "Missouri City, Texas" },
    { name: "Chester L. Davis Sportsplex", location: "Pearland, Texas" },
    { name: "El Franco Lee Park", location: "Houston, Texas" },
    { name: "Memorial Park Sports Complex", location: "Houston, Texas" },
    { name: "Revolution Soccer Complex", location: "Cypress, Texas" },
    { name: "Vetta Sports Woodlands", location: "The Woodlands, Texas" },
    { name: "Houston Sports Park", location: "Houston, Texas" },
    { name: "Baytown Soccer Complex", location: "Baytown, Texas" },
    { name: "Gosling Sports Fields", location: "The Woodlands, Texas" },
    { name: "Bear Branch Sports Fields", location: "The Woodlands, Texas" },
    { name: "Alden Bridge Sports Fields", location: "The Woodlands, Texas" },
    { name: "Herman Brown Park", location: "Houston, Texas" },
    { name: "Barcelona Center of Excellence", location: "Houston, Texas" },
    { name: "Shadow Creek Sports Complex", location: "Pearland, Texas" },
    { name: "B.G. Peck Soccer Complex", location: "Friendswood, Texas" },
    { name: "Stampede Sportsplex", location: "League City, Texas" },
    { name: "Carl Barton Jr. Park", location: "Pasadena, Texas" },
    { name: "Dow Park Soccer Complex", location: "Deer Park, Texas" },
    { name: "Dave Finkel Fields", location: "Houston, Texas" },
    { name: "Milby Park", location: "Houston, Texas" },
    { name: "Bayland Park", location: "Houston, Texas" },
    { name: "Keith-Wiess Park", location: "Houston, Texas" },
    { name: "Community Fieldhouse", location: "Katy, Texas" },
    { name: "MAFC Academy", location: "Houston, Texas" },
    { name: "West Houston Indoor Soccer", location: "Houston, Texas" },
    { name: "PSG Academy Houston", location: "Houston, Texas" },
  ],
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
  facilities: Array<{ name: string; location: string }>,
  stats: Stats
): Promise<void> {
  console.log(`\n${"=".repeat(70)}`);
  console.log(`📍 Region: ${regionName} (${facilities.length} facilities)`);
  console.log("=".repeat(70));

  for (let i = 0; i < facilities.length; i++) {
    const facility = facilities[i];
    const facilityNum = i + 1;

    console.log(
      `\n  [${facilityNum}/${facilities.length}] ${facility.name} (${facility.location})`
    );

    stats.total++;

    // Search for facility
    const placeId = await searchFacilityByName(facility.name, facility.location);
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

async function collectSpecificFacilities() {
  console.log("🚀 Starting Specific Facilities Collection");
  console.log("=".repeat(70));
  console.log(`📊 Total Facilities: ${
    FACILITIES.Dallas_City.length +
    FACILITIES.DFW_Suburbs_Municipal.length +
    FACILITIES.DFW_Private_Indoor.length +
    FACILITIES.Houston_Metro.length
  }`);
  console.log(`📋 Regions: Dallas City, DFW Suburbs, DFW Private/Indoor, Houston Metro`);
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
  await processRegion("Dallas_City", FACILITIES.Dallas_City, stats);
  await processRegion("DFW_Suburbs_Municipal", FACILITIES.DFW_Suburbs_Municipal, stats);
  await processRegion("DFW_Private_Indoor", FACILITIES.DFW_Private_Indoor, stats);
  await processRegion("Houston_Metro", FACILITIES.Houston_Metro, stats);

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
collectSpecificFacilities().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
