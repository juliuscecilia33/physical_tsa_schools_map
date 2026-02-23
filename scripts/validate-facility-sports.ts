import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import { SportMetadata } from "../src/types/facility";

// Load environment variables
dotenv.config({ path: path.join(__dirname, "../.env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("❌ Error: Missing required environment variables");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface Facility {
  id: string;
  place_id: string;
  name: string;
  identified_sports?: string[];
  sport_metadata?: Record<string, SportMetadata>;
}

interface ValidationResult {
  place_id: string;
  name: string;
  sport: string;
  score: number;
  confidence: string;
  action: 'remove' | 'keep' | 'review';
  reason: string;
}

/**
 * Validate sports for a single facility
 */
function validateFacility(
  facility: Facility,
  options: { threshold: number; autoRemove: boolean }
): {
  keptSports: string[];
  removedSports: string[];
  validations: ValidationResult[];
  updatedMetadata: Record<string, SportMetadata>;
} {
  const keptSports: string[] = [];
  const removedSports: string[] = [];
  const validations: ValidationResult[] = [];
  const updatedMetadata: Record<string, SportMetadata> = {};

  if (!facility.identified_sports || facility.identified_sports.length === 0) {
    return { keptSports, removedSports, validations, updatedMetadata };
  }

  for (const sport of facility.identified_sports) {
    const metadata = facility.sport_metadata?.[sport];

    // If no metadata exists, flag for review (can't determine confidence)
    if (!metadata) {
      validations.push({
        place_id: facility.place_id,
        name: facility.name,
        sport,
        score: 0,
        confidence: 'unknown',
        action: 'review',
        reason: 'No metadata - run audit script first',
      });

      if (options.autoRemove) {
        removedSports.push(sport);
      } else {
        keptSports.push(sport);
        updatedMetadata[sport] = metadata || {
          score: 0,
          sources: [],
          keywords_matched: [],
          confidence: 'low',
          matched_text: 'No metadata available',
        };
      }
      continue;
    }

    // Determine action based on score
    let action: 'remove' | 'keep' | 'review' = 'keep';
    let reason = '';

    if (metadata.score < options.threshold) {
      if (metadata.score < 15) {
        action = 'remove';
        reason = `Very low confidence (${metadata.score}) - likely false positive`;
      } else {
        action = options.autoRemove ? 'remove' : 'review';
        reason = `Low confidence (${metadata.score}) - below threshold ${options.threshold}`;
      }
    } else if (metadata.sources.length === 0 || metadata.keywords_matched.includes('unknown')) {
      action = 'review';
      reason = 'Unknown source - may be from previous API run';
    } else {
      action = 'keep';
      reason = `Sufficient confidence (${metadata.score})`;
    }

    validations.push({
      place_id: facility.place_id,
      name: facility.name,
      sport,
      score: metadata.score,
      confidence: metadata.confidence,
      action,
      reason,
    });

    if (action === 'remove') {
      removedSports.push(sport);
    } else {
      keptSports.push(sport);
      updatedMetadata[sport] = metadata;
    }
  }

  return { keptSports, removedSports, validations, updatedMetadata };
}

/**
 * Process all facilities in batches
 */
async function processAllFacilities(options: {
  batchSize?: number;
  offset?: number;
  threshold?: number;
  autoRemove?: boolean;
  dryRun?: boolean;
}) {
  const {
    batchSize = 100,
    offset = 0,
    threshold = 30,
    autoRemove = false,
    dryRun = true,
  } = options;

  console.log("🔍 Starting sport validation process...\n");
  console.log(`📊 Options:`);
  console.log(`   - Batch size: ${batchSize}`);
  console.log(`   - Starting offset: ${offset}`);
  console.log(`   - Confidence threshold: ${threshold}`);
  console.log(`   - Auto-remove low confidence: ${autoRemove ? "✅" : "❌"}`);
  console.log(`   - Dry run (no changes): ${dryRun ? "✅" : "❌"}\n`);

  let processedCount = 0;
  let currentOffset = offset;
  const allValidations: ValidationResult[] = [];
  const stats = {
    totalFacilities: 0,
    totalSports: 0,
    keptSports: 0,
    removedSports: 0,
    needReview: 0,
    facilitiesModified: 0,
  };

  while (true) {
    console.log(`📥 Fetching facilities ${currentOffset} to ${currentOffset + batchSize}...`);

    const { data: facilities, error } = await supabase
      .from("sports_facilities")
      .select("id, place_id, name, identified_sports, sport_metadata")
      .not("identified_sports", "is", null)
      .neq("identified_sports", '{}')
      .range(currentOffset, currentOffset + batchSize - 1);

    if (error) {
      console.error(`❌ Error fetching facilities: ${error.message}`);
      break;
    }

    if (!facilities || facilities.length === 0) {
      console.log("✅ No more facilities to process");
      break;
    }

    console.log(`🔍 Validating ${facilities.length} facilities...\n`);

    // Process each facility
    for (const facility of facilities) {
      const { keptSports, removedSports, validations, updatedMetadata } = validateFacility(
        facility,
        { threshold, autoRemove }
      );

      processedCount++;
      stats.totalFacilities++;
      stats.totalSports += (facility.identified_sports?.length || 0);
      stats.keptSports += keptSports.length;
      stats.removedSports += removedSports.length;
      stats.needReview += validations.filter(v => v.action === 'review').length;

      allValidations.push(...validations);

      // Log removals
      if (removedSports.length > 0) {
        stats.facilitiesModified++;
        console.log(
          `  🗑️  [${processedCount}] ${facility.name.substring(0, 40)}...`
        );
        for (const sport of removedSports) {
          const validation = validations.find(v => v.sport === sport);
          console.log(`       - Removing: ${sport} (score: ${validation?.score}, reason: ${validation?.reason})`);
        }
      }

      // Update database if not dry run
      if (!dryRun && removedSports.length > 0) {
        const { error: updateError } = await supabase
          .from("sports_facilities")
          .update({
            identified_sports: keptSports,
            sport_metadata: updatedMetadata,
          })
          .eq("place_id", facility.place_id);

        if (updateError) {
          console.error(`  ⚠️  Error updating ${facility.place_id}: ${updateError.message}`);
        } else {
          console.log(`       ✅ Updated in database`);
        }
      }

      // Progress log every 25 facilities
      if (processedCount % 25 === 0) {
        console.log(
          `\n📈 Progress: ${processedCount} facilities, ${stats.removedSports} sports flagged for removal\n`
        );
      }
    }

    currentOffset += batchSize;
  }

  // Generate report
  await generateReport(allValidations, stats, options);

  console.log(`\n✅ Validation complete!`);
  console.log(`   - Facilities validated: ${stats.totalFacilities}`);
  console.log(`   - Total sports: ${stats.totalSports}`);
  console.log(`   - Kept: ${stats.keptSports} (${((stats.keptSports / stats.totalSports) * 100).toFixed(1)}%)`);
  console.log(`   - Removed: ${stats.removedSports} (${((stats.removedSports / stats.totalSports) * 100).toFixed(1)}%)`);
  console.log(`   - Need review: ${stats.needReview}`);
  console.log(`   - Facilities modified: ${stats.facilitiesModified}`);

  if (dryRun) {
    console.log(`\n⚠️  DRY RUN - No changes were made to the database`);
    console.log(`   To apply changes, run with --apply flag`);
  }
}

/**
 * Generate validation report
 */
async function generateReport(
  validations: ValidationResult[],
  stats: any,
  options: any
) {
  const reportPath = path.join(__dirname, "../sport-validation-report.csv");

  const csvHeader = "Place ID,Facility Name,Sport,Score,Confidence,Action,Reason\n";
  const csvRows = validations
    .filter(v => v.action === 'remove' || v.action === 'review')
    .sort((a, b) => a.score - b.score)
    .map(r =>
      `"${r.place_id}","${r.name}","${r.sport}",${r.score},"${r.confidence}","${r.action}","${r.reason}"`
    )
    .join("\n");

  const summaryPath = path.join(__dirname, "../sport-validation-summary.txt");
  const summary = `
Sport Validation Summary
========================
Generated: ${new Date().toISOString()}

Configuration:
--------------
Confidence Threshold: ${options.threshold}
Auto-remove: ${options.autoRemove ? 'Yes' : 'No'}
Dry Run: ${options.dryRun ? 'Yes' : 'No'}

Statistics:
-----------
Total Facilities: ${stats.totalFacilities}
Total Sports: ${stats.totalSports}
Kept: ${stats.keptSports} (${((stats.keptSports / stats.totalSports) * 100).toFixed(1)}%)
Removed: ${stats.removedSports} (${((stats.removedSports / stats.totalSports) * 100).toFixed(1)}%)
Need Review: ${stats.needReview}
Facilities Modified: ${stats.facilitiesModified}

Actions Taken:
--------------
${options.dryRun ? '⚠️  DRY RUN - No changes were made to the database' : '✅ Changes applied to database'}

Recommendations:
----------------
1. Review the sport-validation-report.csv for details on removed/flagged sports
2. Sports with score < 15 are likely false positives
3. Sports with "unknown" source may be from old API data
4. Consider running audit script if metadata is missing

Next Steps:
-----------
${options.dryRun ? '- Run with --apply to apply changes to database' : '- Run audit script to update metadata for remaining sports'}
- Review facilities with multiple removals
- Update keyword dictionary to prevent future false positives

Removed Sports:
---------------
${validations.filter(v => v.action === 'remove').length} sports flagged for removal
See sport-validation-report.csv for details (sorted by score)
`;

  fs.writeFileSync(reportPath, csvHeader + csvRows);
  fs.writeFileSync(summaryPath, summary);

  console.log(`\n📄 Reports saved:`);
  console.log(`   - ${reportPath}`);
  console.log(`   - ${summaryPath}`);
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const batchSize = parseInt(
    args.find(arg => arg.startsWith("--batch-size="))?.split("=")[1] || "100"
  );
  const offset = parseInt(args.find(arg => arg.startsWith("--offset="))?.split("=")[1] || "0");
  const threshold = parseInt(
    args.find(arg => arg.startsWith("--threshold="))?.split("=")[1] || "30"
  );
  const autoRemove = args.includes("--auto-remove");
  const dryRun = !args.includes("--apply");

  if (dryRun) {
    console.log("ℹ️  Running in DRY RUN mode - no changes will be made");
    console.log("   Add --apply flag to apply changes\n");
  }

  await processAllFacilities({
    batchSize,
    offset,
    threshold,
    autoRemove,
    dryRun,
  });
}

main().catch(console.error);
