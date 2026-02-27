import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import axios from "axios";

// Load environment variables
dotenv.config({ path: path.join(__dirname, "../.env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Error: Missing required environment variables");
  console.error(
    "   Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Zoning Available tag ID
const ZONING_AVAILABLE_TAG_ID = "decab5a1-ac42-4060-92f3-16e53d940287";

interface FacilityToEnrich {
  id: string;
  place_id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

interface ProgressState {
  processedCount: number;
  successCount: number;
  failedCount: number;
  skippedCount: number;
  notSupportedCount: number;
  processedPlaceIds: string[];
  lastProcessedIndex: number;
  apiCallsUsed: number;
  lastUpdated: string;
  errors: Array<{
    place_id: string;
    name: string;
    error: string;
    timestamp: string;
  }>;
}

interface ZoningData {
  classification: string;
  code?: string;
  description?: string;
  district?: string;
  source: string;
  rawResponse: any;
}

const PROGRESS_FILE = path.join(__dirname, "../.zoning-progress.json");
const FACILITIES_FILE = path.join(
  __dirname,
  "../data/top-2500-high-quality-texas-facilities.json",
);

// Test mode: Set to a number to limit processing (e.g., 10 for testing), or null to process all
const TEST_LIMIT: number | null = 10;

// Rate limiting
const DELAY_BETWEEN_REQUESTS_MS = 1000; // 1 second between requests
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 3000; // 3 seconds

// Helper functions
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function loadProgress(): ProgressState {
  if (fs.existsSync(PROGRESS_FILE)) {
    const data = fs.readFileSync(PROGRESS_FILE, "utf-8");
    return JSON.parse(data);
  }
  return {
    processedCount: 0,
    successCount: 0,
    failedCount: 0,
    skippedCount: 0,
    notSupportedCount: 0,
    processedPlaceIds: [],
    lastProcessedIndex: -1,
    apiCallsUsed: 0,
    lastUpdated: new Date().toISOString(),
    errors: [],
  };
}

function saveProgress(progress: ProgressState) {
  progress.lastUpdated = new Date().toISOString();
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

function loadFacilities(): FacilityToEnrich[] {
  if (!fs.existsSync(FACILITIES_FILE)) {
    console.error(`❌ Error: Facilities file not found at ${FACILITIES_FILE}`);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(FACILITIES_FILE, "utf-8"));
  return data.facilities.map((f: any) => ({
    id: f.id,
    place_id: f.place_id,
    name: f.name,
    address: f.address,
    lat: f.location.lat,
    lng: f.location.lng,
  }));
}

/**
 * Detect city from address string
 */
function detectCity(address: string): string | null {
  const addressLower = address.toLowerCase();

  const cityPatterns: { [key: string]: string[] } = {
    dallas: ["dallas"],
    houston: ["houston"],
    austin: ["austin"],
    "san antonio": ["san antonio"],
    "fort worth": ["fort worth"],
  };

  for (const [city, patterns] of Object.entries(cityPatterns)) {
    if (patterns.some((pattern) => addressLower.includes(pattern))) {
      return city;
    }
  }

  return null;
}

/**
 * Fetch zoning data from Dallas Open Data Portal
 * Uses ArcGIS REST API
 */
async function getDallasZoning(
  lat: number,
  lng: number,
): Promise<ZoningData | null> {
  try {
    // Dallas Zoning layer - ArcGIS REST API
    const url =
      "https://services.arcgis.com/IEz4Ov7idEBKYPTT/arcgis/rest/services/Zoning/FeatureServer/0/query";

    const params = {
      geometry: `${lng},${lat}`,
      geometryType: "esriGeometryPoint",
      spatialRel: "esriSpatialRelIntersects",
      outFields: "*",
      returnGeometry: false,
      f: "json",
      inSR: 4326, // WGS84
    };

    const response = await axios.get(url, { params, timeout: 10000 });

    if (
      response.data.features &&
      response.data.features.length > 0 &&
      response.data.features[0].attributes
    ) {
      const attrs = response.data.features[0].attributes;

      return {
        classification: attrs.ZONING_NAME || attrs.ZONE_TYPE || "Unknown",
        code: attrs.ZONING || attrs.ZONE_CODE,
        description: attrs.DESCRIPTION || attrs.ZONING_DESC,
        district: attrs.DISTRICT,
        source: "dallas_opendata",
        rawResponse: response.data.features[0],
      };
    }

    return null;
  } catch (error: any) {
    console.log(`     ⚠️  Dallas API error: ${error.message}`);
    return null;
  }
}

/**
 * Fetch zoning data from Houston Open Data Portal
 * Uses ArcGIS REST API
 */
async function getHoustonZoning(
  lat: number,
  lng: number,
): Promise<ZoningData | null> {
  try {
    // Houston doesn't have traditional zoning (famously unzoned city)
    // But they have land use and development codes
    const url =
      "https://cohgis.houstontx.gov/cohgisrest/rest/services/PW/Land_Use/MapServer/0/query";

    const params = {
      geometry: `${lng},${lat}`,
      geometryType: "esriGeometryPoint",
      spatialRel: "esriSpatialRelIntersects",
      outFields: "*",
      returnGeometry: false,
      f: "json",
      inSR: 4326,
    };

    const response = await axios.get(url, { params, timeout: 10000 });

    if (
      response.data.features &&
      response.data.features.length > 0 &&
      response.data.features[0].attributes
    ) {
      const attrs = response.data.features[0].attributes;

      return {
        classification:
          attrs.LAND_USE || attrs.USE_TYPE || "Unzoned (Houston)",
        code: attrs.USE_CODE,
        description: attrs.USE_DESC || "Houston has no traditional zoning",
        district: attrs.DISTRICT,
        source: "houston_gis",
        rawResponse: response.data.features[0],
      };
    }

    return null;
  } catch (error: any) {
    console.log(`     ⚠️  Houston API error: ${error.message}`);
    return null;
  }
}

/**
 * Fetch zoning data from Austin Open Data Portal
 * Uses ArcGIS REST API
 */
async function getAustinZoning(
  lat: number,
  lng: number,
): Promise<ZoningData | null> {
  try {
    // Austin Zoning layer
    const url =
      "https://services.arcgis.com/0L95CJ0VTaxqcmED/arcgis/rest/services/BOUNDARIES_jurisdictions_zoning/FeatureServer/0/query";

    const params = {
      geometry: `${lng},${lat}`,
      geometryType: "esriGeometryPoint",
      spatialRel: "esriSpatialRelIntersects",
      outFields: "*",
      returnGeometry: false,
      f: "json",
      inSR: 4326,
    };

    const response = await axios.get(url, { params, timeout: 10000 });

    if (
      response.data.features &&
      response.data.features.length > 0 &&
      response.data.features[0].attributes
    ) {
      const attrs = response.data.features[0].attributes;

      return {
        classification: attrs.ZONING_Ztyp || attrs.ZONE_NAME || "Unknown",
        code: attrs.ZONING || attrs.ZONE_CODE,
        description: attrs.ZONE_DESC,
        district: attrs.DISTRICT,
        source: "austin_gis",
        rawResponse: response.data.features[0],
      };
    }

    return null;
  } catch (error: any) {
    console.log(`     ⚠️  Austin API error: ${error.message}`);
    return null;
  }
}

/**
 * Fetch zoning data from San Antonio Open Data Portal
 * Uses ArcGIS REST API
 */
async function getSanAntonioZoning(
  lat: number,
  lng: number,
): Promise<ZoningData | null> {
  try {
    // San Antonio Zoning layer
    const url =
      "https://services.arcgis.com/g1fRTDLeMgspWrYp/arcgis/rest/services/Zoning/FeatureServer/0/query";

    const params = {
      geometry: `${lng},${lat}`,
      geometryType: "esriGeometryPoint",
      spatialRel: "esriSpatialRelIntersects",
      outFields: "*",
      returnGeometry: false,
      f: "json",
      inSR: 4326,
    };

    const response = await axios.get(url, { params, timeout: 10000 });

    if (
      response.data.features &&
      response.data.features.length > 0 &&
      response.data.features[0].attributes
    ) {
      const attrs = response.data.features[0].attributes;

      return {
        classification: attrs.ZONE_TYPE || attrs.ZONING_NAME || "Unknown",
        code: attrs.ZONE_CODE || attrs.ZONING,
        description: attrs.ZONE_DESC,
        district: attrs.DISTRICT,
        source: "sanantonio_gis",
        rawResponse: response.data.features[0],
      };
    }

    return null;
  } catch (error: any) {
    console.log(`     ⚠️  San Antonio API error: ${error.message}`);
    return null;
  }
}

/**
 * Fetch zoning data from Fort Worth Open Data Portal
 * Uses ArcGIS REST API
 */
async function getFortWorthZoning(
  lat: number,
  lng: number,
): Promise<ZoningData | null> {
  try {
    // Fort Worth Zoning layer
    const url =
      "https://gis.fortworthtexas.gov/arcgis/rest/services/Planning/MapServer/0/query";

    const params = {
      geometry: `${lng},${lat}`,
      geometryType: "esriGeometryPoint",
      spatialRel: "esriSpatialRelIntersects",
      outFields: "*",
      returnGeometry: false,
      f: "json",
      inSR: 4326,
    };

    const response = await axios.get(url, { params, timeout: 10000 });

    if (
      response.data.features &&
      response.data.features.length > 0 &&
      response.data.features[0].attributes
    ) {
      const attrs = response.data.features[0].attributes;

      return {
        classification: attrs.ZONE_TYPE || attrs.ZONING || "Unknown",
        code: attrs.ZONE_CODE,
        description: attrs.ZONE_DESC,
        district: attrs.DISTRICT,
        source: "fortworth_gis",
        rawResponse: response.data.features[0],
      };
    }

    return null;
  } catch (error: any) {
    console.log(`     ⚠️  Fort Worth API error: ${error.message}`);
    return null;
  }
}

/**
 * Main function to fetch zoning data based on city
 */
async function fetchZoningData(
  address: string,
  lat: number,
  lng: number,
  retryCount = 0,
): Promise<{
  success: boolean;
  data?: ZoningData;
  error?: string;
  notSupported?: boolean;
}> {
  const city = detectCity(address);

  if (!city) {
    return {
      success: false,
      notSupported: true,
      error: "City not supported (not in Dallas/Houston/Austin/San Antonio/Fort Worth)",
    };
  }

  try {
    let zoningData: ZoningData | null = null;

    switch (city) {
      case "dallas":
        zoningData = await getDallasZoning(lat, lng);
        break;
      case "houston":
        zoningData = await getHoustonZoning(lat, lng);
        break;
      case "austin":
        zoningData = await getAustinZoning(lat, lng);
        break;
      case "san antonio":
        zoningData = await getSanAntonioZoning(lat, lng);
        break;
      case "fort worth":
        zoningData = await getFortWorthZoning(lat, lng);
        break;
      default:
        return {
          success: false,
          notSupported: true,
          error: `City "${city}" API not implemented`,
        };
    }

    if (zoningData) {
      return {
        success: true,
        data: zoningData,
      };
    }

    return {
      success: false,
      error: "No zoning data found at this location",
    };
  } catch (error: any) {
    // Retry logic
    if (retryCount < MAX_RETRIES) {
      console.log(
        `     ⚠️  Error, retrying (${retryCount + 1}/${MAX_RETRIES})...`,
      );
      await delay(RETRY_DELAY_MS);
      return fetchZoningData(address, lat, lng, retryCount + 1);
    }

    return {
      success: false,
      error: error.message || "Unknown error",
    };
  }
}

/**
 * Insert zoning data into database
 */
async function insertZoningData(
  placeId: string,
  zoningData: ZoningData,
): Promise<boolean> {
  try {
    const { error } = await supabase.from("sports_facilities_zoning").insert({
      place_id: placeId,
      zoning_classification: zoningData.classification,
      zoning_code: zoningData.code,
      zoning_description: zoningData.description,
      zoning_district: zoningData.district,
      data_source: zoningData.source,
      raw_response: zoningData.rawResponse,
    });

    if (error) {
      console.log(`     ⚠️  Database insert error: ${error.message}`);
      return false;
    }

    return true;
  } catch (error: any) {
    console.log(`     ⚠️  Exception during insert: ${error.message}`);
    return false;
  }
}

/**
 * Assign "Zoning Available" tag to facility
 */
async function assignZoningTag(
  facilityId: string,
  placeId: string,
): Promise<boolean> {
  try {
    // Check if tag assignment already exists
    const { data: existing, error: checkError } = await supabase
      .from("facility_tag_assignments")
      .select("id")
      .eq("facility_id", facilityId)
      .eq("tag_id", ZONING_AVAILABLE_TAG_ID)
      .single();

    if (existing) {
      console.log(`     ✓ Tag already assigned`);
      return true;
    }

    // Insert new tag assignment
    const { error } = await supabase.from("facility_tag_assignments").insert({
      facility_id: facilityId,
      tag_id: ZONING_AVAILABLE_TAG_ID,
    });

    if (error) {
      console.log(`     ⚠️  Tag assignment error: ${error.message}`);
      return false;
    }

    console.log(`     ✓ Assigned "Zoning Available" tag`);
    return true;
  } catch (error: any) {
    console.log(`     ⚠️  Exception during tag assignment: ${error.message}`);
    return false;
  }
}

/**
 * Process a single facility
 */
async function processFacility(
  facility: FacilityToEnrich,
  progress: ProgressState,
  index: number,
  total: number,
): Promise<void> {
  console.log(`\n[${index + 1}/${total}] Processing: ${facility.name}`);
  console.log(`   Place ID: ${facility.place_id}`);
  console.log(`   Address: ${facility.address}`);

  // Check if already processed
  if (progress.processedPlaceIds.includes(facility.place_id)) {
    console.log(`   ⏭️  Already processed, skipping...`);
    progress.skippedCount++;
    return;
  }

  const city = detectCity(facility.address);
  if (city) {
    console.log(`   📍 Detected city: ${city}`);
  } else {
    console.log(`   ⚠️  City not detected or not supported`);
  }

  // Fetch zoning data
  console.log(`   🔍 Fetching zoning data...`);
  const zoningResult = await fetchZoningData(
    facility.address,
    facility.lat,
    facility.lng,
  );
  progress.apiCallsUsed++;

  if (zoningResult.notSupported) {
    console.log(`   ⏭️  ${zoningResult.error}`);
    progress.notSupportedCount++;
    progress.processedPlaceIds.push(facility.place_id);
    progress.processedCount++;
    progress.lastProcessedIndex = index;
    return;
  }

  if (!zoningResult.success || !zoningResult.data) {
    console.log(`   ❌ Failed: ${zoningResult.error}`);
    progress.failedCount++;
    progress.errors.push({
      place_id: facility.place_id,
      name: facility.name,
      error: zoningResult.error || "Unknown error",
      timestamp: new Date().toISOString(),
    });
    progress.processedPlaceIds.push(facility.place_id);
    progress.processedCount++;
    progress.lastProcessedIndex = index;
    return;
  }

  const zoning = zoningResult.data;
  console.log(`   ✓ Classification: ${zoning.classification}`);
  console.log(`   ✓ Code: ${zoning.code || "N/A"}`);
  console.log(`   ✓ Source: ${zoning.source}`);

  // Insert into database
  console.log(`   💾 Inserting zoning data...`);
  const inserted = await insertZoningData(facility.place_id, zoning);

  if (!inserted) {
    console.log(`   ❌ Failed to insert zoning data`);
    progress.failedCount++;
    progress.errors.push({
      place_id: facility.place_id,
      name: facility.name,
      error: "Database insert failed",
      timestamp: new Date().toISOString(),
    });
    progress.processedPlaceIds.push(facility.place_id);
    progress.processedCount++;
    progress.lastProcessedIndex = index;
    return;
  }

  // Assign tag
  console.log(`   🏷️  Assigning "Zoning Available" tag...`);
  await assignZoningTag(facility.id, facility.place_id);

  console.log(`   ✅ Success!`);
  progress.successCount++;
  progress.processedPlaceIds.push(facility.place_id);
  progress.processedCount++;
  progress.lastProcessedIndex = index;
}

/**
 * Generate progress summary
 */
function printProgressSummary(
  progress: ProgressState,
  total: number,
  startTime: number,
): void {
  const elapsed = (Date.now() - startTime) / 1000 / 60; // minutes
  const remaining = total - progress.processedCount;
  const rate = progress.processedCount / elapsed;
  const eta = remaining / rate;

  console.log("\n" + "=".repeat(70));
  console.log("📊 PROGRESS SUMMARY");
  console.log("=".repeat(70));
  console.log(`   Total Facilities: ${total}`);
  console.log(`   Processed: ${progress.processedCount}`);
  console.log(`   Successful: ${progress.successCount}`);
  console.log(`   Failed: ${progress.failedCount}`);
  console.log(`   Skipped: ${progress.skippedCount}`);
  console.log(`   Not Supported: ${progress.notSupportedCount}`);
  console.log(`   Remaining: ${remaining}`);
  console.log(`   API Calls Used: ${progress.apiCallsUsed}`);
  console.log(
    `   Success Rate: ${((progress.successCount / (progress.processedCount || 1)) * 100).toFixed(1)}%`,
  );
  console.log(`   Elapsed Time: ${elapsed.toFixed(1)} minutes`);
  console.log(
    `   ETA: ${eta.toFixed(1)} minutes (~${(eta / 60).toFixed(1)} hours)`,
  );
  console.log(`   Rate: ${rate.toFixed(2)} facilities/minute`);
  console.log("=".repeat(70));
}

/**
 * Main function
 */
async function enrichWithZoning() {
  console.log("🚀 Zoning Data Enrichment Script");
  console.log("=".repeat(70));

  if (TEST_LIMIT) {
    console.log(`🧪 TEST MODE: Processing only ${TEST_LIMIT} facilities`);
    console.log("   (Set TEST_LIMIT to null in the script to process all)");
  }

  console.log("\n📋 This script will:");
  console.log("   • Load high-quality Texas facilities");
  console.log(
    "   • Fetch zoning data from FREE municipal APIs (Dallas, Houston, Austin, etc.)",
  );
  console.log("   • Insert zoning data into sports_facilities_zoning table");
  console.log('   • Assign "Zoning Available" tag to enriched facilities');
  console.log("   • Track progress for resumable operation");
  console.log("\n✅ Benefits:");
  console.log("   • 100% FREE - uses municipal open data APIs");
  console.log("   • Official government data");
  console.log("   • Rate limit: 1 request per second (conservative)");
  console.log("   • Separate table keeps data clean and organized");
  console.log(
    "\n⚠️  Supported Cities: Dallas, Houston, Austin, San Antonio, Fort Worth",
  );
  console.log("   Facilities in other cities will be skipped");

  if (TEST_LIMIT) {
    console.log(
      `\n   Estimated time: ~${((TEST_LIMIT * 1.5) / 60).toFixed(1)} minutes (test mode)`,
    );
  } else {
    console.log(
      "\n   Estimated time: ~62.5 minutes for 2,500 facilities (~1.5 seconds per facility)",
    );
  }

  console.log("=".repeat(70) + "\n");

  // Load facilities
  console.log("📂 Loading facilities...");
  const facilities = loadFacilities();
  console.log(`✅ Loaded ${facilities.length} facilities`);

  if (TEST_LIMIT) {
    console.log(`🧪 Test mode: Will process only ${TEST_LIMIT} facilities\n`);
  } else {
    console.log(`   Will process all ${facilities.length} facilities\n`);
  }

  // Load progress
  const progress = loadProgress();

  if (progress.processedCount > 0) {
    console.log("♻️  Resuming from previous session:");
    console.log(`   Last processed index: ${progress.lastProcessedIndex}`);
    console.log(
      `   Processed: ${progress.processedCount}/${facilities.length}`,
    );
    console.log(`   API calls used: ${progress.apiCallsUsed}\n`);
  }

  const startTime = Date.now();

  // Determine how many facilities to process
  const totalToProcess = TEST_LIMIT
    ? Math.min(TEST_LIMIT, facilities.length)
    : facilities.length;

  // Process each facility
  for (let i = progress.lastProcessedIndex + 1; i < totalToProcess; i++) {
    const facility = facilities[i];

    await processFacility(facility, progress, i, totalToProcess);

    // Save progress after each facility
    saveProgress(progress);

    // Print summary every 50 facilities
    if ((i + 1) % 50 === 0) {
      printProgressSummary(progress, totalToProcess, startTime);
    }

    // Rate limiting delay
    if (i < totalToProcess - 1) {
      await delay(DELAY_BETWEEN_REQUESTS_MS);
    }
  }

  // Final summary
  console.log("\n" + "=".repeat(70));
  console.log("🎉 ENRICHMENT COMPLETE!");
  console.log("=".repeat(70));
  console.log(`   Total Processed: ${progress.processedCount}`);
  console.log(`   Successful: ${progress.successCount}`);
  console.log(`   Failed: ${progress.failedCount}`);
  console.log(`   Skipped: ${progress.skippedCount}`);
  console.log(`   Not Supported (outside major cities): ${progress.notSupportedCount}`);
  console.log(`   API Calls Used: ${progress.apiCallsUsed}`);
  console.log(
    `   Success Rate: ${((progress.successCount / progress.processedCount) * 100).toFixed(1)}%`,
  );
  console.log(
    `   Total Time: ${((Date.now() - startTime) / 1000 / 60).toFixed(1)} minutes`,
  );

  if (progress.errors.length > 0) {
    console.log(`\n⚠️  Errors (${progress.errors.length}):`);
    progress.errors.slice(0, 10).forEach((error, index) => {
      console.log(
        `   ${index + 1}. ${error.name} (${error.place_id}): ${error.error}`,
      );
    });
    if (progress.errors.length > 10) {
      console.log(`   ... and ${progress.errors.length - 10} more`);
    }
    console.log(`   Full error log saved in: ${PROGRESS_FILE}`);
  }

  console.log("\n✅ All facilities have been enriched with zoning data!");
  console.log('✅ Facilities tagged with "Zoning Available" tag');
  console.log("=".repeat(70));
}

enrichWithZoning().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
