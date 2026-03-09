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

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

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

const PROGRESS_FILE = path.join(
  __dirname,
  "../.compress-remaining-progress.json",
);
const STORAGE_BUCKET = "facility-photos";

// Configuration
const DRY_RUN = false; // Set to false to apply changes
const WEBP_QUALITY = 80;
const DELAY_BETWEEN_FACILITIES_MS = 500;
const DELAY_BETWEEN_IMAGES_MS = 200;

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
  return (((before - after) / before) * 100).toFixed(1) + "%";
}

function isNonWebP(url: string): boolean {
  return /\.(jpg|jpeg|png)$/i.test(url);
}

function extractStoragePath(publicUrl: string): string | null {
  const match = publicUrl.match(
    /\/storage\/v1\/object\/public\/facility-photos\/(.+)$/,
  );
  return match?.[1] ?? null;
}

/**
 * Load facilities that have at least one non-WebP photo
 */
async function loadFacilitiesWithNonWebPPhotos(): Promise<
  FacilityWithPhotos[]
> {
  console.log("📂 Loading facilities with non-WebP photos...");

  const result = await sql<FacilityWithPhotos[]>`
    SELECT id, name, additional_photos
    FROM sports_facilities
    WHERE serp_scraped = true
      AND additional_photos IS NOT NULL
  `;

  const facilities = (result as FacilityWithPhotos[]).filter((f) => {
    if (!Array.isArray(f.additional_photos) || f.additional_photos.length === 0)
      return false;
    return f.additional_photos.some((photo) => isNonWebP(photo.url));
  });

  const totalNonWebP = facilities.reduce(
    (sum, f) =>
      sum + f.additional_photos.filter((p) => isNonWebP(p.url)).length,
    0,
  );

  console.log(`✅ Found ${facilities.length} facilities with non-WebP photos`);
  console.log(`   Total non-WebP images to process: ${totalNonWebP}`);

  return facilities;
}

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

    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error: any) {
    console.log(`     ⚠️  Exception during download: ${error.message}`);
    return null;
  }
}

async function compressImageToWebP(imageBuffer: Buffer): Promise<{
  buffer: Buffer;
  originalSize: number;
  compressedSize: number;
} | null> {
  try {
    const originalSize = imageBuffer.length;
    const compressedBuffer = await sharp(imageBuffer)
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();
    return {
      buffer: compressedBuffer,
      originalSize,
      compressedSize: compressedBuffer.length,
    };
  } catch (error: any) {
    console.log(`     ⚠️  Compression error: ${error.message}`);
    return null;
  }
}

