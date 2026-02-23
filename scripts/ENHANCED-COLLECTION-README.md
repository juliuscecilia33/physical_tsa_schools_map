# Enhanced Texas Facilities Collection Script

## Overview

`collect-additional-texas-facilities.ts` is a robust, production-ready script for collecting athletic facilities from additional Texas cities (ranks 51-200 by population). It builds upon the original collection script with advanced filtering, quality checks, and immediate sport identification.

## Key Features

### 🎯 Comprehensive Coverage
- **150 additional Texas cities** (ranks 51-200 by population)
- Same 9 facility search types as original script
- Systematic coverage of smaller cities and towns

### 🛡️ Inline Auto-Cleanup
- **Filters non-sport facilities before insertion**
- Checks facility types against allowlist/blocklist
- Prevents restaurants, hotels, stores, etc. from entering database
- Reduces wasted API calls and database bloat

### 🔍 Proximity-Based Deduplication
- **Detects duplicate listings with different Google Place IDs**
- Uses PostGIS spatial queries to find facilities within 50m
- Prevents duplicate facilities from cluttering the map
- Works alongside existing place_id deduplication

### ⭐ Facility Completeness Scoring
- **Quality-filters facilities before insertion**
- Scores facilities 0-100 based on:
  - Has rating (25 points)
  - Has reviews (25 points, scaled by count)
  - Has photos (20 points)
  - Has contact info (15 points)
  - Has opening hours (15 points)
- Only inserts facilities meeting minimum threshold (default: 30/100)

### 🏀 Immediate Sport Identification
- **Identifies sports during collection, not as separate step**
- Analyzes facility names and reviews using keyword matching
- Calculates confidence scores (0-100) for each sport
- Populates `identified_sports` and `sport_metadata` at insertion time
- Supports 23+ sports including mainstream, niche, and fitness activities

### 📊 Enhanced Progress Tracking
- **Detailed statistics at every step**
- Tracks facilities searched, filtered, and inserted
- Shows filter breakdown (duplicate, non-sport, low quality)
- Resumable from any point (saves progress to JSON file)
- ETA calculation based on current rate

### 📝 Comprehensive Logging
- **Real-time visibility into filtering decisions**
- Shows which facilities were filtered and why
- Displays identified sports with confidence scores
- Progress reports every 5 cities

## Setup

### Prerequisites

1. **Environment Variables** (`.env.local`):
   ```env
   GOOGLE_PLACES_API_KEY=your_google_api_key
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

2. **Database Function** (required for proximity deduplication):
   - Run the SQL migration: `scripts/sql/proximity-deduplication-function.sql`
   - Open your Supabase SQL Editor
   - Copy and paste the SQL content
   - Execute the query

3. **Dependencies**:
   ```bash
   npm install
   # or
   yarn install
   ```

### Database Migration

The script requires a PostGIS function for proximity deduplication:

```sql
-- Run in Supabase SQL Editor
-- Located at: scripts/sql/proximity-deduplication-function.sql

CREATE OR REPLACE FUNCTION find_nearby_facilities(
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  radius_meters INTEGER DEFAULT 50
)
RETURNS TABLE (...)
-- See full SQL in migration file
```

## Usage

### Basic Usage

```bash
# Run the enhanced collection script
npx ts-node scripts/collect-additional-texas-facilities.ts
```

### Resume After Interruption

The script automatically saves progress to `.additional-facilities-progress.json`. If interrupted, simply run it again:

```bash
# It will automatically resume from the last processed city
npx ts-node scripts/collect-additional-texas-facilities.ts
```

### Customization

You can customize the script by editing these constants:

```typescript
// Proximity threshold for duplicate detection (meters)
const PROXIMITY_THRESHOLD_METERS = 50;

// Minimum completeness score (0-100)
const COMPLETENESS_THRESHOLD = 30;

// Add/remove cities from the list
const ADDITIONAL_TEXAS_CITIES = [
  "Longview, Texas",
  // ... add or remove cities
];

