import { GoogleGenerativeAI } from "@google/generative-ai";
import postgres from "postgres";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: path.join(__dirname, "../.env.local") });

const databaseUrl = process.env.DATABASE_URL!;
const geminiApiKey = process.env.GEMINI_API_KEY!;

if (!databaseUrl || !geminiApiKey) {
  console.error("❌ Error: Missing required environment variables");
  console.error("   Required: DATABASE_URL, GEMINI_API_KEY");
  process.exit(1);
}

// Direct Postgres connection (bypasses REST API 1000-row limit)
const sql = postgres(databaseUrl, {
  prepare: false,
  ssl: { rejectUnauthorized: false },
  max: 10,
});

const genAI = new GoogleGenerativeAI(geminiApiKey);

// Configuration
const DRY_RUN = false; // Set to false to write results to DB
const TEST_LIMIT: number | null = null; // Set to null for full run
const BATCH_SIZE = 10; // Images per Gemini call
const DELAY_BETWEEN_GEMINI_CALLS_MS = 4000; // ~15 RPM
const CONCURRENCY_LIMIT = 5; // Parallel image downloads
const MODEL_NAME = "gemini-2.0-flash";

const PROGRESS_FILE = path.join(
  __dirname,
  "../progress/photo-analysis-progress.json",
);

// Types
interface PhotoData {
  image?: string;
  url?: string;
  thumbnail: string;
  video?: string;
  photo_meta_serpapi_link?: string;
}

interface Review {
  rating: number;
  text?: string;
  snippet?: string;
  images?: string[];
  user?: { name: string; thumbnail?: string };
  author_name?: string;
}

interface FacilityRow {
  id: string;
  name: string;
  place_id: string;
  additional_photos: PhotoData[] | null;
  additional_reviews: Review[] | null;
}

interface ImageToAnalyze {
  url: string;
  source: "additional_photos" | "review";
  review_index?: number;
}

interface PhotoAnalysisResult {
  url: string;
  source: "additional_photos" | "review";
  review_index?: number;
  usefulness_score: number;
  category: string;
  description: string;
}

interface ProgressState {
  processedCount: number;
  successCount: number;
  failedCount: number;
  skippedCount: number;
  processedFacilityIds: string[];
  lastProcessedIndex: number;
  totalImages: number;
  geminiCalls: number;
  lastUpdated: string;
  errors: Array<{
    facility_id: string;
    facility_name: string;
    error: string;
    timestamp: string;
  }>;
}

// Helper functions
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function loadProgress(): ProgressState {
  if (fs.existsSync(PROGRESS_FILE)) {
    return JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf-8"));
  }
  return {
    processedCount: 0,
    successCount: 0,
    failedCount: 0,
    skippedCount: 0,
    processedFacilityIds: [],
    lastProcessedIndex: -1,
    totalImages: 0,
    geminiCalls: 0,
    lastUpdated: new Date().toISOString(),
    errors: [],
  };
}

