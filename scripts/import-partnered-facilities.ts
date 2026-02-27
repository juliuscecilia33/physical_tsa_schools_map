import { Client } from "@googlemaps/google-maps-services-js";
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import { parse } from "csv-parse/sync";

// Load environment variables
dotenv.config({ path: path.join(__dirname, "../.env.local") });

const client = new Client({});
const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY!;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!GOOGLE_API_KEY || !supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Error: Missing required environment variables");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ===== CONSTANTS =====
const CSV_PATH = path.join(
  __dirname,
  "../public/TSA – Master Facility Tracker - Facility_Master.csv",
);
const PROGRESS_FILE = path.join(
  __dirname,
  "../.import-partnered-facilities-progress.json",
);
const DRY_RUN_REPORT_FILE = path.join(
  __dirname,
  "../dry-run-matches.csv",
);
const UNMATCHED_REPORT_FILE = path.join(
  __dirname,
  "../unmatched-facilities.csv",
);
const SUMMARY_FILE = path.join(
  __dirname,
  "../import-summary.json",
);

const PARTNERSHIP_ACTIVE_TAG_ID = "9482dd4a-e7c1-4b90-8bb6-31df7bdb10e4";
const NAME_SIMILARITY_THRESHOLD = 0.7;
const HIGH_CONFIDENCE_THRESHOLD = 0.85;

// ===== TYPES =====
interface CSVRow {
  "Facility ID": string;
  "Facility Name": string;
  "Owner / Contact": string;
  Phone: string;
  Email: string;
  "Full Address": string;
  City: string;
  "Primary Sport": string;
  "Provides Training (Y/N)": string;
  "Daytime Availability (Y/N)": string;
  "Homeschool Volume (Many/Few/None/Unknown)": string;
  "Estimated HS Families (#)": string;
  "Min. Est. Families": string;
  "Max. Est. Families": string;
  "Is Barcelona": string;
  "Network Size / Reach": string;
  Tier: string;
  "Assigned Rep": string;
  Status: string;
  "Last Contact Date": string;
  "Next Action Date": string;
  "Next Action Type": string;
  "Voucher Proof Emails (#)": string;
  "$75 Earned": string;
  "Payout Status": string;
  "SalesMessenger Link": string;
  Notes: string;
}

interface ParsedFacility {
  csvRowIndex: number;
  facilityName: string;
  fullAddress: string;
  city: string;
  phone: string;
  email: string;
  primarySport: string;
  ownerContact: string;
  homeschoolVolume: string;
  estimatedFamilies: string;
  tier: string;
  assignedRep: string;
  salesMessengerLink: string;
  notes: string;
}

interface GooglePlaceMatch {
  placeId: string;
  name: string;
  address: string;
  confidence: number;
  status: "high_confidence" | "low_confidence" | "no_match";
}

interface MatchResult {
  facility: ParsedFacility;
  match: GooglePlaceMatch | null;
}

interface ProgressState {
  processedFacilities: number;
  matchedFacilities: number;
  unmatchedFacilities: number;
  insertedFacilities: number;
  updatedFacilities: number;
  errors: number;
  lastUpdated: string;
}

interface SportMetadata {
  score: number;
  sources: Array<"csv_partner">;
  keywords_matched: string[];
  confidence: "high";
  matched_text: string;
}

// ===== HELPER FUNCTIONS =====
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function loadProgress(): ProgressState {
  if (fs.existsSync(PROGRESS_FILE)) {
    const data = fs.readFileSync(PROGRESS_FILE, "utf-8");
    return JSON.parse(data);
  }
  return {
    processedFacilities: 0,
    matchedFacilities: 0,
    unmatchedFacilities: 0,
    insertedFacilities: 0,
    updatedFacilities: 0,
    errors: 0,
    lastUpdated: new Date().toISOString(),
  };
}

