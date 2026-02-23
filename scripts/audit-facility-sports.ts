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

// Sport keywords (same as identify-facility-sports.ts)
const SPORT_KEYWORDS = {
  Basketball: ["basketball", "bball", "hoops"],
  Soccer: ["soccer", "football", "futbol", "pitch"],
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
  "Gym/Fitness": ["gym", "fitness", "24 hour fitness", "la fitness", "anytime fitness", "planet fitness", "gold's gym", "lifetime fitness"],
  CrossFit: ["crossfit"],
  Yoga: ["yoga"],
  Pilates: ["pilates"],
  "Martial Arts": ["martial arts", "karate", "taekwondo", "jiu jitsu", "bjj", "judo", "kickboxing", "mma"],
  Boxing: ["boxing"],
  Bowling: ["bowling"],
  Skating: ["skating", "skate park", "roller"],
  Climbing: ["climbing", "bouldering"],
  "Water Sports": ["kayak", "canoe", "rowing", "sailing"],
};

interface Facility {
  id: string;
  place_id: string;
  name: string;
  identified_sports?: string[];
  reviews?: any[];
}

interface AuditResult {
  place_id: string;
  name: string;
  sport: string;
  score: number;
  confidence: 'high' | 'medium' | 'low';
  sources: Array<'name' | 'review' | 'api'>;
  keywords_matched: string[];
  matched_text: string;
}

/**
 * Find which keywords from a sport match in a given text
 */
function findMatchingKeywords(sport: string, text: string): { keywords: string[], matchedText: string } {
  const keywords = SPORT_KEYWORDS[sport as keyof typeof SPORT_KEYWORDS] || [];
  const textLower = text.toLowerCase();
  const matched: string[] = [];
  let matchedText = "";

  for (const keyword of keywords) {
    const index = textLower.indexOf(keyword);
    if (index !== -1) {
      matched.push(keyword);
      // Extract a snippet around the match (up to 50 chars)
      const start = Math.max(0, index - 20);
      const end = Math.min(textLower.length, index + keyword.length + 30);
      matchedText = text.substring(start, end).trim();
      if (start > 0) matchedText = "..." + matchedText;
      if (end < textLower.length) matchedText = matchedText + "...";
      break; // Use first match for context
    }
  }

  return { keywords: matched, matchedText };
}

/**
 * Audit a single sport for a facility
 */
function auditSport(
  sport: string,
  facility: Facility
): SportMetadata {
  const sources: Array<'name' | 'review' | 'api'> = [];
  const allKeywords: string[] = [];
  let bestMatchedText = "";
  let score = 0;

  // Check 1: Name match (highest confidence)
  const nameMatch = findMatchingKeywords(sport, facility.name);
  if (nameMatch.keywords.length > 0) {
    sources.push('name');
    allKeywords.push(...nameMatch.keywords);
    bestMatchedText = nameMatch.matchedText;

    // Name match base score: 85-100
    // More specific keywords (longer) get higher scores
    const keywordSpecificity = Math.max(...nameMatch.keywords.map(k => k.length));
    score = 85 + Math.min(15, keywordSpecificity);
  }

  // Check 2: Review match (medium confidence)
  if (facility.reviews && facility.reviews.length > 0) {
    const reviewTexts = facility.reviews
      .slice(0, 10)
      .map(r => r.text || "")
      .join(" ");

    const reviewMatch = findMatchingKeywords(sport, reviewTexts);
    if (reviewMatch.keywords.length > 0) {
      sources.push('review');
      allKeywords.push(...reviewMatch.keywords.filter(k => !allKeywords.includes(k)));

      if (!bestMatchedText) {
        bestMatchedText = reviewMatch.matchedText;
      }

      // Review match base score: 20-50
      // Earlier reviews (more visible) get higher scores
      const firstReviewIndex = facility.reviews.findIndex(r =>
        r.text && findMatchingKeywords(sport, r.text).keywords.length > 0
      );
      const positionBonus = Math.max(0, 10 - firstReviewIndex * 2); // 0-10 points

      // If also in name, boost review score
      if (sources.includes('name')) {
        score = Math.max(score, 95); // Both name and review = very high confidence
      } else {
        score = 25 + positionBonus + Math.min(15, reviewMatch.keywords.length * 5);
      }
    }
  }

  // If no sources found, it's likely a false positive or from API (which we can't easily re-check)
  if (sources.length === 0) {
    // Assume it came from API or is a false positive
    score = 10; // Very low confidence
    allKeywords.push('unknown');
    bestMatchedText = 'No match found in name or reviews - may be from API or false positive';
  }

  // Multiple sources bonus
  if (sources.length > 1) {
    score = Math.min(100, score + 5);
  }

  // Determine confidence level
  let confidence: 'high' | 'medium' | 'low';
  if (score >= 70) {
    confidence = 'high';
  } else if (score >= 30) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  return {
    score,
    sources,
    keywords_matched: [...new Set(allKeywords)], // Deduplicate
    confidence,
    matched_text: bestMatchedText || 'No specific match found',
  };
}

/**
 * Audit all sports for a single facility
 */
function auditFacility(facility: Facility): { sport_metadata: Record<string, SportMetadata>, audit_results: AuditResult[] } {
  const sport_metadata: Record<string, SportMetadata> = {};
  const audit_results: AuditResult[] = [];

  if (!facility.identified_sports || facility.identified_sports.length === 0) {
    return { sport_metadata, audit_results };
  }

  for (const sport of facility.identified_sports) {
    const metadata = auditSport(sport, facility);
    sport_metadata[sport] = metadata;

    audit_results.push({
      place_id: facility.place_id,
      name: facility.name,
      sport,
      score: metadata.score,
      confidence: metadata.confidence,
      sources: metadata.sources,
      keywords_matched: metadata.keywords_matched,
      matched_text: metadata.matched_text || '',
    });
  }

  return { sport_metadata, audit_results };
}

