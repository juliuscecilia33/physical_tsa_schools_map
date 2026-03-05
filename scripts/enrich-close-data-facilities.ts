import { createClient } from "@supabase/supabase-js";
import { getJson } from "serpapi";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import axios from "axios";
import sharp from "sharp";

// Load environment variables
dotenv.config({ path: path.join(__dirname, "../.env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const serpApiKey = process.env.SERPAPI_API_KEY!;

if (!supabaseUrl || !supabaseServiceKey || !serpApiKey) {
  console.error("Missing required environment variables");
  console.error(
    "Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SERPAPI_API_KEY",
  );
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// ─── Tag IDs ───
const CLOSE_DATA_TAG_ID = "ef3537b6-4d83-4eb8-84a5-9bc74e776c72";
const SERPAPI_TAG_ID = "e326fe36-5536-4209-87ed-f99528e1d1ee";

// ─── Config ───
const STORAGE_BUCKET = "facility-photos";
const DELAY_BETWEEN_FACILITIES_MS = 2000;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;
const MAX_PHOTOS = 40;
const MAX_REVIEWS = 58;
const PROGRESS_FILE = path.join(
  __dirname,
  "../.serpapi-enrich-close-data-progress.json",
);

const delay = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

// ─── CLI Args ───
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const BATCH_SIZE = parseInt(
  args.find((a) => a.startsWith("--batch-size="))?.split("=")[1] || "50",
);
const OFFSET = parseInt(
  args.find((a) => a.startsWith("--offset="))?.split("=")[1] || "0",
);

// ─── Interfaces ───
interface FacilityToEnrich {
  id: string;
  place_id: string;
  name: string;
  address: string;
  identified_sports?: string[];
  sport_metadata?: Record<string, SportMetadata>;
}

interface ProgressState {
  processedCount: number;
  successCount: number;
  failedCount: number;
  skippedCount: number;
  processedPlaceIds: string[];
  apiCallsUsed: number;
  imagesUploaded: number;
  imageUploadsFailed: number;
  lastUpdated: string;
  errors: Array<{
    place_id: string;
    name: string;
    error: string;
    timestamp: string;
  }>;
}

interface SportMetadata {
  score: number;
  sources: Array<"name" | "review" | "api" | "serp_review">;
  keywords_matched: string[];
  confidence: "high" | "medium" | "low";
  matched_text?: string | string[];
}

interface Review {
  author_name?: string;
  text?: string;
  snippet?: string;
  user?: { name: string };
}

// ─── Progress helpers ───
function loadProgress(): ProgressState {
  if (fs.existsSync(PROGRESS_FILE)) {
    const data = fs.readFileSync(PROGRESS_FILE, "utf-8");
    const progress = JSON.parse(data);
    if (progress.imagesUploaded === undefined) progress.imagesUploaded = 0;
    if (progress.imageUploadsFailed === undefined)
      progress.imageUploadsFailed = 0;
    return progress;
  }
  return {
    processedCount: 0,
    successCount: 0,
    failedCount: 0,
    skippedCount: 0,
    processedPlaceIds: [],
    apiCallsUsed: 0,
    imagesUploaded: 0,
    imageUploadsFailed: 0,
    lastUpdated: new Date().toISOString(),
    errors: [],
  };
}

function saveProgress(progress: ProgressState) {
  progress.lastUpdated = new Date().toISOString();
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

function printProgressSummary(
  progress: ProgressState,
  total: number,
  startTime: number,
): void {
  const elapsed = (Date.now() - startTime) / 1000 / 60;
  const remaining = total - progress.processedCount;
  const rate = progress.processedCount / (elapsed || 1);
  const eta = remaining / (rate || 1);

  console.log("\n" + "=".repeat(70));
  console.log("PROGRESS SUMMARY");
  console.log("=".repeat(70));
  console.log(`   Total Facilities: ${total}`);
  console.log(`   Processed: ${progress.processedCount}`);
  console.log(`   Successful: ${progress.successCount}`);
  console.log(`   Failed: ${progress.failedCount}`);
  console.log(`   Skipped: ${progress.skippedCount}`);
  console.log(`   Remaining: ${remaining}`);
  console.log(`   API Calls Used: ${progress.apiCallsUsed}`);
  console.log(`   Images Uploaded: ${progress.imagesUploaded}`);
  console.log(`   Image Upload Failures: ${progress.imageUploadsFailed}`);
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

// ─── Step 0: Query target facilities ───

/**
 * Paginated query for all place_ids with a given tag.
 * Supabase has a 1000-row default limit, so we paginate.
 */
async function getAllPlaceIdsWithTag(tagId: string): Promise<Set<string>> {
  const placeIds = new Set<string>();
  const PAGE_SIZE = 1000;
  let offset = 0;

  while (true) {
    const { data, error } = await supabaseAdmin
      .from("facility_tag_assignments")
      .select("place_id")
      .eq("tag_id", tagId)
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      throw new Error(
        `Failed to query tag assignments for ${tagId}: ${error.message}`,
      );
    }

    if (!data || data.length === 0) break;

    for (const row of data) {
      placeIds.add(row.place_id);
    }

    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return placeIds;
}

async function getTargetFacilities(
  alreadyProcessed: string[],
): Promise<FacilityToEnrich[]> {
  console.log("\n--- Step 0: Finding target facilities ---");

  // Get place_ids with Close Data tag
  console.log("   Querying Close Data tag assignments...");
  const closeDataPlaceIds = await getAllPlaceIdsWithTag(CLOSE_DATA_TAG_ID);
  console.log(`   Found ${closeDataPlaceIds.size} with Close Data tag`);

  // Get place_ids with SerpAPI tag
  console.log("   Querying SerpAPI tag assignments...");
  const serpApiPlaceIds = await getAllPlaceIdsWithTag(SERPAPI_TAG_ID);
  console.log(`   Found ${serpApiPlaceIds.size} with SerpAPI tag`);

  // Set difference: Close Data minus SerpAPI
  const processedSet = new Set(alreadyProcessed);
  const targetPlaceIds: string[] = [];
  for (const placeId of closeDataPlaceIds) {
    if (!serpApiPlaceIds.has(placeId) && !processedSet.has(placeId)) {
      targetPlaceIds.push(placeId);
    }
  }

  console.log(
    `   ${targetPlaceIds.length} facilities need enrichment (after excluding ${serpApiPlaceIds.size} already enriched, ${processedSet.size} in progress)`,
  );

  if (targetPlaceIds.length === 0) return [];

  // Apply offset and batch size
  const sliced = targetPlaceIds.slice(OFFSET, OFFSET + BATCH_SIZE);
  console.log(
    `   Processing batch: offset=${OFFSET}, batch_size=${BATCH_SIZE} => ${sliced.length} facilities`,
  );

  // Fetch full facility data in batches of 100 (Supabase .in() limit)
  const facilities: FacilityToEnrich[] = [];
  for (let i = 0; i < sliced.length; i += 100) {
    const batch = sliced.slice(i, i + 100);
    const { data, error } = await supabaseAdmin
      .from("sports_facilities")
      .select(
        "id, place_id, name, address, identified_sports, sport_metadata",
      )
      .in("place_id", batch);

    if (error) {
      throw new Error(`Failed to fetch facilities: ${error.message}`);
    }

    if (data) facilities.push(...(data as FacilityToEnrich[]));
  }

  console.log(`   Fetched ${facilities.length} facility records from DB`);
  return facilities;
}

// ─── Step 1: SerpAPI enrichment (from enrich-with-serpapi.ts) ───

async function downloadImage(url: string): Promise<Buffer | null> {
  try {
    const response = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 30000,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SerpAPI Image Downloader)",
      },
    });
    return Buffer.from(response.data);
  } catch (error: any) {
    console.log(`     Failed to download image: ${error.message}`);
    return null;
  }
}

async function uploadImageToStorage(
  facilityId: string,
  imageBuffer: Buffer,
  index: number,
): Promise<string | null> {
  try {
    const compressedBuffer = await sharp(imageBuffer)
      .webp({ quality: 80 })
      .toBuffer();

    const timestamp = Date.now();
    const filename = `${facilityId}/${timestamp}_${index}.webp`;

    const { error } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .upload(filename, compressedBuffer, {
        contentType: "image/webp",
        upsert: false,
      });

    if (error) {
      console.log(`     Upload error: ${error.message}`);
      return null;
    }

    const { data: urlData } = supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(filename);

    return urlData.publicUrl;
  } catch (error: any) {
    console.log(`     Exception during upload: ${error.message}`);
    return null;
  }
}

async function processAndUploadPhoto(
  facilityId: string,
  photo: any,
  index: number,
): Promise<{
  supabaseUrl: string | null;
  originalData: any;
  success: boolean;
}> {
  const originalUrl = photo.image || photo.thumbnail;
  if (!originalUrl) {
    return { supabaseUrl: null, originalData: photo, success: false };
  }

  const imageBuffer = await downloadImage(originalUrl);
  if (!imageBuffer) {
    return { supabaseUrl: null, originalData: photo, success: false };
  }

  const supabaseUrl = await uploadImageToStorage(facilityId, imageBuffer, index);
  return {
    supabaseUrl,
    originalData: photo,
    success: supabaseUrl !== null,
  };
}

async function getDataIdFromPlaceId(
  placeId: string,
): Promise<{ success: boolean; dataId?: string; error?: string }> {
  try {
    const response = await getJson({
      engine: "google_maps",
      place_id: placeId,
      api_key: serpApiKey,
    });

    const dataId = response.place_results?.data_id;
    if (dataId) {
      console.log(`     Got data_id: ${dataId}`);
      return { success: true, dataId };
    }

    console.log(`     No data_id found in response`);
    return { success: false, error: "No data_id found" };
  } catch (error: any) {
    console.log(`     Exception during place_id query: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function fetchSerpApiData(
  placeId: string,
  facilityId: string,
  retryCount = 0,
): Promise<{
  success: boolean;
  photos?: any[];
  originalPhotos?: any[];
  reviews?: any[];
  dataId?: string;
  error?: string;
  apiCallsUsed: number;
  imagesUploaded: number;
  imageUploadsFailed: number;
}> {
  let originalPhotos: any[] = [];
  let processedPhotos: any[] = [];
  let reviews: any[] = [];
  let dataId: string | undefined;
  let apiCallsUsed = 0;
  let imagesUploaded = 0;
  let imageUploadsFailed = 0;

  try {
    // Get data_id
    console.log(`     Getting data_id from place_id...`);
    const dataIdResult = await getDataIdFromPlaceId(placeId);
    apiCallsUsed++;

    if (!dataIdResult.success) {
      console.log(`     Could not get data_id: ${dataIdResult.error}`);
    } else {
      dataId = dataIdResult.dataId;
    }

    // Fetch photos (only if we have data_id)
    if (dataId) {
      console.log(`     Fetching photos (up to ${MAX_PHOTOS})...`);
      try {
        let nextPageToken: string | undefined = undefined;
        let pageCount = 0;

        while (originalPhotos.length < MAX_PHOTOS) {
          const photosResponse = await getJson({
            engine: "google_maps_photos",
            data_id: dataId,
            ...(nextPageToken && { next_page_token: nextPageToken }),
            api_key: serpApiKey,
          });
          apiCallsUsed++;
          pageCount++;

          const pagePhotos = photosResponse.photos || [];
          originalPhotos.push(...pagePhotos);
          console.log(
            `     Page ${pageCount}: ${pagePhotos.length} photos (total: ${originalPhotos.length})`,
          );

          nextPageToken = photosResponse.serpapi_pagination?.next_page_token;
          if (!nextPageToken || originalPhotos.length >= MAX_PHOTOS) break;
          await delay(500);
        }

        if (originalPhotos.length > MAX_PHOTOS) {
          originalPhotos = originalPhotos.slice(0, MAX_PHOTOS);
        }

        // Upload photos
        if (originalPhotos.length > 0) {
          console.log(
            `     Uploading ${originalPhotos.length} photos to Supabase Storage...`,
          );
          for (let i = 0; i < originalPhotos.length; i++) {
            console.log(
              `        [${i + 1}/${originalPhotos.length}] Downloading and uploading...`,
            );
            const result = await processAndUploadPhoto(
              facilityId,
              originalPhotos[i],
              i,
            );
            if (result.success && result.supabaseUrl) {
              processedPhotos.push({
                url: result.supabaseUrl,
                thumbnail: result.supabaseUrl,
              });
              imagesUploaded++;
              console.log(`        ✓ Uploaded successfully`);
            } else {
              imageUploadsFailed++;
              console.log(`        ⚠️  Upload failed`);
            }
            await delay(300);
          }
          console.log(
            `     Upload complete: ${imagesUploaded} uploaded, ${imageUploadsFailed} failed`,
          );
        }
      } catch (photoError: any) {
        console.log(`     Photos API error: ${photoError.message}`);
      }

      await delay(500);
    }

    // Fetch reviews
    console.log(`     Fetching reviews (up to ${MAX_REVIEWS})...`);
    try {
      let nextPageToken: string | undefined = undefined;
      let pageCount = 0;

      while (reviews.length < MAX_REVIEWS) {
        const reviewsResponse = await getJson({
          engine: "google_maps_reviews",
          place_id: placeId,
          ...(nextPageToken && { next_page_token: nextPageToken }),
          api_key: serpApiKey,
        });
        apiCallsUsed++;
        pageCount++;

        const pageReviews = reviewsResponse.reviews || [];
        reviews.push(...pageReviews);
        console.log(
          `     Page ${pageCount}: ${pageReviews.length} reviews (total: ${reviews.length})`,
        );

        nextPageToken = reviewsResponse.serpapi_pagination?.next_page_token;
        if (!nextPageToken || reviews.length >= MAX_REVIEWS) break;
        await delay(500);
      }

      if (reviews.length > MAX_REVIEWS) {
        reviews = reviews.slice(0, MAX_REVIEWS);
      }
    } catch (reviewError: any) {
      console.log(`     Reviews API error: ${reviewError.message}`);
    }

    return {
      success: true,
      photos: processedPhotos,
      originalPhotos,
      reviews,
      dataId,
      apiCallsUsed,
      imagesUploaded,
      imageUploadsFailed,
    };
  } catch (error: any) {
    if (retryCount < MAX_RETRIES) {
      console.log(
        `  Error, retrying (${retryCount + 1}/${MAX_RETRIES})...`,
      );
      await delay(RETRY_DELAY_MS * Math.pow(2, retryCount));
      return fetchSerpApiData(placeId, facilityId, retryCount + 1);
    }

    return {
      success: false,
      error: error.message || "Unknown error",
      apiCallsUsed,
      imagesUploaded,
      imageUploadsFailed,
    };
  }
}

async function updateFacilityWithSerpData(
  facilityId: string,
  photos: any[],
  originalPhotos: any[],
  reviews: any[],
  dataId?: string,
): Promise<boolean> {
  try {
    const updateData: any = {
      additional_photos: photos,
      additional_photos_original: originalPhotos,
      additional_reviews: reviews,
      serp_scraped: true,
      serp_scraped_at: new Date().toISOString(),
    };

    if (dataId) {
      updateData.serp_data_id = dataId;
    }

    const { error } = await supabaseAdmin
      .from("sports_facilities")
      .update(updateData)
      .eq("id", facilityId);

    if (error) {
      console.error(`  DB update error: ${error.message}`);
      return false;
    }
    return true;
  } catch (error: any) {
    console.error(`  Error updating facility: ${error.message}`);
    return false;
  }
}

// ─── Step 2: Assign SerpAPI tag (from assign-serpapi-tag.ts) ───

async function assignSerpApiTag(placeId: string): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from("facility_tag_assignments")
    .insert({ place_id: placeId, tag_id: SERPAPI_TAG_ID });

  if (error) {
    if (error.code === "23505") {
      // unique constraint - already assigned
      return true;
    }
    console.log(`  Tag assignment error: ${error.message}`);
    return false;
  }
  return true;
}

// ─── Step 3: Reassess sport metadata (from reassess-sport-metadata-with-serpapi.ts) ───

const SPORT_KEYWORDS: Record<string, string[]> = {
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
  Rowing: ["rowing"],
  Sailing: ["sailing"],
  "Water Sports": ["kayak", "canoe"],
};

function findMatchingKeywordsInReview(
  sport: string,
  reviewText: string,
): { keywords: string[]; fullReview: string } {
  const keywords = SPORT_KEYWORDS[sport] || [];
  const matched: string[] = [];
  for (const keyword of keywords) {
    const regex = new RegExp(`\\b${keyword}\\b`, "i");
    if (regex.test(reviewText)) {
      matched.push(keyword);
    }
  }
  return { keywords: matched, fullReview: reviewText };
}

function calculateSerpReviewScore(
  keywordCount: number,
  reviewPosition: number,
): number {
  const positionBonus = Math.max(0, 15 - Math.floor(reviewPosition / 4));
  const keywordBonus = Math.min(10, keywordCount * 2);
  return 30 + positionBonus + keywordBonus;
}

function identifySportsFromAdditionalReviews(
  additionalReviews: Review[] | undefined,
): { sports: string[]; metadata: Record<string, SportMetadata> } {
  const sportsFound = new Set<string>();
  const metadata: Record<string, SportMetadata> = {};

  if (!additionalReviews || additionalReviews.length === 0) {
    return { sports: [], metadata };
  }

  for (const [sport] of Object.entries(SPORT_KEYWORDS)) {
    const matchingReviews: string[] = [];

    for (const review of additionalReviews) {
      const reviewText = review.snippet || review.text || "";
      if (!reviewText) continue;

      const match = findMatchingKeywordsInReview(sport, reviewText);
      if (match.keywords.length > 0) {
        matchingReviews.push(match.fullReview);
      }
    }

    if (matchingReviews.length > 0) {
      sportsFound.add(sport);

      const firstMatchIndex = additionalReviews.findIndex((r) => {
        const text = r.snippet || r.text || "";
        return findMatchingKeywordsInReview(sport, text).keywords.length > 0;
      });

      const allKeywords = new Set<string>();
      matchingReviews.forEach((reviewText) => {
        findMatchingKeywordsInReview(sport, reviewText).keywords.forEach((k) =>
          allKeywords.add(k),
        );
      });

      const score = calculateSerpReviewScore(allKeywords.size, firstMatchIndex);

      metadata[sport] = {
        score,
        sources: ["serp_review"],
        keywords_matched: Array.from(allKeywords),
        confidence: score >= 70 ? "high" : score >= 30 ? "medium" : "low",
        matched_text: matchingReviews,
      };
    }
  }

  return { sports: Array.from(sportsFound), metadata };
}

function mergeSportMetadata(
  existing: SportMetadata | undefined,
  newMetadata: SportMetadata,
): SportMetadata {
  if (!existing) return newMetadata;

  const mergedSources = [
    ...new Set([...existing.sources, ...newMetadata.sources]),
  ] as Array<"name" | "review" | "api" | "serp_review">;
  const mergedKeywords = [
    ...new Set([...existing.keywords_matched, ...newMetadata.keywords_matched]),
  ];
  const mergedScore = Math.max(existing.score, newMetadata.score);

  let mergedMatchedText: string | string[] = existing.matched_text || "";
  if (newMetadata.matched_text) {
    if (
      Array.isArray(newMetadata.matched_text) &&
      newMetadata.sources.includes("serp_review")
    ) {
      if (Array.isArray(existing.matched_text)) {
        mergedMatchedText = [
          ...existing.matched_text,
          ...newMetadata.matched_text,
        ];
      } else if (existing.matched_text) {
        mergedMatchedText = [
          existing.matched_text,
          ...newMetadata.matched_text,
        ];
      } else {
        mergedMatchedText = newMetadata.matched_text;
      }
    } else {
      if (newMetadata.sources.includes("name")) {
        mergedMatchedText = newMetadata.matched_text;
      } else if (
        !existing.sources.includes("name") &&
        newMetadata.sources.includes("api")
      ) {
        mergedMatchedText = newMetadata.matched_text;
      } else if (
        !existing.sources.includes("name") &&
        !existing.sources.includes("api") &&
        newMetadata.sources.includes("review")
      ) {
        mergedMatchedText = newMetadata.matched_text;
      }
    }
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

function reassessFacilitySportMetadata(
  existingSports: string[] | undefined,
  existingMetadata: Record<string, SportMetadata> | undefined,
  additionalReviews: Review[] | undefined,
  minScore = 30,
): {
  updated: boolean;
  newSports: string[];
  improvedSports: string[];
  finalIdentifiedSports: string[];
  finalSportMetadata: Record<string, SportMetadata>;
} {
  const currentSports = new Set(existingSports || []);
  const currentMetadata = existingMetadata || {};

  const { sports: newSportsFromReviews, metadata: newMetadata } =
    identifySportsFromAdditionalReviews(additionalReviews);

  const newSports: string[] = [];
  const improvedSports: string[] = [];
  let updated = false;

  const finalMetadata: Record<string, SportMetadata> = { ...currentMetadata };

  for (const sport of newSportsFromReviews) {
    const merged = mergeSportMetadata(currentMetadata[sport], newMetadata[sport]);

    if (merged.score >= minScore) {
      finalMetadata[sport] = merged;

      if (!currentSports.has(sport)) {
        newSports.push(sport);
        currentSports.add(sport);
        updated = true;
      } else if (
        JSON.stringify(merged) !== JSON.stringify(currentMetadata[sport])
      ) {
        improvedSports.push(sport);
        updated = true;
      }
    }
  }

  return {
    updated,
    newSports,
    improvedSports,
    finalIdentifiedSports: Array.from(currentSports),
    finalSportMetadata: finalMetadata,
  };
}

async function updateSportMetadata(
  placeId: string,
  identifiedSports: string[],
  sportMetadata: Record<string, SportMetadata>,
): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from("sports_facilities")
    .update({
      identified_sports: identifiedSports,
      sport_metadata: sportMetadata,
      sport_metadata_reassessed: true,
    })
    .eq("place_id", placeId);

  if (error) {
    console.log(`  Sport metadata update error: ${error.message}`);
    return false;
  }
  return true;
}

// ─── Main pipeline per facility ───

async function processFacility(
  facility: FacilityToEnrich,
  progress: ProgressState,
  index: number,
  total: number,
): Promise<void> {
  console.log(
    `\n[${index + 1}/${total}] ${facility.name} (${facility.place_id})`,
  );

  if (progress.processedPlaceIds.includes(facility.place_id)) {
    console.log(`   Skipping (already processed)`);
    progress.skippedCount++;
    return;
  }

  if (DRY_RUN) {
    console.log(`   [DRY RUN] Would enrich this facility`);
    progress.processedCount++;
    progress.successCount++;
    progress.processedPlaceIds.push(facility.place_id);
    return;
  }

  // Step 1: SerpAPI enrichment
  console.log(`   Step 1: SerpAPI enrichment...`);
  const serpData = await fetchSerpApiData(
    facility.place_id,
    facility.id,
  );
  progress.apiCallsUsed += serpData.apiCallsUsed;
  progress.imagesUploaded += serpData.imagesUploaded;
  progress.imageUploadsFailed += serpData.imageUploadsFailed;

  if (!serpData.success) {
    console.log(`   FAILED: ${serpData.error}`);
    progress.failedCount++;
    progress.errors.push({
      place_id: facility.place_id,
      name: facility.name,
      error: serpData.error || "Unknown error",
      timestamp: new Date().toISOString(),
    });
    progress.processedCount++;
    progress.processedPlaceIds.push(facility.place_id);
    return;
  }

  const photoCount = serpData.photos?.length || 0;
  const reviewCount = serpData.reviews?.length || 0;
  console.log(`   Photos: ${photoCount}, Reviews: ${reviewCount}`);

  // Update DB with serp data
  const dbUpdated = await updateFacilityWithSerpData(
    facility.id,
    serpData.photos || [],
    serpData.originalPhotos || [],
    serpData.reviews || [],
    serpData.dataId,
  );

  if (!dbUpdated) {
    console.log(`   FAILED: DB update failed`);
    progress.failedCount++;
    progress.errors.push({
      place_id: facility.place_id,
      name: facility.name,
      error: "Database update failed",
      timestamp: new Date().toISOString(),
    });
    progress.processedCount++;
    progress.processedPlaceIds.push(facility.place_id);
    return;
  }

  // Step 2: Assign SerpAPI tag
  console.log(`   Step 2: Assigning SerpAPI tag...`);
  const tagAssigned = await assignSerpApiTag(facility.place_id);
  if (!tagAssigned) {
    console.log(`   Warning: Tag assignment failed (continuing anyway)`);
  }

  // Step 3: Reassess sport metadata using reviews from Step 1
  console.log(`   Step 3: Reassessing sport metadata...`);
  const reassessment = reassessFacilitySportMetadata(
    facility.identified_sports,
    facility.sport_metadata,
    serpData.reviews as Review[],
  );

  if (reassessment.updated) {
    if (reassessment.newSports.length > 0) {
      console.log(`   New sports: ${reassessment.newSports.join(", ")}`);
    }
    if (reassessment.improvedSports.length > 0) {
      console.log(
        `   Improved sports: ${reassessment.improvedSports.join(", ")}`,
      );
    }
  }

  const metadataUpdated = await updateSportMetadata(
    facility.place_id,
    reassessment.finalIdentifiedSports,
    reassessment.finalSportMetadata,
  );

  if (!metadataUpdated) {
    console.log(`   Warning: Sport metadata update failed`);
  }

  console.log(`   Done!`);
  progress.successCount++;
  progress.processedCount++;
  progress.processedPlaceIds.push(facility.place_id);
}

// ─── Main ───

async function main() {
  console.log("Enrich Close Data Facilities (Combined Pipeline)");
  console.log("=".repeat(70));
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`);
  console.log(`Batch size: ${BATCH_SIZE}`);
  console.log(`Offset: ${OFFSET}`);
  console.log("=".repeat(70));

  const progress = loadProgress();

  if (progress.processedCount > 0) {
    console.log(
      `\nResuming: ${progress.processedCount} previously processed, ${progress.processedPlaceIds.length} place_ids tracked`,
    );
  }

  const facilities = await getTargetFacilities(progress.processedPlaceIds);

  if (facilities.length === 0) {
    console.log("\nNo facilities to process. All done!");
    return;
  }

  console.log(`\nProcessing ${facilities.length} facilities...\n`);

  const startTime = Date.now();

  for (let i = 0; i < facilities.length; i++) {
    await processFacility(facilities[i], progress, i, facilities.length);
    saveProgress(progress);

    if ((i + 1) % 25 === 0) {
      printProgressSummary(progress, facilities.length, startTime);
    }

    if (i < facilities.length - 1) {
      await delay(DELAY_BETWEEN_FACILITIES_MS);
    }
  }

  // Final summary
  console.log("\n" + "=".repeat(70));
  console.log("ENRICHMENT COMPLETE!");
  console.log("=".repeat(70));
  console.log(`   Total Processed: ${progress.processedCount}`);
  console.log(`   Successful: ${progress.successCount}`);
  console.log(`   Failed: ${progress.failedCount}`);
  console.log(`   Skipped: ${progress.skippedCount}`);
  console.log(`   API Calls Used: ${progress.apiCallsUsed}`);
  console.log(`   Images Uploaded: ${progress.imagesUploaded}`);
  console.log(`   Image Upload Failures: ${progress.imageUploadsFailed}`);
  console.log(
    `   Success Rate: ${((progress.successCount / (progress.processedCount || 1)) * 100).toFixed(1)}%`,
  );
  console.log(
    `   Total Time: ${((Date.now() - startTime) / 1000 / 60).toFixed(1)} minutes`,
  );

  if (progress.errors.length > 0) {
    console.log(`\nErrors (${progress.errors.length}):`);
    progress.errors.slice(-10).forEach((err, i) => {
      console.log(`   ${i + 1}. ${err.name} (${err.place_id}): ${err.error}`);
    });
    if (progress.errors.length > 10) {
      console.log(`   ... and ${progress.errors.length - 10} more`);
    }
  }

  console.log("=".repeat(70));
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