function saveProgress(progress: ProgressState) {
  progress.lastUpdated = new Date().toISOString();
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

// Calculate Levenshtein distance for fuzzy string matching
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1,
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

// Calculate name similarity (0-1 score)
function calculateNameSimilarity(name1: string, name2: string): number {
  const normalized1 = name1.toLowerCase().trim().replace(/[^\w\s]/g, "");
  const normalized2 = name2.toLowerCase().trim().replace(/[^\w\s]/g, "");

  const distance = levenshteinDistance(normalized1, normalized2);
  const maxLength = Math.max(normalized1.length, normalized2.length);

  if (maxLength === 0) return 0;

  return 1 - distance / maxLength;
}

// Parse multi-location addresses
function parseLocations(csvRow: CSVRow): ParsedFacility[] {
  const facilities: ParsedFacility[] = [];
  const fullAddress = csvRow["Full Address"];
  const city = csvRow["City"];

  // Check if this is a multi-location facility
  const multiLocationMatch = fullAddress.match(/\((\d+)\s+locations?\)/i);

  if (multiLocationMatch) {
    // Multi-location facility - try to extract individual addresses
    // Split by common delimiters
    const addresses = fullAddress
      .replace(/\(\d+\s+locations?\)/gi, "")
      .split(/\s+and\s+|\s*,\s*(?=\d)|\.(?=\s+\d)/i)
      .map(addr => addr.trim())
      .filter(addr => addr.length > 0 && /\d/.test(addr));

    if (addresses.length > 0) {
      addresses.forEach((address) => {
        facilities.push({
          csvRowIndex: 0, // Will be set by caller
          facilityName: csvRow["Facility Name"],
          fullAddress: address,
          city: city.includes("locations") ? city.split(")")[1].trim() : city,
          phone: csvRow["Phone"],
          email: csvRow["Email"],
          primarySport: csvRow["Primary Sport"],
          ownerContact: csvRow["Owner / Contact"],
          homeschoolVolume: csvRow["Homeschool Volume (Many/Few/None/Unknown)"],
          estimatedFamilies: csvRow["Estimated HS Families (#)"],
          tier: csvRow["Tier"],
          assignedRep: csvRow["Assigned Rep"],
          salesMessengerLink: csvRow["SalesMessenger Link"],
          notes: csvRow["Notes"],
        });
      });
    } else {
      // Couldn't parse individual addresses, create single entry with full address
      facilities.push(createSingleFacility(csvRow));
    }
  } else {
    // Single location facility
    facilities.push(createSingleFacility(csvRow));
  }

  return facilities;
}

function createSingleFacility(csvRow: CSVRow): ParsedFacility {
  return {
    csvRowIndex: 0, // Will be set by caller
    facilityName: csvRow["Facility Name"],
    fullAddress: csvRow["Full Address"],
    city: csvRow["City"],
    phone: csvRow["Phone"],
    email: csvRow["Email"],
    primarySport: csvRow["Primary Sport"],
    ownerContact: csvRow["Owner / Contact"],
    homeschoolVolume: csvRow["Homeschool Volume (Many/Few/None/Unknown)"],
    estimatedFamilies: csvRow["Estimated HS Families (#)"],
    tier: csvRow["Tier"],
    assignedRep: csvRow["Assigned Rep"],
    salesMessengerLink: csvRow["SalesMessenger Link"],
    notes: csvRow["Notes"],
  };
}

// Parse sports from CSV Primary Sport column
function parseSportsFromCSV(primarySport: string): {
  identified_sports: string[];
  sport_metadata: Record<string, SportMetadata>;
} {
  if (!primarySport || primarySport.trim() === "") {
    return { identified_sports: [], sport_metadata: {} };
  }

  // Split by common delimiters: comma, slash, "and"
  const sportsList = primarySport
    .split(/[,\/]|\s+and\s+/i)
    .map(sport => sport.trim())
    .filter(sport => sport.length > 0);

  const identified_sports: string[] = [];
  const sport_metadata: Record<string, SportMetadata> = {};

  sportsList.forEach(sport => {
    // Clean up sport name
    const cleanSport = sport
      .replace(/\([^)]*\)/g, "") // Remove parentheses
      .trim();

    if (cleanSport.length > 0) {
      identified_sports.push(cleanSport);
      sport_metadata[cleanSport] = {
        score: 95, // High confidence from CSV partner data
        sources: ["csv_partner"],
        keywords_matched: [cleanSport.toLowerCase()],
        confidence: "high",
        matched_text: primarySport,
      };
    }
  });

  return { identified_sports, sport_metadata };
}