// Add/remove search terms
const FACILITY_SEARCHES = [
  "soccer field",
  // ... add or remove search types
];
```

## How It Works

### Collection Flow

```
For each city:
  └─> Search all facility types (9 searches per city)
      └─> For each unique place_id found:
          ├─> Filter 1: Check if place_id exists in database
          │   └─> SKIP if exists
          │
          ├─> Fetch Google Place Details
          │
          ├─> Filter 3: Validate athletic facility types
          │   └─> SKIP if non-sport facility
          │
          ├─> Filter 4: Calculate completeness score
          │   └─> SKIP if below threshold
          │
          ├─> Filter 2: Check proximity to existing facilities
          │   └─> SKIP if duplicate within 50m
          │
          ├─> Identify sports (analyze name + reviews)
          │
          └─> INSERT facility with complete data
```

### Filter Details

#### Filter 1: Place ID Existence
- **Purpose**: Prevent re-inserting facilities already in database
- **Method**: Query Supabase by `place_id`
- **Fast**: Simple database lookup

#### Filter 2: Proximity Deduplication
- **Purpose**: Catch duplicates with different place_ids
- **Method**: PostGIS spatial query (ST_DWithin)
- **Threshold**: 50 meters
- **Use Case**: Same facility listed multiple times by Google

#### Filter 3: Athletic Facility Validation
- **Purpose**: Filter out non-sport facilities
- **Method**: Check place types against allowlist/blocklist
- **Logic**:
  - ✅ Keep if: Has athletic types (park, gym, court, field, etc.)
  - ❌ Filter if: Only has non-sport types (restaurant, hotel, store, etc.)
- **Benefit**: Prevents pollution from nearby businesses

#### Filter 4: Completeness Scoring
- **Purpose**: Ensure quality data
- **Scoring**: 0-100 based on available data fields
- **Threshold**: 30 points minimum (customizable)
- **Benefit**: Facilities with more data provide better user experience

### Sport Identification

The script identifies sports using keyword matching:

```typescript
// Example: Facility name "Memorial Basketball Court"
// → Identified: Basketball (score: 95, source: name)

// Example: Facility name "Community Center"
// → Checks reviews for sport keywords
// → Found "basketball" in review #2
// → Identified: Basketball (score: 40, source: review)
```

**Confidence Scoring:**
- **Name match**: 85-100 (highest confidence)
- **API/editorial summary**: 70-80
- **Review match**: 25-50 (varies by review position)
- **Multiple sources**: +10 bonus

**Sport Metadata:**
```json
{
  "Basketball": {
    "score": 95,
    "sources": ["name"],
    "keywords_matched": ["basketball"],
    "confidence": "high",
    "matched_text": "Memorial Basketball Court"
  }
}
```

## Output

### Console Output

```
🚀 Enhanced Texas Athletic Facilities Collection
============================================================
📊 Cities: 150 additional Texas cities (ranks 51-200)
🏃 Facility Types: 9 types per city

🔧 Robustness Features Enabled:
   ✓ Auto-cleanup (filters non-sport facilities)
   ✓ Proximity deduplication (50m threshold)
   ✓ Completeness scoring (min: 30/100)
   ✓ Immediate sport identification with confidence scores
============================================================

============================================================
📍 [1/150] Processing: Longview, Texas
============================================================
  [1/9] Searching: soccer field...
    Found 12 results
  [2/9] Searching: football field...
    Found 8 results
  ...

  🔍 Total unique facilities found: 45

  ✅ [23/45] Inserted 15 facilities
     Latest: Longview Sports Complex... → Soccer(92), Football(88)

  ✅ City Complete:
     Searched: 45
     Inserted: 15
     Filtered:
       - Duplicate: 8
       - Non-sport: 18
       - Low quality: 4
     Total in database: 2515

============================================================
📊 Overall Progress:
   Cities: 5/150
   Total Facilities: 2575
   Statistics:
     - Searched: 234
     - Inserted: 75
     - Filtered Duplicate: 42
     - Filtered Non-Sport: 89
     - Filtered Low Quality: 28
   Elapsed: 28 minutes
   ETA: 812 minutes (~13.5 hours)
