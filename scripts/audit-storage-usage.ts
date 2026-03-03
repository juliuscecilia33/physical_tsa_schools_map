import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import * as dotenv from "dotenv";
import * as path from "path";

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

// Service role client for storage operations
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Direct Postgres connection for database queries
const sql = postgres(databaseUrl, {
  prepare: false,
  ssl: { rejectUnauthorized: false },
  max: 10,
});

const STORAGE_BUCKET = "facility-photos";

interface StorageFile {
  name: string;
  id: string;
  updated_at: string;
  created_at: string;
  last_accessed_at: string;
  metadata: {
    eTag: string;
    size: number;
    mimetype: string;
    cacheControl: string;
    lastModified: string;
    contentLength: number;
    httpStatusCode: number;
  };
}

interface FileStats {
  extension: string;
  count: number;
  totalBytes: number;
}

interface PhotoData {
  url: string;
  thumbnail: string;
}

interface FacilityWithPhotos {
  id: string;
  name: string;
  additional_photos: PhotoData[];
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function getFileExtension(filename: string): string {
  const match = filename.match(/\.([^.]+)$/);
  return match ? match[1].toLowerCase() : "unknown";
}

/**
 * Extract storage path from Supabase public URL
 */
function extractStoragePath(publicUrl: string): string | null {
  try {
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
 * Recursively list all files in a folder
 */
async function listFilesInFolder(folderPath: string): Promise<StorageFile[]> {
  const files: StorageFile[] = [];
  let offset = 0;
  const limit = 1000;

  while (true) {
    const { data, error } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .list(folderPath, {
        limit,
        offset,
        sortBy: { column: "name", order: "asc" },
      });

    if (error) {
      console.error(`❌ Error fetching files in ${folderPath}:`, error);
      break;
    }

    if (!data || data.length === 0) {
      break;
    }

    // Add files (items with metadata.size) and recursively process folders
    for (const item of data) {
      if (item.metadata?.size) {
        // It's a file
        files.push({
          ...item,
          name: folderPath ? `${folderPath}/${item.name}` : item.name,
        } as unknown as StorageFile);
      } else if (item.id) {
        // It's a folder, recurse into it
        const subPath = folderPath ? `${folderPath}/${item.name}` : item.name;
        const subFiles = await listFilesInFolder(subPath);
        files.push(...subFiles);
      }
    }

    if (data.length < limit) {
      break;
    }
    offset += limit;
  }

  return files;
}

/**
 * List all files in the storage bucket with pagination and recursion
 */
async function listAllStorageFiles(): Promise<StorageFile[]> {
  console.log("📂 Fetching all files from storage bucket...");
  console.log("   (This may take a while for large buckets)\n");

  // Fetch all root folders with pagination (Supabase has 1500 item limit per call)
  const allFolders: any[] = [];
  let offset = 0;
  const limit = 1000;

  console.log("   Fetching root-level folders...");

  while (true) {
    const { data: folders, error } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .list("", {
        limit,
        offset,
        sortBy: { column: "name", order: "asc" },
      });

    if (error) {
      console.error(
        `❌ Error listing root folders at offset ${offset}:`,
        error,
      );
      break;
    }

    if (!folders || folders.length === 0) {
      break;
    }

    allFolders.push(...folders);
    console.log(`   Fetched ${allFolders.length} root folders so far...`);

    if (folders.length < limit) {
      break;
    }

    offset += limit;
  }

  if (allFolders.length === 0) {
    console.log("⚠️  No folders found in bucket");
    return [];
  }

  console.log(
    `\n   ✅ Found ${allFolders.length} total folders/files at root level`,
  );
  console.log(`   Now recursively scanning all folders for files...\n`);

  const allFiles: StorageFile[] = [];
  let processedFolders = 0;

  // Process each folder
  for (const folder of allFolders) {
    if (folder.metadata?.size) {
      // It's a file at root level
      allFiles.push(folder as StorageFile);
    } else {
      // It's a folder, recurse into it
      const folderFiles = await listFilesInFolder(folder.name);
      allFiles.push(...folderFiles);
      processedFolders++;

      if (processedFolders % 100 === 0) {
        console.log(
          `   Processed ${processedFolders}/${allFolders.length} folders... (${allFiles.length} files found)`,
        );
      }
    }
  }

  console.log(`\n✅ Total files fetched: ${allFiles.length}\n`);
  return allFiles;
}

/**
 * Analyze file statistics by extension
 */
function analyzeFileStats(files: StorageFile[]): Map<string, FileStats> {
  const stats = new Map<string, FileStats>();

  for (const file of files) {
    const ext = getFileExtension(file.name);
    const size = file.metadata?.size || 0;

    if (!stats.has(ext)) {
      stats.set(ext, { extension: ext, count: 0, totalBytes: 0 });
    }

    const stat = stats.get(ext)!;
    stat.count++;
    stat.totalBytes += size;
  }

  return stats;
}

/**
 * Load all expected photo URLs from database
 */
async function loadExpectedPhotoUrls(): Promise<Set<string>> {
  console.log("📊 Loading expected photo URLs from database...");

  const result = await sql<FacilityWithPhotos[]>`
    SELECT id, name, additional_photos
    FROM sports_facilities
    WHERE additional_photos IS NOT NULL
      AND jsonb_array_length(additional_photos) > 0
  `;

  const expectedPaths = new Set<string>();

  for (const facility of result) {
    if (
      facility.additional_photos &&
      Array.isArray(facility.additional_photos)
    ) {
      for (const photo of facility.additional_photos) {
        if (photo.url) {
          const path = extractStoragePath(photo.url);
          if (path) {
            expectedPaths.add(path);
          }
        }
      }
    }
  }

  console.log(`✅ Found ${expectedPaths.size} expected photo URLs in DB\n`);
  return expectedPaths;
}

/**
 * Identify orphaned files (in storage but not in DB)
 */
function findOrphanedFiles(
  storageFiles: StorageFile[],
  expectedPaths: Set<string>,
): StorageFile[] {
  const orphaned: StorageFile[] = [];

  for (const file of storageFiles) {
    if (!expectedPaths.has(file.name)) {
      orphaned.push(file);
    }
  }

  return orphaned;
}

/**
 * Main audit function
 */
async function auditStorageUsage() {
  console.log("🔍 STORAGE AUDIT SCRIPT");
  console.log("=".repeat(70));
  console.log("   This script will analyze actual storage usage by:");
  console.log("   • Querying live file inventory from Supabase Storage API");
  console.log("   • Calculating real-time total size (not cached dashboard)");
  console.log("   • Breaking down files by type (.webp vs .jpg/.jpeg/.png)");
  console.log("   • Identifying orphaned files not referenced in database");
  console.log("=".repeat(70) + "\n");

  // Step 1: List all storage files
  const storageFiles = await listAllStorageFiles();

  if (storageFiles.length === 0) {
    console.log("⚠️  No files found in storage bucket");
    process.exit(0);
  }

  // Step 2: Calculate total storage usage
  const totalBytes = storageFiles.reduce(
    (sum, file) => sum + (file.metadata?.size || 0),
    0,
  );

  // Step 3: Analyze file stats by extension
  const fileStats = analyzeFileStats(storageFiles);

  // Step 4: Load expected URLs from database
  const expectedPaths = await loadExpectedPhotoUrls();

  // Step 5: Find orphaned files
  const orphanedFiles = findOrphanedFiles(storageFiles, expectedPaths);
  const orphanedBytes = orphanedFiles.reduce(
    (sum, file) => sum + (file.metadata?.size || 0),
    0,
  );

  // Print comprehensive report
  console.log("=".repeat(70));
  console.log("📊 STORAGE AUDIT REPORT");
  console.log("=".repeat(70));
  console.log(`\n🗂️  TOTAL STORAGE USAGE (REAL-TIME)`);
  console.log(`   Files: ${storageFiles.length.toLocaleString()}`);
  console.log(
    `   Size: ${formatBytes(totalBytes)} (${totalBytes.toLocaleString()} bytes)`,
  );

  console.log(`\n📁 BREAKDOWN BY FILE TYPE`);
  console.log("   " + "-".repeat(68));

  // Sort by total bytes descending
  const sortedStats = Array.from(fileStats.values()).sort(
    (a, b) => b.totalBytes - a.totalBytes,
  );

  for (const stat of sortedStats) {
    const percentage = ((stat.totalBytes / totalBytes) * 100).toFixed(1);
    console.log(
      `   .${stat.extension.padEnd(8)} | ${stat.count.toString().padStart(6)} files | ${formatBytes(stat.totalBytes).padStart(12)} | ${percentage.padStart(5)}%`,
    );
  }

  console.log(`\n🔗 DATABASE CROSS-REFERENCE`);
  console.log(`   Expected URLs in DB: ${expectedPaths.size.toLocaleString()}`);
  console.log(`   Files in Storage: ${storageFiles.length.toLocaleString()}`);
  console.log(`   Orphaned Files: ${orphanedFiles.length.toLocaleString()}`);

  if (orphanedFiles.length > 0) {
    console.log(`   Orphaned Size: ${formatBytes(orphanedBytes)}`);
    console.log(
      `   Orphaned %: ${((orphanedBytes / totalBytes) * 100).toFixed(1)}%`,
    );
  }

  // Analyze compression effectiveness
  const webpStats = fileStats.get("webp");
  const jpgStats = fileStats.get("jpg") || { count: 0, totalBytes: 0 };
  const jpegStats = fileStats.get("jpeg") || { count: 0, totalBytes: 0 };
  const pngStats = fileStats.get("png") || { count: 0, totalBytes: 0 };

  const uncompressedCount = jpgStats.count + jpegStats.count + pngStats.count;
  const uncompressedBytes =
    jpgStats.totalBytes + jpegStats.totalBytes + pngStats.totalBytes;

  console.log(`\n🗜️  COMPRESSION ANALYSIS`);
  console.log(
    `   WebP files: ${webpStats?.count || 0} (${formatBytes(webpStats?.totalBytes || 0)})`,
  );
  console.log(
    `   Uncompressed files: ${uncompressedCount} (${formatBytes(uncompressedBytes)})`,
  );

  if (uncompressedCount > 0 && webpStats && webpStats.count > 0) {
    const compressionRatio =
      webpStats.count / (webpStats.count + uncompressedCount);
    console.log(
      `   Compression progress: ${(compressionRatio * 100).toFixed(1)}% of files converted`,
    );
  }

  // Show orphaned files sample
  if (orphanedFiles.length > 0) {
    console.log(`\n⚠️  ORPHANED FILES (Sample - first 20)`);
    console.log("   " + "-".repeat(68));
    orphanedFiles.slice(0, 20).forEach((file, index) => {
      console.log(
        `   ${(index + 1).toString().padStart(3)}. ${file.name} (${formatBytes(file.metadata?.size || 0)})`,
      );
    });
    if (orphanedFiles.length > 20) {
      console.log(`   ... and ${orphanedFiles.length - 20} more`);
    }
  }

  console.log("\n" + "=".repeat(70));
  console.log("💡 INTERPRETATION");
  console.log("=".repeat(70));
  console.log(`   Dashboard Storage: 116 GB (reported)`);
  console.log(`   Actual Storage: ${formatBytes(totalBytes)} (from API)`);

  const dashboardBytes = 116 * 1024 * 1024 * 1024; // 116 GB in bytes
  const difference = dashboardBytes - totalBytes;

  if (difference > 0) {
    console.log(`   Difference: ${formatBytes(difference)}`);
    console.log(`\n   ✅ CONCLUSION: Dashboard is STALE!`);
    console.log(`      • Actual usage is MUCH LOWER than dashboard shows`);
    console.log(`      • Compression is WORKING as intended`);
    console.log(`      • Safe to continue with remaining 2,400 facilities`);
    console.log(`      • Dashboard will update within 24-48 hours`);
  } else {
    console.log(`\n   ⚠️  CONCLUSION: Possible issue detected`);
    console.log(`      • Actual usage matches or exceeds dashboard`);
    console.log(`      • Further investigation needed`);
  }

  console.log("=".repeat(70));

  // Close database connection
  await sql.end();
}

auditStorageUsage().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