// Search Google Places for facility
async function searchGooglePlacesForFacility(
  facility: ParsedFacility,
): Promise<GooglePlaceMatch | null> {
  try {
    const query = `${facility.facilityName} ${facility.fullAddress}`;

    console.log(`  🔍 Searching: "${query}"`);

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
      console.log(`  ⚠️  Search status: ${response.data.status}`);
      return null;
    }

    if (!response.data.results || response.data.results.length === 0) {
      console.log(`  ❌ No results found`);
      return null;
    }

    // Filter results by city match
    const cityMatches = response.data.results.filter(place =>
      place.formatted_address?.toLowerCase().includes(facility.city.toLowerCase())
    );

    const resultsToCheck = cityMatches.length > 0 ? cityMatches : response.data.results;

    // Find best name match
    let bestMatch: GooglePlaceMatch | null = null;
    let bestSimilarity = 0;

    for (const place of resultsToCheck.slice(0, 5)) {
      if (!place.name || !place.place_id) continue;

      const similarity = calculateNameSimilarity(facility.facilityName, place.name);

      if (similarity > bestSimilarity && similarity >= NAME_SIMILARITY_THRESHOLD) {
        bestSimilarity = similarity;
        bestMatch = {
          placeId: place.place_id,
          name: place.name,
          address: place.formatted_address || "",
          confidence: similarity,
          status: similarity >= HIGH_CONFIDENCE_THRESHOLD ? "high_confidence" : "low_confidence",
        };
      }
    }

    if (bestMatch) {
      console.log(`  ✅ Match found: "${bestMatch.name}" (confidence: ${(bestMatch.confidence * 100).toFixed(0)}%)`);
    } else {
      console.log(`  ❌ No match above threshold (best: ${(bestSimilarity * 100).toFixed(0)}%)`);
    }

    return bestMatch;
  } catch (error: any) {
    console.error(`  ⚠️  Error searching:`, error.message);
    return null;
  }
}

// Fetch full place details from Google
async function fetchPlaceDetails(placeId: string): Promise<any | null> {
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
      return null;
    }

    return response.data.result;
  } catch (error: any) {
    console.error(`  ⚠️  Error fetching place details:`, error.message);
    return null;
  }
}

// Check if facility already exists in database
async function checkFacilityExists(placeId: string): Promise<boolean> {
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

// Assign Partnership Active tag to facility
async function assignPartnershipTag(placeId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("facility_tag_assignments")
      .insert({
        place_id: placeId,
        tag_id: PARTNERSHIP_ACTIVE_TAG_ID,
      });

    if (error) {
      // Check if it's a duplicate (unique constraint violation)
      if (error.code === "23505") {
        console.log(`  ℹ️  Partnership tag already assigned`);
        return true;
      }
      console.error(`  ⚠️  Error assigning tag: ${error.message}`);
      return false;
    }

    console.log(`  ✅ Partnership Active tag assigned`);
    return true;
  } catch (error: any) {
    console.error(`  ⚠️  Error assigning tag:`, error.message);
    return false;
  }
}