async function uploadCompressedImage(
  originalPath: string,
  compressedBuffer: Buffer,
): Promise<{ url: string | null; deletionSucceeded: boolean }> {
  try {
    const newPath = originalPath.replace(/\.(jpg|jpeg|png)$/i, ".webp");

    const { error } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .upload(newPath, compressedBuffer, {
        contentType: "image/webp",
        upsert: true,
      });

    if (error) {
      console.log(`     ⚠️  Upload error: ${error.message}`);
      return { url: null, deletionSucceeded: false };
    }

    const { data: urlData } = supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(newPath);

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

async function processImage(
  imageUrl: string,
  facilityId: string,
  facilityName: string,
  imageIndex: number,
  progress: ProgressState,
): Promise<{ success: boolean; newUrl?: string }> {
  console.log(
    `     [${imageIndex + 1}] Processing: ${imageUrl.substring(imageUrl.length - 50)}`,
  );

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

  // Download
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

  // Compress
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

  console.log(
    `     ✓ Compressed: ${formatBytes(compressed.originalSize)} → ${formatBytes(compressed.compressedSize)} (${calculateCompressionRatio(compressed.originalSize, compressed.compressedSize)} reduction)`,
  );

  progress.totalBytesBefore += compressed.originalSize;
  progress.totalBytesAfter += compressed.compressedSize;

  if (DRY_RUN) {
    console.log(`     🔍 DRY RUN: Would upload compressed image`);
    progress.imagesProcessed++;
    return { success: true, newUrl: imageUrl };
  }

  // Upload and delete original
  const uploadResult = await uploadCompressedImage(
    storagePath,
    compressed.buffer,
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

  if (uploadResult.deletionSucceeded) {
    progress.deletionsSucceeded++;
  } else {
    progress.deletionsFailed++;
  }

  console.log(
    `     ✓ Uploaded: ${uploadResult.url.substring(uploadResult.url.length - 50)}`,
  );
  progress.imagesProcessed++;

  return { success: true, newUrl: uploadResult.url };
}

async function processFacility(
  facility: FacilityWithPhotos,
  progress: ProgressState,
  index: number,
  total: number,
): Promise<void> {
  console.log(`\n[${index + 1}/${total}] ${facility.name} (${facility.id})`);

  if (progress.processedFacilityIds.includes(facility.id)) {
    console.log(`   ⏭️  Already processed, skipping`);
    progress.skippedCount++;
    return;
  }

  const nonWebPPhotos = facility.additional_photos.filter((p) =>
    isNonWebP(p.url),
  );
  console.log(
    `   ${nonWebPPhotos.length} non-WebP / ${facility.additional_photos.length} total photos`,
  );

  const updatedPhotos: PhotoData[] = [];
  let facilitySuccess = true;

  for (let i = 0; i < facility.additional_photos.length; i++) {
    const photo = facility.additional_photos[i];

    // Skip already-WebP photos
    if (!isNonWebP(photo.url)) {
      updatedPhotos.push(photo);
      progress.imagesSkipped++;
      continue;
    }

    const result = await processImage(
      photo.url,
      facility.id,
      facility.name,
      i,
      progress,
    );

    if (result.success && result.newUrl) {
      updatedPhotos.push({ url: result.newUrl, thumbnail: result.newUrl });
    } else {
      facilitySuccess = false;
      updatedPhotos.push(photo); // Keep original on failure
    }

    if (i < facility.additional_photos.length - 1) {
      await delay(DELAY_BETWEEN_IMAGES_MS);
    }
  }

  // Update database with new URLs (use direct SQL to bypass row limit)
  if (!DRY_RUN && updatedPhotos.length > 0) {
    console.log(`   💾 Updating database...`);
    try {
      await sql`
        UPDATE sports_facilities
        SET additional_photos = ${sql.json(updatedPhotos as any)}
        WHERE id = ${facility.id}
      `;
      console.log(`   ✓ Database updated`);
    } catch (error: any) {
      console.log(`   ⚠️  Database update error: ${error.message}`);
      progress.failedCount++;
      facilitySuccess = false;
    }
  }

  if (facilitySuccess) {
    console.log(`   ✅ Done`);
    progress.successCount++;
  } else {
    console.log(`   ⚠️  Completed with errors`);
    progress.failedCount++;
  }

  progress.processedCount++;
  progress.processedFacilityIds.push(facility.id);
}

async function main() {
  console.log("🚀 Compress Remaining Non-WebP Photos");
  console.log("=".repeat(70));

  if (DRY_RUN) {
    console.log("🔍 DRY RUN MODE: No changes will be made\n");
  }

  const facilities = await loadFacilitiesWithNonWebPPhotos();

  if (facilities.length === 0) {
    console.log("✅ No facilities with non-WebP photos found. All done!");
    await sql.end();
    process.exit(0);
  }

  const progress = loadProgress();

  if (progress.processedCount > 0) {
    console.log(`\n♻️  Resuming: ${progress.processedCount} already processed`);
    console.log(`   Images done: ${progress.imagesProcessed}`);
    console.log(
      `   Space saved so far: ${formatBytes(progress.totalBytesBefore - progress.totalBytesAfter)}\n`,
    );
  }

  const startTime = Date.now();

  for (let i = 0; i < facilities.length; i++) {
    await processFacility(facilities[i], progress, i, facilities.length);
    saveProgress(progress);

    if ((i + 1) % 10 === 0 || i === facilities.length - 1) {
      const elapsed = (Date.now() - startTime) / 1000 / 60;
      const remaining = facilities.length - (i + 1);
      const rate = (i + 1) / elapsed;

      console.log("\n" + "-".repeat(50));
      console.log(
        `📊 Progress: ${i + 1}/${facilities.length} | Images: ${progress.imagesProcessed} processed, ${progress.imagesFailed} failed`,
      );
      console.log(
        `   Saved: ${formatBytes(progress.totalBytesBefore - progress.totalBytesAfter)} (${calculateCompressionRatio(progress.totalBytesBefore, progress.totalBytesAfter)})`,
      );
      if (remaining > 0 && rate > 0) {
        console.log(
          `   ETA: ${(remaining / rate).toFixed(1)} min | Elapsed: ${elapsed.toFixed(1)} min`,
        );
      }
      console.log("-".repeat(50));
    }

    if (i < facilities.length - 1) {
      await delay(DELAY_BETWEEN_FACILITIES_MS);
    }
  }

  // Final summary
  console.log("\n" + "=".repeat(70));
  console.log("🎉 COMPLETE!");
  console.log("=".repeat(70));
  console.log(
    `   Facilities: ${progress.successCount} success, ${progress.failedCount} failed, ${progress.skippedCount} skipped`,
  );
  console.log(
    `   Images: ${progress.imagesProcessed} processed, ${progress.imagesSkipped} skipped, ${progress.imagesFailed} failed`,
  );
  console.log(
    `   Deletions: ${progress.deletionsSucceeded} ok, ${progress.deletionsFailed} failed`,
  );
  console.log(
    `   Size: ${formatBytes(progress.totalBytesBefore)} → ${formatBytes(progress.totalBytesAfter)} (${calculateCompressionRatio(progress.totalBytesBefore, progress.totalBytesAfter)} saved)`,
  );
  console.log(
    `   Time: ${((Date.now() - startTime) / 1000 / 60).toFixed(1)} minutes`,
  );

  if (progress.errors.length > 0) {
    console.log(
      `\n⚠️  ${progress.errors.length} errors (see ${PROGRESS_FILE})`,
    );
    progress.errors.slice(0, 5).forEach((e, i) => {
      console.log(`   ${i + 1}. ${e.facility_name}: ${e.error}`);
    });
  }

  if (DRY_RUN) {
    console.log("\n🔍 DRY RUN — set DRY_RUN = false to apply changes.");
  }

  console.log("=".repeat(70));
  await sql.end();
}

main().catch(async (error) => {
  console.error("❌ Fatal error:", error);
  await sql.end();
  process.exit(1);
});
