import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import OpenAI from "openai";

// Load environment variables
dotenv.config({ path: path.join(__dirname, "../.env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const openaiApiKey = process.env.OPENAI_API_KEY!;

if (!supabaseUrl || !supabaseServiceKey || !openaiApiKey) {
  console.error("❌ Error: Missing required environment variables");
  console.error(
    "   Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY",
  );
  process.exit(1);
}

// Service role client for all operations (bypasses RLS)
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
const openai = new OpenAI({ apiKey: openaiApiKey });

interface FacilityToEnrich {
  place_id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  city?: string;
  county?: string;
}

interface ZoningData {
  // Core zoning information
  zoning_classification?: string;
  zoning_code?: string;
  zoning_description?: string;
  zoning_district?: string;
  allowed_uses?: string[];
  prohibited_uses?: string[];

  // Height limits (string + numeric)
  height_limit?: string;
  height_limit_ft?: number;

  // Setbacks (string + numeric)
  setback_requirements?: string;
  setback_front_ft?: number;
  setback_side_ft?: number;
  setback_rear_ft?: number;

  // Lot coverage (string + numeric)
  lot_coverage?: string;
  lot_coverage_max_pct?: number;

  // Parking (string + numeric)
  parking_requirements?: string;
  parking_ratio?: string;
  parking_spaces_required?: number;

  // Floor area ratio
  floor_area_ratio?: number;

  // Sports facility operational restrictions
  operating_hours_restrictions?: string;
  noise_restrictions?: string;
  outdoor_lighting_restrictions?: string;
  maximum_occupancy?: number;

  // Additional physical requirements
  impervious_surface_max_pct?: number;
  required_green_space_pct?: number;
  building_coverage_max_pct?: number;
  buffer_requirements?: string;

  // Permit and use information
  special_permits_required?: boolean;
  special_permit_types?: string[];
  conditional_use_permit_required?: boolean;
  temporary_use_permit_info?: string;
  signage_restrictions?: string;
  accessory_structures_allowed?: string[];

  // Additional context
  source_url?: string;
  overlay_districts?: string[];
  development_standards?: any;
  sports_facility_specific_notes?: string;
  minimum_lot_size_sqft?: number;
  maximum_density?: string;
  zoning_effective_date?: string;
  future_land_use_designation?: string;
}

interface ProgressState {
  processedCount: number;
  successCount: number;
  failedCount: number;
  skippedCount: number;
  processedPlaceIds: string[];
  lastProcessedIndex: number;
  apiCallsUsed: number;
  totalCost: number;
  lastUpdated: string;
  errors: Array<{
    place_id: string;
    name: string;
    error: string;
    timestamp: string;
  }>;
}

const PROGRESS_FILE = path.join(__dirname, "../progress/zoning-web-progress.json");

// Test mode: Set to a number to limit processing (e.g., 5 for testing), or null to process all
const TEST_LIMIT: number | null = 20;

// Rate limiting
const DELAY_BETWEEN_REQUESTS_MS = 3000; // 3 seconds between requests
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 5000; // 5 seconds

// OpenAI API timeout
const OPENAI_TIMEOUT_MS = 300000; // 5 minutes (web search can take a while)
const PROGRESS_LOG_INTERVAL_MS = 30000; // Log "still searching" every 30 seconds

// Cost tracking (Web search tool pricing + GPT-5 base cost)
// Web search tool: ~$0.01-0.03 per search call
// GPT-5 tokens: Varies by usage
// Estimated cost per facility with web search
const ESTIMATED_COST_PER_FACILITY = 0.03;

// County GIS portal mappings for major Texas counties
// Currently unused but available for future expansion
// const COUNTY_GIS_PORTALS: Record<string, string> = {
//   "dallas": "https://gisweb.dallascounty.org/",
//   "tarrant": "https://www.tarrantcounty.com/en/appraisal-district.html",
//   "harris": "https://www.hcad.org/",
//   "bexar": "https://gis.bcad.org/",
//   "travis": "https://www.tcad.org/",
//   "collin": "https://www.collincad.org/",
//   "denton": "https://www.dentoncad.com/",
//   "williamson": "https://www.wcad.org/",
//   "fort bend": "https://fbcad.org/",
//   "montgomery": "https://www.mctx.org/",
// };

// Allowed domains for web search - ONLY main city government sites for focused searches
// Reduced from 18 to 7 domains to avoid generic portal pages and improve search quality
const ALLOWED_DOMAINS = [
  "dallascityhall.com",
  "houstontx.gov",
  "austintexas.gov",
  "sanantonio.gov",
  "fortworthtexas.gov",
  "arlingtontx.gov",
  "plano.gov",
];

// GIS REST API endpoints for each city (faster, more reliable than web search)
interface CityGisConfig {
  baseUrl: string;
  layerId: number;
  fieldMappings: {
    zoningCode?: string;
    zoningClassification?: string;
    zoningDescription?: string;
    zoningDistrict?: string;
    // Additional fields from GIS APIs
    zoningEffectiveDate?: string;
    caseNumber?: string;
    ordinanceNumber?: string;
    overlayDistricts?: string | string[]; // Can be single field or multiple
    primaryUse?: string;
    // City-specific fields
    shortTermRentals?: string; // Fort Worth only
    residentialDensityType?: string; // Arlington only
    councilDistrict?: string;
    historicDistrict?: string;
    ordinanceFileUrl?: string;
  };
}

const CITY_GIS_APIS: Record<string, CityGisConfig> = {
  dallas: {
    baseUrl:
      "https://services5.arcgis.com/74bZbbuf05Ctvbzv/arcgis/rest/services/City_of_Dallas_Base_Zoning/FeatureServer",
    layerId: 21, // Correct layer: "City of Dallas Base Zoning"
    fieldMappings: {
      zoningCode: "ZONE_DIST", // e.g., "R-7.5(A)"
      zoningDescription: "LONG_ZONE_DIST",
      zoningDistrict: "ZONE_DIST",
      zoningClassification: "DISTRICTUSE", // District classification code
      zoningEffectiveDate: "EFFECTIVEDATE", // When zoning became effective
      caseNumber: "CASE_NUMBER", // Planning case reference
      ordinanceNumber: "ORD_NUM", // Ordinance reference
      overlayDistricts: "PD_NUM", // Planned development number
    },
  },
  // TEMPORARILY DISABLED - BROKEN APIS (need correct endpoints)
  // houston: {
  //   baseUrl:
  //     "https://mycity2.houstontx.gov/pubgis02/rest/services/HoustonMap/Planning_and_Development/MapServer",
  //   layerId: 0, // BROKEN: No zoning layer in Planning_and_Development service
  //   fieldMappings: {
  //     zoningCode: "ZONING",
  //     zoningDescription: "ZONE_DESC",
  //   },
  // },
  // austin: {
  //   baseUrl: "https://maps.austintexas.gov/gis/rest/Shared/Zoning_2/MapServer",
  //   layerId: 0, // BROKEN: This service only has overlay districts, not base zoning
  //   fieldMappings: {
  //     zoningCode: "ZONING_ZTYPE",
  //     zoningDescription: "ZONING_DESC",
  //   },
  // },
  // "san antonio": {
  //   baseUrl:
  //     "https://qagis.sanantonio.gov/arcgis/rest/services/DSD/OneStop_Simple/MapServer",
  //   layerId: 33, // BROKEN: Service returns 500 error (may have moved)
  //   fieldMappings: {
  //     zoningCode: "ZONE_",
  //     zoningDescription: "ZONE_DESC",
  //   },
  // },
  "fort worth": {
    baseUrl:
      "https://mapit.fortworthtexas.gov/ags/rest/services/Planning_Development/Zoning/MapServer",
    layerId: 25, // Correct layer: "Zoning Fill"
    fieldMappings: {
      zoningCode: "ZONING", // Base zoning code, e.g., "H"
      zoningDescription: "BASE_ZONING",
      primaryUse: "PRIMARY_USE", // Primary use designation
      zoningEffectiveDate: "ORD_EFF_DATE", // Ordinance effective date
      caseNumber: "CASE_NUMBER", // Planning case number
      ordinanceNumber: "ORDINANCE_NO", // Ordinance number
      overlayDistricts: ["PD", "HISTORIC"], // Planned development & historic
      shortTermRentals: "Short_Term_Rentals", // "Allowed", "Not Allowed", or "Zoning Verification Required"
      councilDistrict: "COUNCIL_DIST", // Council district
    },
  },
  arlington: {
    baseUrl:
      "https://gis2.arlingtontx.gov/agsext2/rest/services/Planning/ZoningInfo/MapServer",
    layerId: 6, // Correct layer: "Zoning"
    fieldMappings: {
      zoningCode: "DISTRICT", // Base zoning district, e.g., "DB"
      zoningDescription: "ZONINGDESCRIPTION",
      zoningDistrict: "DISTRICT",
      overlayDistricts: "ZONINGDETAIL", // Detailed zoning code (may include overlays)
      zoningEffectiveDate: "EFFECTIVEDATE", // Effective date
      caseNumber: "ZONINGCASE", // Zoning case number
      ordinanceNumber: "ORDINANCE", // Ordinance number
      residentialDensityType: "PD_RESIDENTIAL", // "B"=Both MF&SF, "M"=Multi-Family, "N"=None, "S"=Single Family
      ordinanceFileUrl: "OrdinanceFileName", // Link to ordinance document
    },
  },
};

// List of supported cities (lowercase for matching)
const SUPPORTED_CITIES = [
  "dallas",
  "houston",
  "austin",
  "san antonio",
  "fort worth",
  "arlington",
  "plano",
];

// Filter mode: Set to true to only process facilities in supported cities
const FILTER_TO_SUPPORTED_CITIES = true;

// GIS API only mode: Set to true to only process cities with GIS APIs (excludes Plano)
// This ensures 100% fast, free GIS API calls with no web searches
const GIS_API_ONLY_MODE = true;

// Helper functions
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Query city GIS REST API for zoning information using lat/lng coordinates
 */
async function queryGisZoning(
  lat: number,
  lng: number,
  city: string,
): Promise<{
  success: boolean;
  zoningData?: Partial<ZoningData>;
  error?: string;
}> {
  const gisConfig = CITY_GIS_APIS[city.toLowerCase()];

  if (!gisConfig) {
    return {
      success: false,
      error: `No GIS API configured for ${city}`,
    };
  }

  try {
    // Construct ArcGIS REST API query URL
    const queryUrl = `${gisConfig.baseUrl}/${gisConfig.layerId}/query`;
    const params = new URLSearchParams({
      geometry: `${lng},${lat}`, // ArcGIS uses lng,lat order
      geometryType: "esriGeometryPoint",
      inSR: "4326", // Input spatial reference (WGS84 lat/lng)
      spatialRel: "esriSpatialRelIntersects",
      outFields: "*",
      returnGeometry: "false",
      outSR: "4326", // Output spatial reference
      f: "json",
    });

    const fullUrl = `${queryUrl}?${params.toString()}`;
    console.log(`     🗺️  Querying GIS API: ${city}...`);
    console.log(`     🔗 API URL: ${fullUrl.substring(0, 150)}...`);
    console.log(`     📍 Coordinates: ${lat}, ${lng}`);

    const response = await fetch(fullUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.log(`     ❌ HTTP ${response.status}: ${response.statusText}`);
      return {
        success: false,
        error: `GIS API returned ${response.status}: ${response.statusText}`,
      };
    }

    const data = await response.json();

    // Debug: Log the response structure
    console.log(`     📦 Response structure:`, {
      hasFeatures: !!data.features,
      featureCount: data.features?.length || 0,
      hasError: !!data.error,
      errorMessage: data.error?.message,
    });

    // Check for ArcGIS errors
    if (data.error) {
      console.log(`     ❌ ArcGIS Error: ${data.error.message} (Code: ${data.error.code})`);
      return {
        success: false,
        error: `ArcGIS Error: ${data.error.message}`,
      };
    }

    // Check if we got any features back
    if (!data.features || data.features.length === 0) {
      console.log(`     ⚠️  Query succeeded but returned 0 features`);
      console.log(`     💡 This might mean: wrong layer ID, point outside zoning boundaries, or spatial reference mismatch`);
      return {
        success: false,
        error: "No zoning data found at this location (GIS returned 0 features)",
      };
    }

    // Debug: Log first feature
    console.log(`     ✓ Found ${data.features.length} feature(s)`);
    if (data.features[0]?.attributes) {
      console.log(`     📋 First feature attributes:`, Object.keys(data.features[0].attributes).slice(0, 10));
    }

    // Extract the first feature's attributes
    const attributes = data.features[0].attributes;

    // Map fields based on city-specific configuration
    const zoningData: Partial<ZoningData> = {};

    if (
      gisConfig.fieldMappings.zoningCode &&
      attributes[gisConfig.fieldMappings.zoningCode]
    ) {
      zoningData.zoning_code =
        String(attributes[gisConfig.fieldMappings.zoningCode]).trim();
    }

    if (
      gisConfig.fieldMappings.zoningDescription &&
      attributes[gisConfig.fieldMappings.zoningDescription]
    ) {
      zoningData.zoning_description = String(
        attributes[gisConfig.fieldMappings.zoningDescription],
      ).trim();
    }

    if (
      gisConfig.fieldMappings.zoningClassification &&
      attributes[gisConfig.fieldMappings.zoningClassification]
    ) {
      zoningData.zoning_classification = String(
        attributes[gisConfig.fieldMappings.zoningClassification],
      ).trim();
    }

    if (
      gisConfig.fieldMappings.zoningDistrict &&
      attributes[gisConfig.fieldMappings.zoningDistrict]
    ) {
      zoningData.zoning_district = String(
        attributes[gisConfig.fieldMappings.zoningDistrict],
      ).trim();
    }

    // Map additional fields from GIS
    if (
      gisConfig.fieldMappings.zoningEffectiveDate &&
      attributes[gisConfig.fieldMappings.zoningEffectiveDate]
    ) {
      const dateValue = attributes[gisConfig.fieldMappings.zoningEffectiveDate];
      // Convert ArcGIS timestamp (milliseconds) to ISO date string
      if (typeof dateValue === "number") {
        zoningData.zoning_effective_date = new Date(dateValue).toISOString().split("T")[0];
      } else {
        zoningData.zoning_effective_date = String(dateValue).trim();
      }
    }

    // Initialize arrays
    if (!zoningData.special_permit_types) {
      zoningData.special_permit_types = [];
    }
    if (!zoningData.overlay_districts) {
      zoningData.overlay_districts = [];
    }
    if (!zoningData.allowed_uses) {
      zoningData.allowed_uses = [];
    }

    if (
      gisConfig.fieldMappings.caseNumber &&
      attributes[gisConfig.fieldMappings.caseNumber]
    ) {
      const caseNum = String(attributes[gisConfig.fieldMappings.caseNumber]).trim();
      if (caseNum && caseNum !== "N/A") {
        zoningData.special_permit_types.push(`Planning Case: ${caseNum}`);
      }
    }

    if (
      gisConfig.fieldMappings.ordinanceNumber &&
      attributes[gisConfig.fieldMappings.ordinanceNumber]
    ) {
      const ordNum = String(attributes[gisConfig.fieldMappings.ordinanceNumber]).trim();
      if (ordNum && ordNum !== "N/A") {
        zoningData.special_permit_types.push(`Ordinance: ${ordNum}`);
      }
    }

    if (
      gisConfig.fieldMappings.overlayDistricts &&
      typeof gisConfig.fieldMappings.overlayDistricts === "string" &&
      attributes[gisConfig.fieldMappings.overlayDistricts]
    ) {
      const overlayValue = String(attributes[gisConfig.fieldMappings.overlayDistricts]).trim();
      if (overlayValue) {
        zoningData.overlay_districts.push(overlayValue);
      }
    } else if (Array.isArray(gisConfig.fieldMappings.overlayDistricts)) {
      // Handle multiple overlay fields (Fort Worth: PD, HISTORIC)
      gisConfig.fieldMappings.overlayDistricts.forEach((field) => {
        const val = attributes[field];
        if (val) {
          zoningData.overlay_districts!.push(String(val).trim());
        }
      });
    }

    if (
      gisConfig.fieldMappings.primaryUse &&
      attributes[gisConfig.fieldMappings.primaryUse]
    ) {
      const primaryUse = String(attributes[gisConfig.fieldMappings.primaryUse]).trim();
      if (primaryUse) {
        zoningData.allowed_uses.push(`Primary Use: ${primaryUse}`);
      }
    }

    // City-specific fields
    if (
      gisConfig.fieldMappings.shortTermRentals &&
      attributes[gisConfig.fieldMappings.shortTermRentals]
    ) {
      const strStatus = String(attributes[gisConfig.fieldMappings.shortTermRentals]).trim();
      if (strStatus) {
        zoningData.special_permit_types.push(`Short-Term Rentals: ${strStatus}`);
      }
    }

    if (
      gisConfig.fieldMappings.residentialDensityType &&
      attributes[gisConfig.fieldMappings.residentialDensityType]
    ) {
      const densityType = String(attributes[gisConfig.fieldMappings.residentialDensityType]).trim();
      const densityMap: Record<string, string> = {
        "B": "Both Multi-Family & Single-Family",
        "M": "Multi-Family Only",
        "N": "No Residential",
        "S": "Single-Family Only",
      };
      if (densityType && densityMap[densityType]) {
        zoningData.zoning_classification = zoningData.zoning_classification
          ? `${zoningData.zoning_classification} (${densityMap[densityType]})`
          : densityMap[densityType];
      }
    }

    if (
      gisConfig.fieldMappings.councilDistrict &&
      attributes[gisConfig.fieldMappings.councilDistrict]
    ) {
      const councilDist = String(attributes[gisConfig.fieldMappings.councilDistrict]).trim();
      if (councilDist) {
        zoningData.special_permit_types.push(`Council District: ${councilDist}`);
      }
    }

    // Clean up empty arrays
    if (zoningData.special_permit_types?.length === 0) {
      delete zoningData.special_permit_types;
    }
    if (zoningData.overlay_districts?.length === 0) {
      delete zoningData.overlay_districts;
    }
    if (zoningData.allowed_uses?.length === 0) {
      delete zoningData.allowed_uses;
    }

    // Check if we got meaningful data
    if (!zoningData.zoning_code && !zoningData.zoning_classification) {
      return {
        success: false,
        error: "GIS API returned data but no zoning code/classification found",
      };
    }

    console.log(`     ✓ GIS API success: ${zoningData.zoning_code || "N/A"}`);

    return {
      success: true,
      zoningData,
    };
  } catch (error: any) {
    return {
      success: false,
      error: `GIS API error: ${error.message}`,
    };
  }
}

/**
 * Execute an async operation with timeout and progress logging
 */
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  progressMessage: string,
  progressIntervalMs: number = PROGRESS_LOG_INTERVAL_MS,
): Promise<T> {
  const startTime = Date.now();
  let progressInterval: NodeJS.Timeout | null = null;

  // Set up periodic progress logging
  progressInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    console.log(`     ⏳ Still ${progressMessage}... (${elapsed}s elapsed)`);
  }, progressIntervalMs);

  // Race between the actual promise and a timeout
  const timeoutPromise = new Promise<T>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Operation timed out after ${timeoutMs / 1000}s`));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    console.log(
      `     ✓ ${progressMessage.replace("searching", "search complete")} (took ${elapsed}s)`,
    );
    return result;
  } finally {
    // Clean up the progress interval
    if (progressInterval) {
      clearInterval(progressInterval);
    }
  }
}

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
    processedPlaceIds: [],
    lastProcessedIndex: -1,
    apiCallsUsed: 0,
    totalCost: 0,
    lastUpdated: new Date().toISOString(),
    errors: [],
  };
}

function saveProgress(progress: ProgressState) {
  progress.lastUpdated = new Date().toISOString();
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

/**
 * Load facilities from database that need zoning enrichment
 */
async function loadFacilitiesFromDatabase(): Promise<FacilityToEnrich[]> {
  console.log("📂 Querying facilities from database...");

  // Try using the get_facilities_with_coords RPC function
  const { data: facilities, error } = await supabaseAdmin.rpc(
    "get_facilities_with_coords",
    {
      row_limit: 10000,
      include_hidden: false,
      include_cleaned_up: true,
    },
  );

  // Fallback: If the RPC doesn't exist, try raw query
  if (error && (error.code === 'PGRST202' || (error.message?.includes("function") && (error.message?.includes("does not exist") || error.message?.includes("Could not find"))))) {
    console.log("ℹ️  RPC function not found, using direct coordinate extraction...");

    // Use PostGIS functions to extract coordinates directly
    const { data: rawData, error: rawError } = await supabaseAdmin
      .from("sports_facilities")
      .select("place_id, name, address, ST_Y(location)::float as lat, ST_X(location)::float as lng")
      .eq("serp_scraped", true)
      .not(
        "place_id",
        "in",
        `(SELECT place_id FROM sports_facilities_zoning)`,
      );

    if (rawError) {
      console.error("❌ Database error:", rawError);
      process.exit(1);
    }

    if (!rawData || rawData.length === 0) {
      console.log("✅ All facilities already have zoning data!");
      process.exit(0);
    }

    // Parse location field with better logging
    const allFacilities = rawData
      .map((f: any) => {
        // Debug: Log the first location to see its format
        if (rawData.indexOf(f) === 0) {
          console.log("🔍 Debug - First location field format:", f.location);
          console.log("🔍 Debug - First location type:", typeof f.location);
        }

        // Try to extract lat/lng from various PostGIS formats
        let lng = 0;
        let lat = 0;

        if (typeof f.location === "string") {
          // Try WKT: POINT(lng lat)
          const wktMatch = f.location.match(/POINT\s*\(\s*([+-]?\d+\.?\d*)\s+([+-]?\d+\.?\d*)\s*\)/i);
          if (wktMatch) {
            lng = parseFloat(wktMatch[1]);
            lat = parseFloat(wktMatch[2]);
          }
        } else if (typeof f.location === "object" && f.location !== null) {
          // GeoJSON format
          if (f.location.coordinates && Array.isArray(f.location.coordinates)) {
            lng = f.location.coordinates[0];
            lat = f.location.coordinates[1];
          }
        }

        // Extract city from address
        const addressParts = f.address.split(",").map((s: string) => s.trim());
        const city = addressParts[1]?.toLowerCase();

        return {
          place_id: f.place_id,
          name: f.name,
          address: f.address,
          lat,
          lng,
          city,
          county: undefined,
        };
      })
      .filter((f) => {
        // Filter out facilities with invalid coordinates
        const isValid = f.lat !== 0 && f.lng !== 0 &&
                       f.lat >= 25 && f.lat <= 37 && // Texas latitude range
                       f.lng >= -107 && f.lng <= -93; // Texas longitude range
        if (!isValid && (f.lat !== 0 || f.lng !== 0)) {
          console.log(`⚠️  Skipping ${f.name}: Invalid coordinates (${f.lat}, ${f.lng})`);
        }
        return isValid;
      });

    console.log(
      `✅ Loaded ${allFacilities.length} facilities needing zoning data (${rawData.length - allFacilities.length} skipped due to invalid coordinates)`,
    );

    // Show first valid facility coordinates for verification
    if (allFacilities.length > 0) {
      console.log(`✓ Sample: ${allFacilities[0].name} at (${allFacilities[0].lat}, ${allFacilities[0].lng})`);
    }

    return allFacilities;
  }

  if (error) {
    console.error("❌ Database error:", error);
    process.exit(1);
  }

  if (!facilities || facilities.length === 0) {
    console.log("✅ All facilities already have zoning data!");
    process.exit(0);
  }

  const allFacilities = facilities
    .map((f: any) => {
      // Extract city from address: "123 Street, City, State ZIP"
      const addressParts = f.address?.split(",").map((s: string) => s.trim()) || [];
      const city = addressParts.length >= 2 ? addressParts[1]?.toLowerCase() : undefined;

      return {
        place_id: f.place_id,
        name: f.name,
        address: f.address,
        lat: f.lat,
        lng: f.lng,
        city,
        county: undefined,
      };
    })
    .filter((f: FacilityToEnrich) => {
      const isValid = f.lat !== 0 && f.lng !== 0;
      if (!isValid) {
        console.log(`⚠️  Skipping ${f.name}: Invalid coordinates (0, 0)`);
      }
      return isValid;
    });

  console.log(
    `✅ Loaded ${allFacilities.length} facilities needing zoning data`,
  );

  // Debug: Show sample facility data
  if (allFacilities.length > 0) {
    const sample = allFacilities[0];
    console.log(`🔍 Debug - Sample facility:`, {
      name: sample.name,
      city: sample.city,
      address: sample.address?.substring(0, 100),
      lat: sample.lat,
      lng: sample.lng,
    });
    console.log(`🔍 Debug - SUPPORTED_CITIES:`, SUPPORTED_CITIES);
  }

  // Filter to supported cities if enabled
  let filtered = allFacilities;

  if (FILTER_TO_SUPPORTED_CITIES) {
    filtered = allFacilities.filter(
      (f) => f.city && SUPPORTED_CITIES.includes(f.city),
    );

    console.log(
      `🏙️  Filtered to ${filtered.length} facilities in supported cities`,
    );
    console.log(
      `   Skipping ${allFacilities.length - filtered.length} facilities in unsupported cities`,
    );
  }

  // Further filter to GIS API cities only if enabled
  if (GIS_API_ONLY_MODE) {
    const gisApiCities = Object.keys(CITY_GIS_APIS);
    const beforeGisFilter = filtered.length;
    filtered = filtered.filter(
      (f) => f.city && gisApiCities.includes(f.city.toLowerCase()),
    );

    console.log(
      `🗺️  GIS API ONLY MODE: Filtered to ${filtered.length} facilities in ${gisApiCities.length} GIS API cities`,
    );
    console.log(
      `   Skipping ${beforeGisFilter - filtered.length} facilities in cities without GIS APIs (Plano)`,
    );
  }

  // Show city breakdown
  const cityBreakdown: Record<string, number> = {};
  filtered.forEach((f) => {
    if (f.city) {
      cityBreakdown[f.city] = (cityBreakdown[f.city] || 0) + 1;
    }
  });

  console.log("\n📊 City Distribution:");
  Object.entries(cityBreakdown)
    .sort((a, b) => b[1] - a[1])
    .forEach(([city, count]) => {
      const hasGisApi = CITY_GIS_APIS[city] !== undefined;
      const apiIndicator = hasGisApi ? "🗺️  GIS API" : "🌐 Web Search";
      console.log(`   ${city}: ${count} facilities ${apiIndicator}`);
    });
  console.log("");

  return filtered;
}

/**
 * Extract city name from address for zoning portal lookup
 */
function extractCityFromAddress(address: string): string | null {
  const parts = address.split(",").map((s) => s.trim());
  if (parts.length < 2) return null;
  return parts[1].toLowerCase();
}

/**
 * Search for zoning information using OpenAI Responses API with web search
 */
async function searchZoningData(
  facility: FacilityToEnrich,
  retryCount = 0,
): Promise<{
  success: boolean;
  zoningData?: ZoningData;
  confidence?: "high" | "medium" | "low";
  dataSource?: string;
  sources?: string[];
  error?: string;
  apiCallsUsed: number;
  cost: number;
}> {
  let apiCallsUsed = 0;
  let cost = 0;

  try {
    const city = extractCityFromAddress(facility.address);

    if (!city) {
      return {
        success: false,
        error: "Could not extract city from address",
        apiCallsUsed: 0,
        cost: 0,
      };
    }

    // STRATEGY 1: Try GIS API first (fast, free, reliable)
    const hasGisApi = CITY_GIS_APIS[city.toLowerCase()] !== undefined;
    if (hasGisApi) {
      console.log(`     🗺️  Trying GIS API first...`);
      const gisResult = await queryGisZoning(
        facility.lat,
        facility.lng,
        city,
      );

      if (gisResult.success && gisResult.zoningData) {
        // GIS API succeeded! Return immediately
        const zoningData = gisResult.zoningData as ZoningData;

        // Determine confidence based on data completeness
        let confidence: "high" | "medium" | "low" = "high"; // GIS data is official, so default high
        if (!zoningData.zoning_code && !zoningData.zoning_classification) {
          confidence = "low";
        } else if (!zoningData.zoning_code || !zoningData.zoning_classification) {
          confidence = "medium";
        }

        return {
          success: true,
          zoningData,
          confidence,
          dataSource: `${city}_gis_api`,
          sources: [CITY_GIS_APIS[city.toLowerCase()].baseUrl],
          apiCallsUsed: 0, // GIS API is free
          cost: 0, // No cost for GIS API
        };
      } else {
        // GIS API failed - return error immediately (web search commented out for debugging)
        console.log(`     ❌ GIS API failed: ${gisResult.error}`);
        return {
          success: false,
          error: `GIS API failed: ${gisResult.error}`,
          apiCallsUsed: 0,
          cost: 0,
        };
      }
    } else {
      console.log(`     ❌ No GIS API configured for ${city}`);
      return {
        success: false,
        error: `No GIS API configured for ${city}`,
        apiCallsUsed: 0,
        cost: 0,
      };
    }

    // STRATEGY 2: Fall back to OpenAI web search (COMMENTED OUT FOR GIS DEBUGGING)
    /*
    console.log(`     🔍 Searching web for zoning data...`);
    console.log(
      `     💡 This may take 2-5 minutes for comprehensive searches...`,
    );

    // Use OpenAI Responses API with web search (with timeout)
    const response = await withTimeout(
      openai.responses.create({
        model: "gpt-4o",
        tools: [
          {
            type: "web_search",
            filters: {
              allowed_domains: ALLOWED_DOMAINS,
            },
            user_location: {
              type: "approximate",
              country: "US",
              region: "Texas",
              city: city,
            },
          },
        ],
        tool_choice: "auto",
        include: ["web_search_call.action.sources"],
        input: `Search for comprehensive zoning information for this sports/recreation facility in ${city}, Texas:

Address: ${facility.address}
Facility Name: ${facility.name}

SEARCH FOCUS: This is a sports/recreation facility. Look for:
- Official city/county zoning maps, GIS portals, zoning ordinances
- Sports facility-specific regulations (noise, lighting, hours, occupancy)
- Buffer zones from residential areas
- Special use permits or conditional use requirements
- Parking, green space, and impervious surface requirements

EXTRACTION RULES:
1. Extract BOTH descriptive strings AND numeric values (e.g., "45 feet" → string "45 feet" + number 45)
2. For setbacks, find separate front/side/rear values if possible
3. Look for sports facility-specific restrictions (operating hours, noise limits, lighting curfews)
4. Find buffer requirements from residential zones
5. Look for special permits needed for sports facilities
6. Include the primary official source URL

Return JSON with this EXACT structure (use null for unavailable fields):
{
  "source_url": "string (primary official source URL)",
  "zoning_classification": "string (Commercial, Residential, Industrial, Mixed Use, etc.)",
  "zoning_code": "string (e.g., C-2, GB1, PD-SP)",
  "zoning_description": "string (what this zoning allows)",
  "zoning_district": "string (district name)",
  "zoning_effective_date": "string (date when zoning was established, format: YYYY-MM-DD)",

  "allowed_uses": ["array of allowed uses"],
  "prohibited_uses": ["array of prohibited uses"],

  "height_limit": "string (e.g., '45 feet or 3 stories')",
  "height_limit_ft": number or null (just the number, e.g., 45),

  "setback_requirements": "string (full description)",
  "setback_front_ft": number or null,
  "setback_side_ft": number or null,
  "setback_rear_ft": number or null,

  "lot_coverage": "string (e.g., '40% maximum')",
  "lot_coverage_max_pct": number or null (just the percentage),
  "building_coverage_max_pct": number or null (building footprint only, if different from lot coverage),

  "floor_area_ratio": number or null (e.g., 0.75, 2.5),

  "parking_requirements": "string (full description)",
  "parking_ratio": "string (e.g., '1 space per 300 sq ft')",
  "parking_spaces_required": number or null (minimum spaces if specific number given),

  "impervious_surface_max_pct": number or null (maximum impervious surface percentage),
  "required_green_space_pct": number or null (minimum green space/open space percentage),

  "operating_hours_restrictions": "string or null (e.g., 'No outdoor events after 10pm on weekdays', 'Games must end by 11pm')",
  "noise_restrictions": "string or null (e.g., '65 dB limit at property line', 'Quiet hours 10pm-7am')",
  "outdoor_lighting_restrictions": "string or null (e.g., 'Lights off by 10pm', 'Max 0.5 foot-candles at property line', 'Field lights must have shields')",
  "maximum_occupancy": number or null (facility capacity limit),

  "buffer_requirements": "string or null (e.g., '50 ft landscaped buffer from residential', 'Minimum 100 ft from R-1 zones')",
  "signage_restrictions": "string or null (size, illumination, placement limits for scoreboards/signs)",
  "accessory_structures_allowed": ["array of allowed accessory structures like bleachers, concession stands, scoreboards"] or null,

  "special_permits_required": boolean or null (general special permit requirement),
  "special_permit_types": ["array of specific permit types needed"] or null,
  "conditional_use_permit_required": boolean or null (CUP specifically required),
  "temporary_use_permit_info": "string or null (info about temporary event permits, tournaments)",

  "overlay_districts": ["array of overlay districts"] or null,
  "development_standards": {"key": "value"} or null (structured special standards),
  "future_land_use_designation": "string or null (from comprehensive plan)",

  "sports_facility_specific_notes": "string or null (any other sports-specific regulations)",
  "minimum_lot_size_sqft": number or null (minimum lot size in sq ft),
  "maximum_density": "string or null"
}

ERROR HANDLING:
- If you find NO zoning information at all, return: {"error": "No zoning information found"}
- Otherwise, return as many fields as possible, using null for unavailable data
- IMPORTANT: For sports facilities, prioritize finding: operating hours, noise limits, lighting restrictions, and buffer requirements`,
      }),
      OPENAI_TIMEOUT_MS,
      "searching",
    );

    apiCallsUsed++;

    // Calculate cost (estimated - web search tool + model usage)
    // Web search tool: ~$0.01-0.03 per search
    // GPT-4o: $2.50/1M input, $10.00/1M output tokens
    const usage = (response as any).usage;
    if (usage) {
      const inputTokens = usage.prompt_tokens || 0;
      const outputTokens = usage.completion_tokens || 0;
      cost =
        (inputTokens / 1000000) * 2.5 + (outputTokens / 1000000) * 10.0 + 0.02; // Add web search cost
    } else {
      cost = 0.03; // Fallback estimate
    }

    // Extract the message content
    const outputItems = (response as any).output || [];
    let messageContent = "";
    let sources: string[] = [];

    for (const item of outputItems) {
      if (item.type === "message" && item.content) {
        for (const contentPart of item.content) {
          if (
            contentPart.type === "output_text" ||
            contentPart.type === "text"
          ) {
            messageContent += contentPart.text || "";
          }
        }
      }
      if (item.type === "web_search_call" && item.action?.sources) {
        sources = item.action.sources.map((s: any) => s.url || s);
      }
    }

    if (!messageContent) {
      return {
        success: false,
        error: "Empty response from OpenAI",
        apiCallsUsed,
        cost,
      };
    }

    console.log(`     📊 Found ${sources.length} sources`);
    if (sources.length > 30) {
      console.log(
        `     ⚠️  High source count may indicate slow search (consider reducing ALLOWED_DOMAINS)`,
      );
    }
    if (sources.length > 0) {
      console.log(`     🔗 Top source: ${sources[0]}`);
    }

    // Parse JSON response
    let zoningData: any;
    try {
      // Try to extract JSON from the response
      const jsonMatch = messageContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        zoningData = JSON.parse(jsonMatch[0]);
      } else {
        return {
          success: false,
          error: "Could not find JSON in response",
          apiCallsUsed,
          cost,
        };
      }
    } catch (parseError) {
      console.log(`     ⚠️  Failed to parse JSON from response`);
      return {
        success: false,
        error: "Could not parse OpenAI response as JSON",
        apiCallsUsed,
        cost,
      };
    }

    // Check if OpenAI found zoning information
    if (zoningData.error) {
      return {
        success: false,
        error: zoningData.error,
        sources,
        apiCallsUsed,
        cost,
      };
    }

    // Determine confidence level based on:
    // 1. How much data we got
    // 2. Quality of sources (official city/county sites = higher confidence)
    let confidence: "high" | "medium" | "low" = "low";
    const fieldCount = Object.keys(zoningData).length;
    const hasOfficialSource = sources.some(
      (url) =>
        url.includes(".gov") || url.includes("city") || url.includes("county"),
    );

    if (fieldCount >= 6 && zoningData.zoning_code && hasOfficialSource) {
      confidence = "high";
    } else if (
      fieldCount >= 3 &&
      (zoningData.zoning_code || zoningData.zoning_classification)
    ) {
      confidence = "medium";
    }

    return {
      success: true,
      zoningData,
      confidence,
      dataSource: `${city}_web_search`,
      sources,
      apiCallsUsed,
      cost,
    };
    */
    // END OF COMMENTED OUT WEB SEARCH CODE
  } catch (error: any) {
    const errorMessage = error.message || "Unknown error";
    console.log(`     ⚠️  Error: ${errorMessage}`);

    // Don't retry on timeout errors (they'll just timeout again)
    const isTimeout = errorMessage.includes("timed out");
    if (isTimeout) {
      console.log(
        `     💡 Timeout occurred - try reducing ALLOWED_DOMAINS or increasing OPENAI_TIMEOUT_MS`,
      );
      return {
        success: false,
        error: `Search timed out after ${OPENAI_TIMEOUT_MS / 1000}s`,
        apiCallsUsed,
        cost,
      };
    }

    // Retry logic for other errors
    if (retryCount < MAX_RETRIES) {
      console.log(`     🔄 Retrying (${retryCount + 1}/${MAX_RETRIES})...`);
      await delay(RETRY_DELAY_MS);
      return searchZoningData(facility, retryCount + 1);
    }

    return {
      success: false,
      error: errorMessage,
      apiCallsUsed,
      cost,
    };
  }
}

/**
 * Insert zoning data into sports_facilities_zoning table
 */
async function insertZoningData(
  placeId: string,
  zoningData: ZoningData,
  confidence: string,
  dataSource: string,
  sources: string[],
): Promise<boolean> {
  try {
    // Use the first source as primary source URL, or the source_url from the data
    const primarySourceUrl =
      zoningData.source_url || (sources.length > 0 ? sources[0] : null);

    const { error } = await supabaseAdmin
      .from("sports_facilities_zoning")
      .insert({
        place_id: placeId,

        // Core zoning info
        zoning_classification: zoningData.zoning_classification,
        zoning_code: zoningData.zoning_code,
        zoning_description: zoningData.zoning_description,
        zoning_district: zoningData.zoning_district,

        // Metadata
        data_source: dataSource,
        source_url: primarySourceUrl,
        confidence_level: confidence,
        raw_response: { sources, zoning_data: zoningData },

        // Use arrays
        allowed_uses: zoningData.allowed_uses,
        prohibited_uses: zoningData.prohibited_uses,

        // Height limits (string and numeric)
        height_limit: zoningData.height_limit,
        height_limit_ft: zoningData.height_limit_ft,

        // Setbacks (string and numeric)
        setback_requirements: zoningData.setback_requirements,
        setback_front_ft: zoningData.setback_front_ft,
        setback_side_ft: zoningData.setback_side_ft,
        setback_rear_ft: zoningData.setback_rear_ft,

        // Lot coverage (string and numeric)
        lot_coverage: zoningData.lot_coverage,
        lot_coverage_max_pct: zoningData.lot_coverage_max_pct,
        building_coverage_max_pct: zoningData.building_coverage_max_pct,

        // Floor area ratio
        floor_area_ratio: zoningData.floor_area_ratio,

        // Parking requirements
        parking_requirements: zoningData.parking_requirements,
        parking_ratio: zoningData.parking_ratio,
        parking_spaces_required: zoningData.parking_spaces_required,

        // Sports facility operational restrictions
        operating_hours_restrictions: zoningData.operating_hours_restrictions,
        noise_restrictions: zoningData.noise_restrictions,
        outdoor_lighting_restrictions: zoningData.outdoor_lighting_restrictions,
        maximum_occupancy: zoningData.maximum_occupancy,

        // Physical requirements
        impervious_surface_max_pct: zoningData.impervious_surface_max_pct,
        required_green_space_pct: zoningData.required_green_space_pct,
        buffer_requirements: zoningData.buffer_requirements,

        // Permit and use information
        special_permits_required: zoningData.special_permits_required,
        special_permit_types: zoningData.special_permit_types,
        conditional_use_permit_required:
          zoningData.conditional_use_permit_required,
        temporary_use_permit_info: zoningData.temporary_use_permit_info,
        signage_restrictions: zoningData.signage_restrictions,
        accessory_structures_allowed: zoningData.accessory_structures_allowed,

        // Additional context
        overlay_districts: zoningData.overlay_districts,
        development_standards: zoningData.development_standards,
        sports_facility_specific_notes:
          zoningData.sports_facility_specific_notes,
        minimum_lot_size_sqft: zoningData.minimum_lot_size_sqft,
        maximum_density: zoningData.maximum_density,
        zoning_effective_date: zoningData.zoning_effective_date,
        future_land_use_designation: zoningData.future_land_use_designation,
      });

    if (error) {
      console.error(`     ⚠️  Database error: ${error.message}`);
      return false;
    }

    return true;
  } catch (error: any) {
    console.error(`     ⚠️  Error inserting zoning data: ${error.message}`);
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
  console.log(`   Address: ${facility.address}`);
  console.log(`   Place ID: ${facility.place_id}`);

  // Check if already processed
  if (progress.processedPlaceIds.includes(facility.place_id)) {
    console.log(`   ⏭️  Already processed, skipping...`);
    progress.skippedCount++;
    return;
  }

  // Search for zoning data using web search
  console.log(`   🔍 Searching for zoning data...`);
  const result = await searchZoningData(facility);

  progress.apiCallsUsed += result.apiCallsUsed;
  progress.totalCost += result.cost;

  if (!result.success) {
    console.log(`   ❌ Failed: ${result.error}`);
    if (result.sources && result.sources.length > 0) {
      console.log(`     Sources checked: ${result.sources.length}`);
    }
    progress.failedCount++;
    progress.errors.push({
      place_id: facility.place_id,
      name: facility.name,
      error: result.error || "Unknown error",
      timestamp: new Date().toISOString(),
    });
    progress.processedPlaceIds.push(facility.place_id);
    progress.processedCount++;
    progress.lastProcessedIndex = index;
    return;
  }

  console.log(`   ✓ Zoning data found!`);
  const dataMethod = result.dataSource?.includes("gis_api") ? "GIS API" : "Web Search";
  console.log(`     Source: ${dataMethod} (${result.dataSource})`);
  console.log(`     Code: ${result.zoningData?.zoning_code || "N/A"}`);
  console.log(
    `     Classification: ${result.zoningData?.zoning_classification || "N/A"}`,
  );

  // Physical requirements
  if (result.zoningData?.height_limit_ft) {
    console.log(`     Height Limit: ${result.zoningData.height_limit_ft} ft`);
  }
  if (
    result.zoningData?.setback_front_ft ||
    result.zoningData?.setback_side_ft
  ) {
    console.log(
      `     Setbacks: Front ${result.zoningData.setback_front_ft || "?"} ft, Side ${result.zoningData.setback_side_ft || "?"} ft`,
    );
  }

  // Sports-specific restrictions
  if (result.zoningData?.operating_hours_restrictions) {
    console.log(
      `     Hours: ${result.zoningData.operating_hours_restrictions.substring(0, 50)}${result.zoningData.operating_hours_restrictions.length > 50 ? "..." : ""}`,
    );
  }
  if (result.zoningData?.noise_restrictions) {
    console.log(
      `     Noise: ${result.zoningData.noise_restrictions.substring(0, 50)}${result.zoningData.noise_restrictions.length > 50 ? "..." : ""}`,
    );
  }
  if (result.zoningData?.outdoor_lighting_restrictions) {
    console.log(
      `     Lighting: ${result.zoningData.outdoor_lighting_restrictions.substring(0, 50)}${result.zoningData.outdoor_lighting_restrictions.length > 50 ? "..." : ""}`,
    );
  }
  if (result.zoningData?.maximum_occupancy) {
    console.log(`     Max Occupancy: ${result.zoningData.maximum_occupancy}`);
  }

  // Permits
  if (result.zoningData?.conditional_use_permit_required) {
    console.log(`     CUP Required: Yes`);
  }

  console.log(`     Confidence: ${result.confidence}`);
  console.log(`     Sources: ${result.sources?.length || 0}`);
  console.log(`     Cost: $${result.cost.toFixed(4)}`);

  // Insert into database
  console.log(`   💾 Saving to database...`);
  const inserted = await insertZoningData(
    facility.place_id,
    result.zoningData!,
    result.confidence!,
    result.dataSource!,
    result.sources || [],
  );

  if (inserted) {
    console.log(`   ✅ Success!`);
    progress.successCount++;
  } else {
    console.log(`   ❌ Failed to save to database`);
    progress.failedCount++;
    progress.errors.push({
      place_id: facility.place_id,
      name: facility.name,
      error: "Database insert failed",
      timestamp: new Date().toISOString(),
    });
  }

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
  console.log(`   Remaining: ${remaining}`);
  console.log(`   API Calls Used: ${progress.apiCallsUsed}`);
  console.log(`   Total Cost: $${progress.totalCost.toFixed(2)}`);
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
  console.log("🚀 Zoning Web Search Enrichment Script");
  console.log("=".repeat(70));

  if (TEST_LIMIT) {
    console.log(`🧪 TEST MODE: Processing only ${TEST_LIMIT} facilities`);
    console.log("   (Set TEST_LIMIT to null in the script to process all)");
  }

  if (FILTER_TO_SUPPORTED_CITIES) {
    console.log(
      `🏙️  FILTER MODE: Only processing facilities in ${SUPPORTED_CITIES.length} supported cities`,
    );
    console.log(`   Cities: ${SUPPORTED_CITIES.join(", ")}`);
    console.log(
      "   (Set FILTER_TO_SUPPORTED_CITIES to false to process all cities)",
    );
  }

  if (GIS_API_ONLY_MODE) {
    const gisApiCities = Object.keys(CITY_GIS_APIS);
    console.log(
      `🗺️  GIS API ONLY MODE: Processing only cities with GIS APIs (${gisApiCities.length} cities)`,
    );
    console.log(`   GIS API cities: ${gisApiCities.join(", ")}`);
    console.log("   This ensures 100% fast, FREE GIS API calls (no web searches)");
    console.log(
      "   (Set GIS_API_ONLY_MODE to false to include Plano with web search)",
    );
  }

  console.log("\n📋 This script will:");
  console.log("   • Load facilities that need zoning data from database");
  if (FILTER_TO_SUPPORTED_CITIES) {
    console.log(
      "   • Filter to only supported cities (avoid wasted API calls)",
    );
  }
  console.log("   • Try GIS REST API first (6 cities: fast, free, reliable)");
  console.log("   • Fall back to OpenAI web search if GIS unavailable/fails");
  console.log("   • Extract structured zoning codes and development standards");
  console.log("   • Store data with source citations for verification");
  console.log("   • Track progress for resumable operation");
  console.log("\n⚠️  Important:");
  console.log(
    `   • GIS API: FREE and instant for Dallas, Houston, Austin, San Antonio, Fort Worth, Arlington`,
  );
  console.log(
    `   • Web search: ~$${ESTIMATED_COST_PER_FACILITY.toFixed(3)} per facility (Plano or GIS fallback)`,
  );
  console.log("   • Rate limit: 1 request every 3 seconds (web search only)");
  console.log("   • Source tracking: URLs/APIs saved for verification");

  console.log("=".repeat(70) + "\n");

  // Load facilities (filtering happens inside this function)
  const allFacilities = await loadFacilitiesFromDatabase();

  // Load progress
  const progress = loadProgress();

  if (progress.processedCount > 0) {
    console.log("♻️  Resuming from previous session:");
    console.log(`   Last processed index: ${progress.lastProcessedIndex}`);
    console.log(
      `   Processed: ${progress.processedCount}/${allFacilities.length}`,
    );
    console.log(`   API calls used: ${progress.apiCallsUsed}`);
    console.log(`   Total cost: $${progress.totalCost.toFixed(2)}\n`);
  }

  // Determine how many facilities to process
  const totalToProcess = TEST_LIMIT
    ? Math.min(TEST_LIMIT, allFacilities.length)
    : allFacilities.length;

  const facilities = allFacilities.slice(0, totalToProcess);

  console.log(`📍 Will process ${facilities.length} facilities\n`);

  const startTime = Date.now();

  // Process each facility
  for (let i = progress.lastProcessedIndex + 1; i < facilities.length; i++) {
    const facility = facilities[i];

    await processFacility(facility, progress, i, facilities.length);

    // Save progress after each facility
    saveProgress(progress);

    // Print summary every 10 facilities in test mode, 50 in production
    const summaryInterval = TEST_LIMIT ? 10 : 50;
    if ((i + 1) % summaryInterval === 0) {
      printProgressSummary(progress, facilities.length, startTime);
    }

    // Rate limiting delay
    if (i < facilities.length - 1) {
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
  console.log(`   API Calls Used: ${progress.apiCallsUsed}`);
  console.log(`   Total Cost: $${progress.totalCost.toFixed(2)}`);
  console.log(
    `   Success Rate: ${((progress.successCount / (progress.processedCount || 1)) * 100).toFixed(1)}%`,
  );
  console.log(
    `   Total Time: ${((Date.now() - startTime) / 1000 / 60).toFixed(1)} minutes`,
  );

  if (progress.errors.length > 0) {
    console.log(`\n⚠️  Errors (${progress.errors.length}):`);
    progress.errors.slice(0, 10).forEach((error, index) => {
      console.log(`   ${index + 1}. ${error.name}: ${error.error}`);
    });
    if (progress.errors.length > 10) {
      console.log(`   ... and ${progress.errors.length - 10} more`);
    }
    console.log(`   Full error log saved in: ${PROGRESS_FILE}`);
  }

  console.log("\n✅ Zoning enrichment complete!");
  console.log("=".repeat(70));
}

enrichWithZoning().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