// Create facility note with CSV metadata
async function createFacilityNote(
  placeId: string,
  facility: ParsedFacility,
): Promise<boolean> {
  try {
    const noteLines: string[] = [];

    if (facility.ownerContact) {
      noteLines.push(`Owner/Contact: ${facility.ownerContact}`);
    }
    if (facility.tier) {
      noteLines.push(`Tier: ${facility.tier}`);
    }
    if (facility.homeschoolVolume) {
      noteLines.push(`Homeschool Volume: ${facility.homeschoolVolume}`);
    }
    if (facility.estimatedFamilies) {
      noteLines.push(`Estimated Families: ${facility.estimatedFamilies}`);
    }
    if (facility.assignedRep) {
      noteLines.push(`Assigned Rep: ${facility.assignedRep}`);
    }
    if (facility.salesMessengerLink) {
      noteLines.push(`SalesMessenger: ${facility.salesMessengerLink}`);
    }
    if (facility.notes) {
      noteLines.push(`Notes: ${facility.notes}`);
    }

    noteLines.push(`\n[Imported from CSV on ${new Date().toLocaleDateString()}]`);

    const noteText = noteLines.join("\n");

    const { error } = await supabase
      .from("facility_notes")
      .insert({
        place_id: placeId,
        note_text: noteText,
        assigned_photo: null,
      });

    if (error) {
      console.error(`  ⚠️  Error creating note: ${error.message}`);
      return false;
    }

    console.log(`  ✅ Facility note created`);
    return true;
  } catch (error: any) {
    console.error(`  ⚠️  Error creating note:`, error.message);
    return false;
  }
}

// Upsert facility to database
async function upsertFacility(
  placeDetails: any,
  facility: ParsedFacility,
  isUpdate: boolean,
): Promise<boolean> {
  try {
    const sportsData = parseSportsFromCSV(facility.primarySport);

    const facilityData = {
      place_id: placeDetails.place_id!,
      name: placeDetails.name || facility.facilityName,
      sport_types: placeDetails.types || [],
      identified_sports: sportsData.identified_sports,
      sport_metadata: sportsData.sport_metadata,
      address: placeDetails.formatted_address || facility.fullAddress,
      location: `POINT(${placeDetails.geometry?.location.lng || 0} ${
        placeDetails.geometry?.location.lat || 0
      })`,
      phone: facility.phone || placeDetails.formatted_phone_number,
      website: placeDetails.website,
      email: facility.email ? [facility.email] : [],
      email_scrape_attempted: true,
      email_scraped_at: new Date().toISOString(),
      rating: placeDetails.rating,
      user_ratings_total: placeDetails.user_ratings_total,
      reviews: placeDetails.reviews?.map((review: any) => ({
        author_name: review.author_name,
        rating: review.rating,
        text: review.text,
        time: review.time,
        relative_time_description: review.relative_time_description,
      })),
      photo_references: placeDetails.photos?.map((photo: any) => photo.photo_reference),
      opening_hours: placeDetails.opening_hours
        ? {
            open_now: placeDetails.opening_hours.open_now,
            weekday_text: placeDetails.opening_hours.weekday_text,
          }
        : null,
      business_status: placeDetails.business_status,
    };

    const { error } = await supabase
      .from("sports_facilities")
      .upsert(facilityData, { onConflict: "place_id" });

    if (error) {
      console.error(`  ⚠️  Error upserting facility: ${error.message}`);
      return false;
    }

    console.log(`  ✅ Facility ${isUpdate ? "updated" : "inserted"}`);
    return true;
  } catch (error: any) {
    console.error(`  ⚠️  Error upserting facility:`, error.message);
    return false;
  }
}

// ===== MAIN FUNCTIONS =====