function saveProgress(progress: ProgressState) {
  progress.lastUpdated = new Date().toISOString();
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

/**
 * Get the usable URL from a PhotoData object
 */
function getPhotoUrl(photo: PhotoData): string {
  return photo.image || photo.url || photo.thumbnail;
}

/**
 * Collect all image URLs from a facility's photos and reviews
 */
function collectImageUrls(facility: FacilityRow): ImageToAnalyze[] {
  const images: ImageToAnalyze[] = [];

  // From additional_photos
  if (facility.additional_photos && Array.isArray(facility.additional_photos)) {
    for (const photo of facility.additional_photos) {
      const url = getPhotoUrl(photo);
      if (url) {
        images.push({ url, source: "additional_photos" });
      }
    }
  }

  // From additional_reviews images
  if (
    facility.additional_reviews &&
    Array.isArray(facility.additional_reviews)
  ) {
    facility.additional_reviews.forEach((review, reviewIdx) => {
      if (review.images && Array.isArray(review.images)) {
        for (const imageUrl of review.images) {
          if (imageUrl) {
            images.push({
              url: imageUrl,
              source: "review",
              review_index: reviewIdx,
            });
          }
        }
      }
    });
  }

  return images;
}

/**
 * Download an image and convert to base64
 */
async function downloadImageAsBase64(
  url: string,
): Promise<{ base64: string; mimeType: string } | null> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") || "image/jpeg";
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");

    // Determine mime type
    let mimeType = "image/jpeg";
    if (contentType.includes("png")) mimeType = "image/png";
    else if (contentType.includes("webp")) mimeType = "image/webp";
    else if (contentType.includes("gif")) mimeType = "image/gif";

    return { base64, mimeType };
  } catch (error) {
    console.log(
      `      ⚠️  Download error for ${url.substring(0, 80)}: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
    return null;
  }
}

/**
 * Download multiple images with concurrency limit
 */
async function downloadImagesWithConcurrency(images: ImageToAnalyze[]): Promise<
  Array<{
    image: ImageToAnalyze;
    base64: string;
    mimeType: string;
  }>
> {
  const results: Array<{
    image: ImageToAnalyze;
    base64: string;
    mimeType: string;
  }> = [];
  const queue = [...images];
  let completed = 0;
  const total = images.length;

  async function worker() {
    while (queue.length > 0) {
      const img = queue.shift()!;
      const downloaded = await downloadImageAsBase64(img.url);
      completed++;
      if (downloaded) {
        results.push({
          image: img,
          base64: downloaded.base64,
          mimeType: downloaded.mimeType,
        });
        console.log(
          `      ✓ [${completed}/${total}] Downloaded: ${img.url.substring(0, 80)}...`,
        );
      } else {
        console.log(
          `      ✗ [${completed}/${total}] Failed: ${img.url.substring(0, 80)}...`,
        );
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(CONCURRENCY_LIMIT, images.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}

/**
 * Split array into batches
 */
function batch<T>(arr: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    batches.push(arr.slice(i, i + size));
  }
  return batches;
}

const GEMINI_PROMPT = `You are analyzing images from a sports facility listing. For each image, classify it and score how useful it is for evaluating whether the facility is suitable for a youth academic-sports program.

Categories:
- facility_interior: Indoor courts, gyms, training areas
- facility_exterior: Building exterior, entrance, grounds
- equipment: Sports equipment, goals, nets, racks
- court_field: Courts, fields, playing surfaces
- pool: Swimming pools, aquatic areas
- parking_lot: Parking areas, driveways
- selfie: Selfies, personal photos
- food: Food, drinks, restaurant/cafe areas
- logo: Business logos, branding
- map_screenshot: Maps, directions, screenshots
- group_activity: Group sports, classes, organized activities
- event: Events, tournaments, ceremonies
- signage: Signs, banners, facility information
- nature_scenery: Sky, sunset, clouds, landscape with no facility focus
- people_closeup: Close-up portraits/photos of individuals (not showing facility)
- carnival_amusement: Carnival rides, bounce houses, festival attractions, temporary entertainment
- animal_art: Animals, sculptures, art installations unrelated to sports
- flyer: Promotional flyers, posters, printed notices, event advertisements
- irrelevant: Anything not related to the facility

Scoring guide:
- 80-100: Playable space clearly visible (courts, fields, gym interior, pool)
- 60-79: Facility exterior, amenities, equipment, parking
- 40-59: Partially useful (event photo showing facility, signage with info)
- 20-39: Minimal use (logo, map screenshot, distant/blurry, facility barely visible in background but main subject is irrelevant like a sunset with bleachers in the corner)
- 0-19: Not useful (selfies, food, nature/sky photos, animal sculptures, carnival rides, bounce houses, close-up portraits of people, anything where the sports facility is not visible)

Low-scoring examples (score these types LOW):
- Photo of the sky/sunset even if taken at a facility → 5-15
- Giant sculpture or art installation at a festival → 0-10
- Person on a carnival ride → 0-10
- Close-up of a player's face/body (facility not visible) → 10-20
- Kids on a bounce house → 5-15
- Decorative animals or statues → 0-10
- Flyer or promotional poster → 5-15

Respond with a JSON array. Each element must have:
- "index": the image number (0-based, matching the order provided)
- "usefulness_score": integer 0-100
- "category": one of the categories above
- "description": brief 5-10 word description

Example response:
[
  {"index": 0, "usefulness_score": 85, "category": "court_field", "description": "Indoor basketball court with hardwood floor"},
  {"index": 1, "usefulness_score": 10, "category": "selfie", "description": "Person taking selfie in parking lot"},
  {"index": 2, "usefulness_score": 5, "category": "nature_scenery", "description": "Sunset sky with no facility visible"},
  {"index": 3, "usefulness_score": 5, "category": "carnival_amusement", "description": "Kids bouncing on inflatable bounce house"}
]`;

/**
 * Call Gemini Vision to analyze a batch of images
 */
async function analyzeImageBatch(
  downloadedImages: Array<{
    image: ImageToAnalyze;
    base64: string;
    mimeType: string;
  }>,
  retryCount: number = 0,
): Promise<
  Array<{
    image: ImageToAnalyze;
    usefulness_score: number;
    category: string;
    description: string;
  }>
> {
  const model = genAI.getGenerativeModel({
    model: MODEL_NAME,
    generationConfig: {
      responseMimeType: "application/json",
      maxOutputTokens: 2000,
    },
  });

  // Build parts: text prompt + inline images
  const parts: Array<
    { text: string } | { inlineData: { mimeType: string; data: string } }
  > = [];

  parts.push({
    text: `${GEMINI_PROMPT}\n\nAnalyze these ${downloadedImages.length} images:`,
  });

  for (const dl of downloadedImages) {
    parts.push({
      inlineData: {
        mimeType: dl.mimeType,
        data: dl.base64,
      },
    });
  }

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts }],
    });

    const text = result.response.text();
    const parsed: Array<{
      index: number;
      usefulness_score: number;
      category: string;
      description: string;
    }> = JSON.parse(text);

    return parsed.map((p) => {
      const dl = downloadedImages[p.index] || downloadedImages[0];
      return {
        image: dl.image,
        usefulness_score: Math.max(0, Math.min(100, p.usefulness_score)),
        category: p.category,
        description: p.description,
      };
    });
  } catch (error: any) {
    // Handle rate limiting with exponential backoff
    if (
      error?.status === 429 ||
      error?.message?.includes("429") ||
      error?.message?.includes("RESOURCE_EXHAUSTED")
    ) {
      if (retryCount < 3) {
        const backoffMs = Math.pow(2, retryCount) * 10000; // 10s, 20s, 40s
        console.log(
          `     ⏳ Rate limited, retrying in ${backoffMs / 1000}s (attempt ${retryCount + 1}/3)`,
        );
        await delay(backoffMs);
        return analyzeImageBatch(downloadedImages, retryCount + 1);
      }
    }

    // Retry once on parse failures
    if (
      retryCount === 0 &&
      (error instanceof SyntaxError || error?.message?.includes("JSON"))
    ) {
      console.log(`     ⚠️  JSON parse error, retrying once...`);
      await delay(2000);
      return analyzeImageBatch(downloadedImages, 1);
    }

    throw error;
  }
}

/**
 * Process a single facility
 */
async function processFacility(
  facility: FacilityRow,
  progress: ProgressState,
  index: number,
  total: number,
): Promise<void> {
  console.log(`\n[${index + 1}/${total}] ${facility.name}`);
  console.log(`   ID: ${facility.id}`);

  // Skip if already processed
  if (progress.processedFacilityIds.includes(facility.id)) {
    console.log(`   ⏭️  Already processed, skipping`);
    progress.skippedCount++;
    return;
  }

  // Collect all image URLs
  const imageUrls = collectImageUrls(facility);
  if (imageUrls.length === 0) {
    console.log(`   ⏭️  No images found, skipping`);
    progress.skippedCount++;
    progress.processedCount++;
    progress.lastProcessedIndex = index;
    progress.processedFacilityIds.push(facility.id);
    return;
  }

  console.log(
    `   📸 ${imageUrls.length} images (${imageUrls.filter((i) => i.source === "additional_photos").length} photos, ${imageUrls.filter((i) => i.source === "review").length} review)`,
  );

  // Download all images
  console.log(`   ⬇️  Downloading images...`);
  const downloaded = await downloadImagesWithConcurrency(imageUrls);
  console.log(
    `   ✓ Downloaded ${downloaded.length}/${imageUrls.length} images`,
  );

  if (downloaded.length === 0) {
    console.log(`   ⚠️  No images could be downloaded, skipping`);
    progress.failedCount++;
    progress.processedCount++;
    progress.lastProcessedIndex = index;
    progress.processedFacilityIds.push(facility.id);
    progress.errors.push({
      facility_id: facility.id,
      facility_name: facility.name,
      error: "No images could be downloaded",
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // Batch and analyze
  const batches = batch(downloaded, BATCH_SIZE);
  const allResults: PhotoAnalysisResult[] = [];

  for (let bIdx = 0; bIdx < batches.length; bIdx++) {
    const b = batches[bIdx];
    console.log(
      `   🤖 Analyzing batch ${bIdx + 1}/${batches.length} (${b.length} images)...`,
    );

    try {
      const results = await analyzeImageBatch(b);
      progress.geminiCalls++;

      for (const r of results) {
        allResults.push({
          url: r.image.url,
          source: r.image.source,
          review_index: r.image.review_index,
          usefulness_score: r.usefulness_score,
          category: r.category,
          description: r.description,
        });
        console.log(
          `      [${r.usefulness_score}] ${r.category}: ${r.description}`,
        );
      }
    } catch (error: any) {
      console.log(`   ⚠️  Batch ${bIdx + 1} failed: ${error.message}`);
      progress.errors.push({
        facility_id: facility.id,
        facility_name: facility.name,
        error: `Batch ${bIdx + 1} failed: ${error.message}`,
        timestamp: new Date().toISOString(),
      });
    }

    // Rate limiting between Gemini calls
    if (bIdx < batches.length - 1) {
      await delay(DELAY_BETWEEN_GEMINI_CALLS_MS);
    }
  }

  progress.totalImages += allResults.length;

  // Compute summary
  const usefulCount = allResults.filter((r) => r.usefulness_score >= 50).length;
  const avgUsefulness =
    allResults.length > 0
      ? Math.round(
          allResults.reduce((sum, r) => sum + r.usefulness_score, 0) /
            allResults.length,
        )
      : 0;

  const categoryBreakdown: Record<string, number> = {};
  for (const r of allResults) {
    categoryBreakdown[r.category] = (categoryBreakdown[r.category] || 0) + 1;
  }

  console.log(
    `   📊 Summary: ${usefulCount}/${allResults.length} useful (avg: ${avgUsefulness})`,
  );
  console.log(
    `      Categories: ${Object.entries(categoryBreakdown)
      .map(([k, v]) => `${k}:${v}`)
      .join(", ")}`,
  );

  // Build enriched additional_photos with scores merged in
  const enrichedPhotos = (facility.additional_photos || []).map(
    (photo: any) => {
      const photoUrl = getPhotoUrl(photo);
      const analysis = allResults.find((r) => r.url === photoUrl);
      if (analysis) {
        return {
          ...photo,
          usefulness_score: analysis.usefulness_score,
          category: analysis.category,
          description: analysis.description,
        };
      }
      return photo;
    },
  );

  // Build review image analysis array for the new column
  const reviewImageAnalysis = allResults
    .filter((r) => r.source === "review")
    .map((r) => ({
      url: r.url,
      review_index: r.review_index,
      usefulness_score: r.usefulness_score,
      category: r.category,
      description: r.description,
    }));

  // Write to DB
  if (!DRY_RUN) {
    try {
      await sql`
        UPDATE sports_facilities
        SET
          additional_photos = ${sql.json(enrichedPhotos)},
          review_images_analysis = ${sql.json(reviewImageAnalysis)},
          photos_analyzed = true
        WHERE id = ${facility.id}
      `;
      console.log(
        `   💾 Saved to database (additional_photos enriched, review_images_analysis=${reviewImageAnalysis.length} entries, photos_analyzed=true)`,
      );
    } catch (error: any) {
      console.log(`   ❌ DB update failed: ${error.message}`);
      progress.failedCount++;
      progress.processedCount++;
      progress.lastProcessedIndex = index;
      progress.errors.push({
        facility_id: facility.id,
        facility_name: facility.name,
        error: `DB update failed: ${error.message}`,
        timestamp: new Date().toISOString(),
      });
      return;
    }
  } else {
    console.log(
      `   🔍 DRY RUN: Would save enriched additional_photos + review_images_analysis (${reviewImageAnalysis.length} entries) + photos_analyzed=true to database`,
    );
  }

  progress.successCount++;
  progress.processedCount++;
  progress.lastProcessedIndex = index;
  progress.processedFacilityIds.push(facility.id);
}

/**
 * Print progress summary
 */
function printProgressSummary(
  progress: ProgressState,
  total: number,
  startTime: number,
): void {
  const elapsed = (Date.now() - startTime) / 1000 / 60;
  const remaining = total - progress.processedCount;
  const rate = progress.processedCount / elapsed;
  const eta = remaining / rate;

  console.log("\n" + "=".repeat(70));
  console.log("📊 PROGRESS SUMMARY");
  console.log("=".repeat(70));
  console.log(`   Processed: ${progress.processedCount}/${total}`);
  console.log(`   Successful: ${progress.successCount}`);
  console.log(`   Failed: ${progress.failedCount}`);
  console.log(`   Skipped: ${progress.skippedCount}`);
  console.log(`   Total Images Analyzed: ${progress.totalImages}`);
  console.log(`   Gemini API Calls: ${progress.geminiCalls}`);
  console.log(`   Elapsed: ${elapsed.toFixed(1)} min`);
  if (remaining > 0 && rate > 0) {
    console.log(
      `   ETA: ${eta.toFixed(1)} min (~${(eta / 60).toFixed(1)} hrs)`,
    );
  }
  console.log("=".repeat(70));
}

/**
 * Main function
 */
async function analyzeFacilityImages() {
  console.log("🔍 Facility Image Analysis Script (Gemini Vision)");
  console.log("=".repeat(70));

  if (DRY_RUN) {
    console.log("🔍 DRY RUN MODE: No changes will be made to the database");
  }
  if (TEST_LIMIT) {
    console.log(`🧪 TEST MODE: Processing only ${TEST_LIMIT} facilities`);
  }

  console.log(`   Model: ${MODEL_NAME}`);
  console.log(`   Batch size: ${BATCH_SIZE} images per Gemini call`);
  console.log(`   Delay: ${DELAY_BETWEEN_GEMINI_CALLS_MS}ms between calls`);
  console.log("=".repeat(70) + "\n");

  // Load facilities
  console.log("📂 Loading facilities...");
  const query = sql<FacilityRow[]>`
    SELECT id, name, place_id, additional_photos, additional_reviews
    FROM sports_facilities
    WHERE serp_scraped = true AND photos_analyzed = false
    ORDER BY name
  `;

  const facilities = (await query) as FacilityRow[];
  console.log(`✅ Found ${facilities.length} facilities to analyze\n`);

  if (facilities.length === 0) {
    console.log("No facilities need analysis. Done!");
    process.exit(0);
  }

  // Load progress
  const progress = loadProgress();
  if (progress.processedCount > 0) {
    console.log(`♻️  Resuming from previous session:`);
    console.log(`   Processed: ${progress.processedCount}`);
    console.log(`   Images analyzed: ${progress.totalImages}\n`);
  }

  const startTime = Date.now();
  const totalToProcess = TEST_LIMIT
    ? Math.min(TEST_LIMIT, facilities.length)
    : facilities.length;

  console.log(`📸 Processing ${totalToProcess} facilities...\n`);

  for (let i = progress.lastProcessedIndex + 1; i < totalToProcess; i++) {
    await processFacility(facilities[i], progress, i, totalToProcess);
    saveProgress(progress);

    if ((i + 1) % 10 === 0 || i === totalToProcess - 1) {
      printProgressSummary(progress, totalToProcess, startTime);
    }
  }

  // Final summary
  console.log("\n" + "=".repeat(70));
  console.log("🎉 ANALYSIS COMPLETE!");
  console.log("=".repeat(70));
  console.log(`   Facilities Processed: ${progress.processedCount}`);
  console.log(`   Successful: ${progress.successCount}`);
  console.log(`   Failed: ${progress.failedCount}`);
  console.log(`   Skipped: ${progress.skippedCount}`);
  console.log(`   Total Images Analyzed: ${progress.totalImages}`);
  console.log(`   Gemini API Calls: ${progress.geminiCalls}`);
  console.log(
    `   Total Time: ${((Date.now() - startTime) / 1000 / 60).toFixed(1)} min`,
  );

  if (progress.errors.length > 0) {
    console.log(`\n⚠️  Errors (${progress.errors.length}):`);
    progress.errors.slice(0, 10).forEach((err, i) => {
      console.log(`   ${i + 1}. ${err.facility_name}: ${err.error}`);
    });
    if (progress.errors.length > 10) {
      console.log(`   ... and ${progress.errors.length - 10} more`);
    }
  }

  if (DRY_RUN) {
    console.log("\n🔍 This was a DRY RUN. No changes were made.");
  }

  console.log("=".repeat(70));
  await sql.end();
}

analyzeFacilityImages().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
