# Quick Start Guide: Enhanced Facilities Collection

## What Was Created

Three new files have been created to help you collect facilities from additional Texas cities with robust filtering and quality checks:

1. **`collect-additional-texas-facilities.ts`** - Enhanced collection script
2. **`sql/proximity-deduplication-function.sql`** - Database function for duplicate detection
3. **`ENHANCED-COLLECTION-README.md`** - Comprehensive documentation

## Quick Setup (3 Steps)

### Step 1: Run the SQL Migration

Open your Supabase SQL Editor and run:

```bash
# Copy the contents of this file:
scripts/sql/proximity-deduplication-function.sql

# Paste it into Supabase SQL Editor and execute
```

This creates the `find_nearby_facilities()` function for proximity-based deduplication.

### Step 2: Verify Environment Variables

Make sure your `.env.local` has:

```env
GOOGLE_PLACES_API_KEY=your_key_here
NEXT_PUBLIC_SUPABASE_URL=your_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key_here
```

### Step 3: Run the Script

```bash
npx ts-node scripts/collect-additional-texas-facilities.ts
```

That's it! The script will:
- ✅ Collect from 150 additional Texas cities (ranks 51-200)
- ✅ Filter out non-sport facilities automatically
- ✅ Detect and skip duplicates (by place_id and proximity)
- ✅ Only insert high-quality facilities (completeness score ≥ 30)
- ✅ Identify sports with confidence scores immediately
- ✅ Save progress automatically (resumable if interrupted)

## What Makes This Script "Robust"?

### 1. Auto-Cleanup During Collection
- **Before**: Collect everything, clean up later
- **After**: Filter non-sport facilities before inserting
- **Benefit**: Saves API quota, prevents database pollution

### 2. Proximity-Based Deduplication
- **Before**: Only checked place_id
- **After**: Also checks if facility exists within 50 meters
- **Benefit**: Catches duplicates with different Google Place IDs

### 3. Facility Completeness Scoring
- **Before**: Accepted all facilities
- **After**: Only inserts facilities with sufficient data (rating, reviews, photos, etc.)
- **Benefit**: Better user experience with complete facility info

### 4. Immediate Sport Identification
- **Before**: Separate step after collection
- **After**: Identifies sports during collection with confidence scores
- **Benefit**: Data is ready to use immediately, no post-processing needed

## Expected Results

### Coverage
- **150 new cities** added to your map
- **1,000-2,000 high-quality facilities** expected (after filtering)
- **Systematic coverage** of smaller Texas cities and towns

### Data Quality
- ✅ Only athletic/sport facilities (no restaurants, hotels, stores)
- ✅ No duplicates within 50 meters
- ✅ Facilities with sufficient data (photos, reviews, contact info)
- ✅ Sports identified with confidence scores (0-100)

### Runtime
- **10-20 hours** estimated (depends on API rate limits)
- Resumable if interrupted (saves progress every city)
- ~1,350 Google Places searches
- ~3,000-6,000 Place Details API calls

## Monitoring Progress

Watch the console output for:

```
📍 [23/150] Processing: Longview, Texas
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
```

## If Something Goes Wrong

### Script crashes or you stop it
→ Just run it again! Progress is saved automatically.

### Very few facilities being inserted
→ Check the "Filtered" stats in console output. If "Low quality" is high, consider lowering `COMPLETENESS_THRESHOLD` in the script (line 316).

### "find_nearby_facilities does not exist" error
→ Run the SQL migration (Step 1). The script will gracefully skip proximity checks if the function doesn't exist.

### API quota exceeded
→ The script respects rate limits (500ms delays). Check your Google Cloud Console for API quota.

## Customization

Edit these constants in `collect-additional-texas-facilities.ts`:

```typescript
// Line 316: Minimum completeness score
const COMPLETENESS_THRESHOLD = 30; // Lower to accept more facilities

// Line 315: Proximity threshold for duplicates
const PROXIMITY_THRESHOLD_METERS = 50; // Increase to catch fewer duplicates

// Lines 27-176: Cities to collect from
const ADDITIONAL_TEXAS_CITIES = [
  "Longview, Texas",
  // Add or remove cities here
];

// Lines 179-190: Search terms
const FACILITY_SEARCHES = [
  "soccer field",
  // Add or remove search types here
];
```

## Next Steps After Collection

Once collection is complete, you can:

1. **View on your map**: New facilities should appear automatically
2. **Run audit script**: `npx ts-node scripts/audit-facility-sports.ts` to review confidence scores
3. **Manual review**: Check facilities with low confidence scores
4. **Iterate**: Adjust thresholds and re-run for different cities

## Need More Help?

See `ENHANCED-COLLECTION-README.md` for:
- Detailed explanation of all features
- Performance metrics and API usage
- Troubleshooting guide
- Comparison with original script
- Future enhancement ideas

## File Structure

```
scripts/
├── collect-additional-texas-facilities.ts  ← Run this
├── sql/
│   └── proximity-deduplication-function.sql ← Run in Supabase first
├── ENHANCED-COLLECTION-README.md           ← Full documentation
└── QUICKSTART.md                           ← This file
```

---

**Ready to go?** Run Step 1 (SQL migration), then Step 3 (run the script)!