============================================================
```

### Progress File

The script saves progress to `.additional-facilities-progress.json`:

```json
{
  "processedCities": ["Longview, Texas", "Pharr, Texas", ...],
  "totalFacilities": 2575,
  "statistics": {
    "searched": 234,
    "filteredNonSport": 89,
    "filteredDuplicate": 42,
    "filteredLowQuality": 28,
    "inserted": 75
  },
  "lastUpdated": "2025-02-23T10:30:00.000Z"
}
```

## Comparison with Original Script

| Feature | Original Script | Enhanced Script |
|---------|----------------|-----------------|
| **Cities Covered** | Top 50 by population | Additional 150 (ranks 51-200) |
| **Deduplication** | place_id only | place_id + proximity (50m) |
| **Quality Control** | None | Completeness scoring (0-100) |
| **Non-Sport Filtering** | After collection | During collection (inline) |
| **Sport Identification** | Separate script | Immediate (during collection) |
| **Confidence Scores** | Not available | Yes (0-100 per sport) |
| **Progress Tracking** | Basic | Detailed statistics |
| **Logging** | Minimal | Comprehensive |
| **API Efficiency** | Low (fetches everything) | High (filters early) |

## Performance

### Expected Metrics

- **Cities**: 150
- **Searches per city**: 9
- **Total searches**: ~1,350
- **Expected facilities found**: 3,000-6,000
- **Expected facilities inserted**: 1,000-2,000 (after filtering)
- **Filter rate**: ~40-60%
- **Runtime**: 10-20 hours (depends on API rate limits)

### API Usage

- **Google Places API calls**:
  - Text Search: ~1,350 calls (9 per city × 150 cities)
  - Place Details: ~3,000-6,000 calls (depends on results)
- **Total estimated cost**: $50-100 (at $17/1000 requests for Place Details)

### Rate Limiting

The script includes built-in rate limiting:
- 500ms delay between API calls
- 500ms delay between searches

## Troubleshooting

### "find_nearby_facilities does not exist"

**Problem**: The proximity deduplication function is not installed.

**Solution**:
1. Run the SQL migration: `scripts/sql/proximity-deduplication-function.sql`
2. Or, the script will gracefully skip proximity checks if function is missing

### "Missing required environment variables"

**Problem**: `.env.local` file is missing or incomplete.

**Solution**:
1. Create `.env.local` in project root
2. Add required variables:
   ```
   GOOGLE_PLACES_API_KEY=...
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   ```

### Very few facilities being inserted

**Problem**: Filters may be too strict.

**Solution**:
1. Lower `COMPLETENESS_THRESHOLD` (e.g., from 30 to 20)
2. Check logs to see which filters are catching most facilities
3. Adjust `NON_SPORT_TYPES` if needed

### Script is too slow

**Problem**: API rate limits or network latency.

**Solution**:
1. Check Google Cloud Console for API quota
2. Consider running overnight
3. Use progress file to resume if interrupted

## Future Enhancements

Potential improvements for future versions:

1. **Parallel Processing**: Process multiple cities simultaneously
2. **Incremental Updates**: Re-scan existing facilities for changes
3. **Machine Learning**: Train ML model on labeled data for better sport identification
4. **Name Similarity**: Use Levenshtein distance for name-based deduplication
5. **Configurable Thresholds**: Command-line arguments for all thresholds
6. **Dry Run Mode**: Preview what would be collected without inserting
7. **Export Reports**: Generate CSV/JSON reports of collection results

## Related Scripts

- **Original Collection**: `scripts/collect-athletic-facilities.ts`
- **Sport Identification**: `scripts/identify-facility-sports.ts`
- **Cleanup**: `scripts/cleanup-non-sport-facilities.ts`
- **Audit**: `scripts/audit-facility-sports.ts`
- **Validation**: `scripts/validate-facility-sports.ts`

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review the original script documentation
3. Check Supabase logs for database errors
4. Verify Google Places API quota in Cloud Console

---

**Sources:**
- [Texas Cities by Population (2025)](https://www.texas-demographics.com/cities_by_population)
- [100 Biggest Cities In Texas For 2025 - HomeSnacks](https://www.homesnacks.com/cities/cities-in-texas/)
