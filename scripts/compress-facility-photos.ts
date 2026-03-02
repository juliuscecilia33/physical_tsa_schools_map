import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import sharp from "sharp";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: path.join(__dirname, "../.env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const databaseUrl = process.env.DATABASE_URL!;

if (!supabaseUrl || !supabaseServiceKey || !databaseUrl) {
  console.error("❌ Error: Missing required environment variables");
  console.error(
    "   Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL",
  );
  process.exit(1);
}

// Service role client for storage operations only
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Direct Postgres connection for database queries (bypasses REST API 1000-row limit)
const sql = postgres(databaseUrl, {
  prepare: false,
  ssl: { rejectUnauthorized: false },
  max: 10,
});

interface PhotoData {
  url: string;
  thumbnail: string;
}

interface FacilityWithPhotos {
  id: string;
  name: string;
  additional_photos: PhotoData[];
}

interface ProgressState {
  processedCount: number;
  successCount: number;
  failedCount: number;
  skippedCount: number;
  processedFacilityIds: string[];
  lastProcessedIndex: number;
  imagesProcessed: number;
  imagesSkipped: number;
  imagesFailed: number;
  deletionsSucceeded: number;
  deletionsFailed: number;
  totalBytesBefore: number;
  totalBytesAfter: number;
  lastUpdated: string;
  errors: Array<{
    facility_id: string;
    facility_name: string;
    image_url: string;
    error: string;
    timestamp: string;
  }>;
}

const PROGRESS_FILE = path.join(__dirname, "../.compress-progress.json");
const STORAGE_BUCKET = "facility-photos";

// Configuration
const DRY_RUN = false; // Set to true to preview without making changes
const WEBP_QUALITY = 80; // Quality setting (0-100)
const DELAY_BETWEEN_FACILITIES_MS = 500; // Delay between facilities
const DELAY_BETWEEN_IMAGES_MS = 200; // Delay between images
const TEST_LIMIT: number | null = null; // Set to a number to test on limited facilities

// Helper functions
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function loadProgress(): ProgressState {
  if (fs.existsSync(PROGRESS_FILE)) {
    const data = fs.readFileSync(PROGRESS_FILE, "utf-8");
    const progress = JSON.parse(data);
    // Add new fields if they don't exist (for backwards compatibility)
    if (progress.deletionsSucceeded === undefined)
      progress.deletionsSucceeded = 0;
    if (progress.deletionsFailed === undefined) progress.deletionsFailed = 0;
    return progress;
  }
  return {
    processedCount: 0,
    successCount: 0,
    failedCount: 0,
    skippedCount: 0,
    processedFacilityIds: [],
    lastProcessedIndex: -1,
    imagesProcessed: 0,
    imagesSkipped: 0,
    imagesFailed: 0,
    deletionsSucceeded: 0,
    deletionsFailed: 0,
    totalBytesBefore: 0,
    totalBytesAfter: 0,
    lastUpdated: new Date().toISOString(),
    errors: [],
  };
}

function saveProgress(progress: ProgressState) {
  progress.lastUpdated = new Date().toISOString();
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function calculateCompressionRatio(before: number, after: number): string {
  if (before === 0) return "0%";
  const ratio = ((before - after) / before) * 100;
  return ratio.toFixed(1) + "%";
}

/**
 * Load all facilities that have photos to compress
 * Uses direct Postgres connection to bypass Supabase REST API 1000-row limit
 */
async function loadFacilitiesWithPhotos(): Promise<FacilityWithPhotos[]> {
  console.log("📂 Loading facilities with photos from database...");

  try {
    // Use direct SQL query to bypass 1000-row limit
    const result = await sql<FacilityWithPhotos[]>`
      SELECT id, name, additional_photos
      FROM sports_facilities
      WHERE serp_scraped = true
    `;

    const facilities = result as FacilityWithPhotos[];

    // Count how many have photos for diagnostics
    const facilitiesWithPhotos = facilities.filter(
      (f) =>
        f.additional_photos &&
        Array.isArray(f.additional_photos) &&
        f.additional_photos.length > 0,
    );

    console.log(
      `✅ Loaded ${facilities.length} facilities with serp_scraped=true`,
    );
    console.log(
      `   ${facilitiesWithPhotos.length} have photos, ${facilities.length - facilitiesWithPhotos.length} have no photos (will be skipped)`,
    );

    return facilities;
  } catch (error: any) {
    console.error("❌ Error loading facilities:", error.message);
    process.exit(1);
  }
}

/**
 * Extract storage path from Supabase public URL
 */
function extractStoragePath(publicUrl: string): string | null {
  try {
    // Extract path after /storage/v1/object/public/facility-photos/
    const match = publicUrl.match(
      /\/storage\/v1\/object\/public\/facility-photos\/(.+)$/,
    );
    if (match && match[1]) {
      return match[1];
    }
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Download image from Supabase Storage
 */
async function downloadImageFromStorage(
  storagePath: string,
): Promise<Buffer | null> {
  try {
    const { data, error } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .download(storagePath);

    if (error) {
      console.log(`     ⚠️  Download error: ${error.message}`);
      return null;
    }

    // Convert Blob to Buffer
    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error: any) {
    console.log(`     ⚠️  Exception during download: ${error.message}`);
    return null;
  }
}

/**
 * Compress image to WebP format using Sharp
 */
async function compressImageToWebP(imageBuffer: Buffer): Promise<{
  buffer: Buffer;
  originalSize: number;
  compressedSize: number;
} | null> {
  try {
    const originalSize = imageBuffer.length;

    // Compress to WebP with specified quality
    const compressedBuffer = await sharp(imageBuffer)
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();

    const compressedSize = compressedBuffer.length;

    return {
      buffer: compressedBuffer,
      originalSize,
      compressedSize,
    };
  } catch (error: any) {
    console.log(`     ⚠️  Compression error: ${error.message}`);
    return null;
  }
}

/**
 * Upload compressed image back to Supabase Storage
 */
async function uploadCompressedImage(
  originalPath: string,
  compressedBuffer: Buffer,
): Promise<{ url: string | null; deletionSucceeded: boolean }> {
  try {
    // Generate new path with .webp extension
    const newPath = originalPath.replace(/\.(jpg|jpeg|png|webp)$/i, ".webp");

    // Upload compressed image first
    const { error } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .upload(newPath, compressedBuffer, {
        contentType: "image/webp",
        upsert: true, // Overwrite if exists
      });

    if (error) {
      console.log(`     ⚠️  Upload error: ${error.message}`);
      return { url: null, deletionSucceeded: false };
    }

    // Get new public URL
    const { data: urlData } = supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(newPath);

    // Now delete old file (only if upload succeeded and files are different)
    let deletionSucceeded = true;
    if (originalPath !== newPath) {
      const { error: deleteError } = await supabaseAdmin.storage
        .from(STORAGE_BUCKET)
        .remove([originalPath]);

      if (deleteError) {
        console.log(
          `     ❌  Deletion FAILED for ${originalPath}: ${deleteError.message}`,
        );
        deletionSucceeded = false;
      } else {
        console.log(`     ✓ Deleted original: ${originalPath}`);
      }
    }

    return { url: urlData.publicUrl, deletionSucceeded };
  } catch (error: any) {
    console.log(`     ⚠️  Exception during upload: ${error.message}`);
    return { url: null, deletionSucceeded: false };
  }
}

/**
 * Process a single image: download, compress, re-upload
 */
async function processImage(
  imageUrl: string,
  facilityId: string,
  facilityName: string,
  imageIndex: number,
  progress: ProgressState,
): Promise<{
  success: boolean;
  newUrl?: string;
  originalSize?: number;
  compressedSize?: number;
}> {
  console.log(
    `     [${imageIndex + 1}] Processing: ${imageUrl.substring(imageUrl.length - 40)}`,
  );

  // Extract storage path
  const storagePath = extractStoragePath(imageUrl);
  if (!storagePath) {
    console.log(`     ⚠️  Could not extract storage path from URL`);
    progress.imagesFailed++;
    progress.errors.push({
      facility_id: facilityId,
      facility_name: facilityName,
      image_url: imageUrl,
      error: "Could not extract storage path",
      timestamp: new Date().toISOString(),
    });
    return { success: false };
  }

  // Skip if already WebP
  if (storagePath.toLowerCase().endsWith(".webp")) {
    console.log(`     ⏭️  Already WebP, skipping`);
    progress.imagesSkipped++;
    return { success: true, newUrl: imageUrl };
  }

  // Download image
  const imageBuffer = await downloadImageFromStorage(storagePath);
  if (!imageBuffer) {
    progress.imagesFailed++;
    progress.errors.push({
      facility_id: facilityId,
      facility_name: facilityName,
      image_url: imageUrl,
      error: "Failed to download image",
      timestamp: new Date().toISOString(),
    });
    return { success: false };
  }

  // Compress image
  const compressed = await compressImageToWebP(imageBuffer);
  if (!compressed) {
    progress.imagesFailed++;
    progress.errors.push({
      facility_id: facilityId,
      facility_name: facilityName,
      image_url: imageUrl,
      error: "Failed to compress image",
      timestamp: new Date().toISOString(),
    });
    return { success: false };
  }

  const { buffer: compressedBuffer, originalSize, compressedSize } = compressed;

  console.log(
    `     ✓ Compressed: ${formatBytes(originalSize)} → ${formatBytes(compressedSize)} (${calculateCompressionRatio(originalSize, compressedSize)} reduction)`,
  );

  // Update progress stats
  progress.totalBytesBefore += originalSize;
  progress.totalBytesAfter += compressedSize;

  if (DRY_RUN) {
    console.log(`     🔍 DRY RUN: Would upload compressed image`);
    progress.imagesProcessed++;
    return { success: true, newUrl: imageUrl, originalSize, compressedSize };
  }

  // Upload compressed image and delete original
  const uploadResult = await uploadCompressedImage(
    storagePath,
    compressedBuffer,
  );
  if (!uploadResult.url) {
    progress.imagesFailed++;
    progress.errors.push({
      facility_id: facilityId,
      facility_name: facilityName,
      image_url: imageUrl,
      error: "Failed to upload compressed image",
      timestamp: new Date().toISOString(),
    });
    return { success: false };
  }

  // Track deletion success/failure
  if (uploadResult.deletionSucceeded) {
    progress.deletionsSucceeded++;
  } else {
    progress.deletionsFailed++;
  }

  console.log(
    `     ✓ Uploaded: ${uploadResult.url.substring(uploadResult.url.length - 40)}`,
  );
  progress.imagesProcessed++;

  return {
    success: true,
    newUrl: uploadResult.url,
    originalSize,
    compressedSize,
  };
}

/**
 * Process all images for a single facility
 */
async function processFacility(
  facility: FacilityWithPhotos,
  progress: ProgressState,
  index: number,
  total: number,
): Promise<void> {
  console.log(
    `\n[${index + 1}/${total}] Processing facility: ${facility.name}`,
  );
  console.log(`   ID: ${facility.id}`);

  // Check if already processed
  if (progress.processedFacilityIds.includes(facility.id)) {
    console.log(`   ⏭️  Already processed, skipping...`);
    progress.skippedCount++;
    return;
  }

  // Skip if no photos
  if (
    !facility.additional_photos ||
    !Array.isArray(facility.additional_photos) ||
    facility.additional_photos.length === 0
  ) {
    console.log(`   ⏭️  No photos to compress, skipping...`);
    progress.skippedCount++;
    progress.processedCount++;
    progress.lastProcessedIndex = index;
    progress.processedFacilityIds.push(facility.id);
    return;
  }

  console.log(`   Photos: ${facility.additional_photos.length}`);

  const updatedPhotos: PhotoData[] = [];
  let facilitySuccess = true;

  // Process each photo
  for (let i = 0; i < facility.additional_photos.length; i++) {
    const photo = facility.additional_photos[i];

    // Process main image
    const result = await processImage(
      photo.url,
      facility.id,
      facility.name,
      i,
      progress,
    );

    if (result.success && result.newUrl) {
      updatedPhotos.push({
        url: result.newUrl,
        thumbnail: result.newUrl, // Use same URL for thumbnail
      });
    } else {
      facilitySuccess = false;
      // Keep original if processing failed
      updatedPhotos.push(photo);
    }

    // Delay between images
    if (i < facility.additional_photos.length - 1) {
      await delay(DELAY_BETWEEN_IMAGES_MS);
    }
  }

  // Update database with new URLs
  if (!DRY_RUN && updatedPhotos.length > 0) {
    console.log(`   💾 Updating database...`);
    const { error } = await supabaseAdmin
      .from("sports_facilities")
      .update({ additional_photos: updatedPhotos })
      .eq("id", facility.id);

    if (error) {
      console.log(`   ⚠️  Database update error: ${error.message}`);
      progress.failedCount++;
      facilitySuccess = false;
    } else {
      console.log(`   ✓ Database updated`);
    }
  }

  if (facilitySuccess) {
    console.log(`   ✅ Facility complete!`);
    progress.successCount++;
    progress.processedFacilityIds.push(facility.id);
  } else {
    console.log(`   ⚠️  Facility completed with errors`);
    progress.failedCount++;
  }

  progress.processedCount++;
  progress.lastProcessedIndex = index;
}

/**
 * Print progress summary
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
  console.log("   " + "-".repeat(68));
  console.log(`   Images Processed: ${progress.imagesProcessed}`);
  console.log(`   Images Skipped: ${progress.imagesSkipped}`);
  console.log(`   Images Failed: ${progress.imagesFailed}`);
  console.log(`   Deletions Succeeded: ${progress.deletionsSucceeded}`);
  console.log(`   Deletions Failed: ${progress.deletionsFailed}`);
  console.log("   " + "-".repeat(68));
  console.log(`   Original Size: ${formatBytes(progress.totalBytesBefore)}`);
  console.log(`   Compressed Size: ${formatBytes(progress.totalBytesAfter)}`);
  console.log(
    `   Space Saved: ${formatBytes(progress.totalBytesBefore - progress.totalBytesAfter)} (${calculateCompressionRatio(progress.totalBytesBefore, progress.totalBytesAfter)})`,
  );
  console.log("   " + "-".repeat(68));
  console.log(`   Elapsed Time: ${elapsed.toFixed(1)} minutes`);
  if (remaining > 0 && rate > 0) {
    console.log(
      `   ETA: ${eta.toFixed(1)} minutes (~${(eta / 60).toFixed(1)} hours)`,
    );
    console.log(`   Rate: ${rate.toFixed(2)} facilities/minute`);
  }
  console.log("=".repeat(70));
}

/**
 * Main function
 */
async function compressFacilityPhotos() {
  console.log("🚀 Facility Photos Compression Script");
  console.log("=".repeat(70));

  if (DRY_RUN) {
    console.log("🔍 DRY RUN MODE: No changes will be made");
    console.log("   Set DRY_RUN = false to apply changes");
  }

  if (TEST_LIMIT) {
    console.log(`🧪 TEST MODE: Processing only ${TEST_LIMIT} facilities`);
    console.log("   Set TEST_LIMIT = null to process all");
  }

  console.log("\n📋 This script will:");
  console.log("   • Load all facilities with photos from database");
  console.log(
    "   • For each photo: Download → Compress to WebP (80% quality) → Re-upload",
  );
  console.log(
    "   • Overwrite original images (same storage paths with .webp extension)",
  );
  console.log("   • Update database with new WebP URLs");
  console.log("   • Track progress for resumable operation");
  console.log("\n⚠️  Important:");
  console.log("   • WebP format at 80% quality typically saves 25-40% storage");
  console.log("   • Original images will be replaced (no rollback)");
  console.log(
    "   • Original SerpAPI URLs preserved in additional_photos_original",
  );
  console.log("=".repeat(70) + "\n");

  // Load facilities
  const facilities = await loadFacilitiesWithPhotos();

  if (facilities.length === 0) {
    console.log("❌ No facilities with photos found");
    process.exit(0);
  }

  // Load progress
  const progress = loadProgress();

  if (progress.processedCount > 0) {
    console.log("♻️  Resuming from previous session:");
    console.log(`   Last processed index: ${progress.lastProcessedIndex}`);
    console.log(
      `   Processed: ${progress.processedCount}/${facilities.length}`,
    );
    console.log(`   Images processed: ${progress.imagesProcessed}`);
    console.log(
      `   Space saved so far: ${formatBytes(progress.totalBytesBefore - progress.totalBytesAfter)}\n`,
    );
  }

  const startTime = Date.now();

  // Determine how many facilities to process
  const totalToProcess = TEST_LIMIT
    ? Math.min(TEST_LIMIT, facilities.length)
    : facilities.length;

  console.log(`📸 Processing ${totalToProcess} facilities...\n`);

  // Process each facility
  for (let i = progress.lastProcessedIndex + 1; i < totalToProcess; i++) {
    const facility = facilities[i];

    await processFacility(facility, progress, i, totalToProcess);

    // Save progress after each facility
    saveProgress(progress);

    // Print summary every 10 facilities
    if ((i + 1) % 10 === 0 || i === totalToProcess - 1) {
      printProgressSummary(progress, totalToProcess, startTime);
    }

    // Rate limiting delay
    if (i < totalToProcess - 1) {
      await delay(DELAY_BETWEEN_FACILITIES_MS);
    }
  }

  // Final summary
  console.log("\n" + "=".repeat(70));
  console.log("🎉 COMPRESSION COMPLETE!");
  console.log("=".repeat(70));
  console.log(`   Total Facilities: ${progress.processedCount}`);
  console.log(`   Successful: ${progress.successCount}`);
  console.log(`   Failed: ${progress.failedCount}`);
  console.log(`   Skipped: ${progress.skippedCount}`);
  console.log("   " + "-".repeat(68));
  console.log(`   Images Processed: ${progress.imagesProcessed}`);
  console.log(`   Images Skipped: ${progress.imagesSkipped}`);
  console.log(`   Images Failed: ${progress.imagesFailed}`);
  console.log(`   Deletions Succeeded: ${progress.deletionsSucceeded}`);
  console.log(`   Deletions Failed: ${progress.deletionsFailed}`);
  console.log("   " + "-".repeat(68));
  console.log(
    `   Original Total Size: ${formatBytes(progress.totalBytesBefore)}`,
  );
  console.log(
    `   Compressed Total Size: ${formatBytes(progress.totalBytesAfter)}`,
  );
  console.log(
    `   Total Space Saved: ${formatBytes(progress.totalBytesBefore - progress.totalBytesAfter)}`,
  );
  console.log(
    `   Compression Ratio: ${calculateCompressionRatio(progress.totalBytesBefore, progress.totalBytesAfter)}`,
  );
  console.log("   " + "-".repeat(68));
  console.log(
    `   Total Time: ${((Date.now() - startTime) / 1000 / 60).toFixed(1)} minutes`,
  );

  if (progress.errors.length > 0) {
    console.log(`\n⚠️  Errors (${progress.errors.length}):`);
    progress.errors.slice(0, 10).forEach((error, index) => {
      console.log(
        `   ${index + 1}. ${error.facility_name} - ${error.image_url.substring(error.image_url.length - 40)}`,
      );
      console.log(`      Error: ${error.error}`);
    });
    if (progress.errors.length > 10) {
      console.log(`   ... and ${progress.errors.length - 10} more`);
    }
    console.log(`   Full error log saved in: ${PROGRESS_FILE}`);
  }

  console.log("\n✅ All facility photos have been compressed!");
  console.log("=".repeat(70));

  // Warn about deletion failures
  if (progress.deletionsFailed > 0) {
    console.log("\n⚠️  IMPORTANT: Deletion Failures Detected!");
    console.log(
      `   ${progress.deletionsFailed} original files could not be deleted.`,
    );
    console.log("   This means your storage has BOTH old and new files.");
    console.log("\n   Possible causes:");
    console.log("   • Storage RLS policies blocking deletions");
    console.log("   • Permission issues");
    console.log("   • Temporary S3 errors");
    console.log("\n   Next steps:");
    console.log("   1. Check Supabase Storage policies");
    console.log("   2. Verify service role key has delete permissions");
    console.log("   3. Wait 24 hours for storage metrics to update");
    console.log("   4. Run a cleanup script to remove orphaned originals");
  } else {
    console.log("\n✅ All original files deleted successfully!");
    console.log(
      "   Note: Storage dashboard may take up to 24 hours to reflect space savings.",
    );
  }

  if (DRY_RUN) {
    console.log("\n🔍 This was a DRY RUN. No changes were made.");
    console.log("   Set DRY_RUN = false to apply changes.");
  }
}

compressFacilityPhotos().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