// Dry-run mode: Generate matches report
async function runDryRun(limit?: number) {
  console.log("\n🔍 DRY-RUN MODE: Generating matches report\n");
  console.log("=" .repeat(80));

  // Parse CSV
  const csvContent = fs.readFileSync(CSV_PATH, "utf-8");
  const records: CSVRow[] = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
  });

  const totalRecords = limit ? Math.min(limit, records.length) : records.length;

  console.log(`\n📊 Loaded ${records.length} facilities from CSV`);
  if (limit) {
    console.log(`⚠️  Processing only first ${totalRecords} facilities\n`);
  } else {
    console.log();
  }

  const matchResults: MatchResult[] = [];
  let facilitiesProcessed = 0;

  for (let i = 0; i < totalRecords; i++) {
    const csvRow = records[i];

    // Skip rows without facility name or address
    if (!csvRow["Facility Name"] || !csvRow["Full Address"]) {
      continue;
    }

    const facilities = parseLocations(csvRow);

    for (const facility of facilities) {
      facility.csvRowIndex = i + 2; // +2 for header and 1-indexed
      facilitiesProcessed++;

      console.log(`\n[${facilitiesProcessed}/${totalRecords}] ${facility.facilityName}`);
      console.log(`  📍 ${facility.fullAddress}`);

      const match = await searchGooglePlacesForFacility(facility);

      matchResults.push({
        facility,
        match,
      });

      await delay(500); // Rate limiting
    }
  }

  // Generate CSV report
  const reportLines: string[] = [
    "CSV Row,Facility Name,CSV Address,CSV City,Matched Place ID,Matched Name,Matched Address,Confidence,Status",
  ];

  matchResults.forEach(result => {
    const { facility, match } = result;
    reportLines.push(
      `${result.facility.csvRowIndex},"${facility.facilityName}","${facility.fullAddress}","${facility.city}",` +
      `"${match?.placeId || ""}","${match?.name || "NO MATCH"}","${match?.address || ""}",` +
      `"${match ? (match.confidence * 100).toFixed(0) + "%" : "0%"}","${match?.status || "no_match"}"`,
    );
  });

  fs.writeFileSync(DRY_RUN_REPORT_FILE, reportLines.join("\n"));

  // Generate summary
  const totalMatched = matchResults.filter(r => r.match !== null).length;
  const highConfidence = matchResults.filter(r => r.match?.status === "high_confidence").length;
  const lowConfidence = matchResults.filter(r => r.match?.status === "low_confidence").length;
  const noMatch = matchResults.filter(r => r.match === null).length;

  console.log("\n" + "=".repeat(80));
  console.log("\n📊 DRY-RUN SUMMARY\n");
  console.log(`Total facilities processed: ${facilitiesProcessed}`);
  console.log(`Matched: ${totalMatched} (${((totalMatched / facilitiesProcessed) * 100).toFixed(1)}%)`);
  console.log(`  - High confidence: ${highConfidence}`);
  console.log(`  - Low confidence: ${lowConfidence}`);
  console.log(`No match: ${noMatch}`);
  console.log(`\n✅ Report saved to: ${DRY_RUN_REPORT_FILE}`);
  console.log("\nReview the report and run with --import flag to begin import.\n");
}

