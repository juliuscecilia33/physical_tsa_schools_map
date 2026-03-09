import postgres from "postgres";
import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables
dotenv.config({ path: path.join(__dirname, "../.env.local") });

const databaseUrl = process.env.DATABASE_URL!;

if (!databaseUrl) {
  console.error("❌ Error: Missing DATABASE_URL environment variable");
  process.exit(1);
}

const sql = postgres(databaseUrl, {
  prepare: false,
  ssl: { rejectUnauthorized: false },
});

async function fixCorruptedAdditionalPhotos() {
  console.log("🔍 Diagnosing corrupted additional_photos...\n");

  // Find all rows where additional_photos is a JSONB string instead of array
  const corrupted = await sql`
    SELECT id, name
    FROM sports_facilities
    WHERE additional_photos IS NOT NULL
      AND jsonb_typeof(additional_photos) = 'string'
  `;

  console.log(`Found ${corrupted.length} facilities with corrupted additional_photos\n`);

  if (corrupted.length === 0) {
    console.log("✅ Nothing to fix!");
    await sql.end();
    return;
  }

  // Fix: extract the string content and re-parse as proper JSONB array
  let fixedCount = 0;
  let failedCount = 0;

  for (const row of corrupted) {
    try {
      await sql`
        UPDATE sports_facilities
        SET additional_photos = (additional_photos #>> '{}')::jsonb
        WHERE id = ${row.id}
      `;
      fixedCount++;
      console.log(`  ✓ Fixed: ${row.name} (${row.id})`);
    } catch (error: any) {
      failedCount++;
      console.log(`  ✗ Failed: ${row.name} (${row.id}) — ${error.message}`);
    }
  }

  console.log(`\n📊 Results: ${fixedCount} fixed, ${failedCount} failed\n`);

  // Validate: confirm no more corrupted rows remain
  const remaining = await sql`
    SELECT count(*) as count
    FROM sports_facilities
    WHERE additional_photos IS NOT NULL
      AND jsonb_typeof(additional_photos) = 'string'
  `;

  if (Number(remaining[0].count) === 0) {
    console.log("✅ Validation passed — all additional_photos are proper arrays");
  } else {
    console.log(`⚠️  Validation: ${remaining[0].count} rows still corrupted`);
  }

  await sql.end();
}

fixCorruptedAdditionalPhotos().catch((err) => {
  console.error("❌ Script failed:", err);
  process.exit(1);
});