/**
 * Process all facilities in batches
 */
async function processAllFacilities(options: {
  batchSize?: number;
  offset?: number;
  updateDatabase?: boolean;
}) {
  const { batchSize = 100, offset = 0, updateDatabase = true } = options;

  console.log("🔍 Starting sport audit process...\n");
  console.log(`📊 Options:`);
  console.log(`   - Batch size: ${batchSize}`);
  console.log(`   - Starting offset: ${offset}`);
  console.log(`   - Update database: ${updateDatabase ? "✅" : "❌"}\n`);

  let processedCount = 0;
  let currentOffset = offset;
  const allAuditResults: AuditResult[] = [];
  const stats = {
    totalFacilities: 0,
    totalSports: 0,
    highConfidence: 0,
    mediumConfidence: 0,
    lowConfidence: 0,
  };

  while (true) {
    console.log(`📥 Fetching facilities ${currentOffset} to ${currentOffset + batchSize}...`);

    const { data: facilities, error } = await supabase
      .from("sports_facilities")
      .select("id, place_id, name, identified_sports, reviews")
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

    console.log(`🔍 Auditing ${facilities.length} facilities...\n`);

    // Process each facility
    for (const facility of facilities) {
      const { sport_metadata, audit_results } = auditFacility(facility);

      processedCount++;
      stats.totalFacilities++;
      stats.totalSports += audit_results.length;

      // Count confidence levels
      for (const result of audit_results) {
        if (result.confidence === 'high') stats.highConfidence++;
        else if (result.confidence === 'medium') stats.mediumConfidence++;
        else stats.lowConfidence++;

        allAuditResults.push(result);

        // Log low confidence sports for review
        if (result.confidence === 'low') {
          console.log(
            `  ⚠️  [${processedCount}] ${facility.name.substring(0, 40)}... → ${result.sport} (score: ${result.score}, sources: ${result.sources.join(',') || 'none'})`
          );
        }
      }

      // Update database with metadata
      if (updateDatabase && Object.keys(sport_metadata).length > 0) {
        const { error: updateError } = await supabase
          .from("sports_facilities")
          .update({ sport_metadata })
          .eq("place_id", facility.place_id);

        if (updateError) {
          console.error(`  ⚠️  Error updating metadata for ${facility.place_id}: ${updateError.message}`);
        }
      }

      // Progress log every 25 facilities
      if (processedCount % 25 === 0) {
        console.log(`\n📈 Progress: ${processedCount} facilities, ${stats.totalSports} sports audited\n`);
      }
    }

    currentOffset += batchSize;
  }

  // Generate report
  await generateReport(allAuditResults, stats);

  console.log(`\n✅ Audit complete!`);
  console.log(`   - Facilities audited: ${stats.totalFacilities}`);
  console.log(`   - Total sports audited: ${stats.totalSports}`);
  console.log(`   - High confidence: ${stats.highConfidence} (${((stats.highConfidence / stats.totalSports) * 100).toFixed(1)}%)`);
  console.log(`   - Medium confidence: ${stats.mediumConfidence} (${((stats.mediumConfidence / stats.totalSports) * 100).toFixed(1)}%)`);
  console.log(`   - Low confidence: ${stats.lowConfidence} (${((stats.lowConfidence / stats.totalSports) * 100).toFixed(1)}%)`);
  console.log(`\n⚠️  ${stats.lowConfidence} sports flagged for review (low confidence)`);
}

/**
 * Generate CSV report
 */
async function generateReport(results: AuditResult[], stats: any) {
  const reportPath = path.join(__dirname, "../sport-audit-report.csv");

  const csvHeader = "Place ID,Facility Name,Sport,Score,Confidence,Sources,Keywords Matched,Matched Text\n";
  const csvRows = results
    .sort((a, b) => a.score - b.score) // Sort by score (lowest first)
    .map(r =>
      `"${r.place_id}","${r.name}","${r.sport}",${r.score},"${r.confidence}","${r.sources.join(',')}","${r.keywords_matched.join(',')}","${r.matched_text.replace(/"/g, '""')}"`
    )
    .join("\n");

  const summaryPath = path.join(__dirname, "../sport-audit-summary.txt");
  const summary = `
Sport Audit Summary
===================
Generated: ${new Date().toISOString()}

Statistics:
-----------
Total Facilities: ${stats.totalFacilities}
Total Sports: ${stats.totalSports}
High Confidence: ${stats.highConfidence} (${((stats.highConfidence / stats.totalSports) * 100).toFixed(1)}%)
Medium Confidence: ${stats.mediumConfidence} (${((stats.mediumConfidence / stats.totalSports) * 100).toFixed(1)}%)
Low Confidence: ${stats.lowConfidence} (${((stats.lowConfidence / stats.totalSports) * 100).toFixed(1)}%)

Recommendations:
----------------
- Review sports with score < 30 (low confidence)
- Consider removing sports with score < 15 (likely false positives)
- Sports with "unknown" keywords may be from API data or previous runs

Low Confidence Sports:
----------------------
${results.filter(r => r.confidence === 'low').length} sports need review
See sport-audit-report.csv for details (sorted by score)
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
  const batchSize = parseInt(args.find(arg => arg.startsWith("--batch-size="))?.split("=")[1] || "100");
  const offset = parseInt(args.find(arg => arg.startsWith("--offset="))?.split("=")[1] || "0");
  const updateDatabase = !args.includes("--no-update");

  await processAllFacilities({
    batchSize,
    offset,
    updateDatabase,
  });
}

main().catch(console.error);