// Import mode: Insert facilities into database
async function runImport(limit?: number) {
  console.log("\n📥 IMPORT MODE: Inserting facilities into database\n");
  console.log("=".repeat(80));

  const progress = loadProgress();

  // Parse CSV
  const csvContent = fs.readFileSync(CSV_PATH, "utf-8");
  const records: CSVRow[] = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
  });

  const totalRecords = limit ? Math.min(limit, records.length) : records.length;

  console.log(`\n📊 Loaded ${records.length} facilities from CSV`);
  if (limit) {
    console.log(`⚠️  Processing only first ${totalRecords} facilities\n`);
  } else {
    console.log();
  }

  const unmatchedFacilities: string[] = [
    "CSV Row,Facility Name,Address,City,Reason",
  ];

  for (let i = 0; i < totalRecords; i++) {
    const csvRow = records[i];

    // Skip rows without facility name or address
    if (!csvRow["Facility Name"] || !csvRow["Full Address"]) {
      continue;
    }

    const facilities = parseLocations(csvRow);

    for (const facility of facilities) {
      facility.csvRowIndex = i + 2;
      progress.processedFacilities++;

      console.log(`\n[${progress.processedFacilities}] ${facility.facilityName}`);
      console.log(`  📍 ${facility.fullAddress}`);

      try {
        // Search Google Places
        const match = await searchGooglePlacesForFacility(facility);

        if (!match) {
          console.log(`  ⏭️  Skipping: No Google Places match`);
          unmatchedFacilities.push(
            `${facility.csvRowIndex},"${facility.facilityName}","${facility.fullAddress}","${facility.city}","No Google Places match"`,
          );
          progress.unmatchedFacilities++;
          saveProgress(progress);
          continue;
        }

        progress.matchedFacilities++;

        // Fetch full place details
        console.log(`  📥 Fetching place details...`);
        const placeDetails = await fetchPlaceDetails(match.placeId);

        if (!placeDetails) {
          console.log(`  ⏭️  Skipping: Could not fetch place details`);
          unmatchedFacilities.push(
            `${facility.csvRowIndex},"${facility.facilityName}","${facility.fullAddress}","${facility.city}","Could not fetch place details"`,
          );
          progress.errors++;
          saveProgress(progress);
          continue;
        }

        // Check if facility exists
        const exists = await checkFacilityExists(match.placeId);

        // Upsert facility
        console.log(`  💾 ${exists ? "Updating" : "Inserting"} facility...`);
        const upsertSuccess = await upsertFacility(placeDetails, facility, exists);

        if (!upsertSuccess) {
          console.log(`  ❌ Failed to upsert facility`);
          progress.errors++;
          saveProgress(progress);
          continue;
        }

        if (exists) {
          progress.updatedFacilities++;
        } else {
          progress.insertedFacilities++;
        }

        // Assign Partnership Active tag
        console.log(`  🏷️  Assigning Partnership Active tag...`);
        await assignPartnershipTag(match.placeId);

        // Create facility note
        console.log(`  📝 Creating facility note...`);
        await createFacilityNote(match.placeId, facility);

        console.log(`  ✅ Complete!`);
        saveProgress(progress);

      } catch (error: any) {
        console.error(`  ❌ Error processing facility: ${error.message}`);
        progress.errors++;
        saveProgress(progress);
      }
    }
  }

  // Save unmatched facilities report
  if (unmatchedFacilities.length > 1) {
    fs.writeFileSync(UNMATCHED_REPORT_FILE, unmatchedFacilities.join("\n"));
    console.log(`\n📄 Unmatched facilities report saved to: ${UNMATCHED_REPORT_FILE}`);
  }

  // Save summary
  const summary = {
    ...progress,
    completedAt: new Date().toISOString(),
  };
  fs.writeFileSync(SUMMARY_FILE, JSON.stringify(summary, null, 2));

  console.log("\n" + "=".repeat(80));
  console.log("\n📊 IMPORT SUMMARY\n");
  console.log(`Facilities processed: ${progress.processedFacilities}`);
  console.log(`Matched: ${progress.matchedFacilities}`);
  console.log(`Inserted: ${progress.insertedFacilities}`);
  console.log(`Updated: ${progress.updatedFacilities}`);
  console.log(`Unmatched: ${progress.unmatchedFacilities}`);
  console.log(`Errors: ${progress.errors}`);
  console.log(`\n✅ Summary saved to: ${SUMMARY_FILE}\n`);
}

// ===== ENTRY POINT =====
async function main() {
  const args = process.argv.slice(2);
  const isDryRun = !args.includes("--import");

  // Get limit parameter if provided (e.g., --limit=5)
  const limitArg = args.find(arg => arg.startsWith("--limit="));
  const limit = limitArg ? parseInt(limitArg.split("=")[1]) : undefined;

  if (limit) {
    console.log(`\n⚠️  LIMIT MODE: Processing only ${limit} facilities\n`);
  }

  if (isDryRun) {
    await runDryRun(limit);
  } else {
    await runImport(limit);
  }
}

main().catch(console.error);
