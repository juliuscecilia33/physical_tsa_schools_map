import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: path.join(__dirname, "../.env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Error: Missing Supabase environment variables");
  console.error("   Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration(migrationFile: string) {
  console.log(`\n📝 Running migration: ${migrationFile}`);

  const migrationPath = path.join(__dirname, "../migrations", migrationFile);

  if (!fs.existsSync(migrationPath)) {
    console.error(`❌ Migration file not found: ${migrationPath}`);
    return false;
  }

  const sql = fs.readFileSync(migrationPath, "utf-8");

  try {
    // Execute the SQL migration using Supabase's RPC or direct SQL execution
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    // If RPC doesn't work, we'll try using the PostgreSQL REST API directly
    // This is a fallback - in production you'd want to use a proper migration tool
    if (error && error.message.includes('exec_sql')) {
      console.log("⚠️  RPC method not available, attempting direct execution...");

      // For direct SQL execution, we need to use a database client
      // For now, let's just output instructions
      console.log("\n📋 Migration SQL to execute manually:");
      console.log("─".repeat(60));
      console.log(sql);
      console.log("─".repeat(60));
      console.log("\nℹ️  Please run this SQL in your Supabase SQL Editor:");
      console.log(`   ${supabaseUrl.replace('https://', 'https://app.')}/project/_/sql`);
      return false;
    }

    if (error) {
      console.error(`❌ Error running migration: ${error.message}`);
      return false;
    }

    console.log(`✅ Migration completed successfully: ${migrationFile}`);
    return true;
  } catch (error: any) {
    console.error(`❌ Error executing migration: ${error.message}`);
    console.log("\n📋 Migration SQL to execute manually:");
    console.log("─".repeat(60));
    console.log(sql);
    console.log("─".repeat(60));
    console.log("\nℹ️  Please run this SQL in your Supabase SQL Editor:");
    console.log(`   ${supabaseUrl.replace('https://', 'https://app.')}/project/_/sql`);
    return false;
  }
}

async function main() {
  console.log("🚀 Database Migration Runner");
  console.log("═".repeat(60));

  const migrationFile = process.argv[2];

  if (!migrationFile) {
    console.error("❌ Error: Please specify a migration file");
    console.log("\nUsage: npx tsx scripts/run-migration.ts <migration-file.sql>");
    console.log("Example: npx tsx scripts/run-migration.ts 002_add_sport_metadata.sql");
    process.exit(1);
  }

  await runMigration(migrationFile);
  console.log("\n✨ Migration process complete");
}

main().catch(console.error);
