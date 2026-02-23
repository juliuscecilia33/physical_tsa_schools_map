# Additive Sport Identification - How It Works

## Overview

The sport identification script has been updated to be **additive and non-destructive**. This means you can safely run it multiple times with different options, and each run will only ADD new sports, never remove existing ones.

## What Changed

### Before (Destructive Behavior)
```typescript
// Old code would only run API if NO sports were found
if (options.usePlacesAPI && sports.length === 0) {
  // This missed enhancing existing results!
}
```

**Problem:** If name parsing found "Soccer", the API would never run, missing other sports like "Baseball" and "Tennis" that the facility might offer.

### After (Additive Behavior)
```typescript
// New code ALWAYS runs API if enabled
if (options.usePlacesAPI) {
  // Merges new findings with existing sports
}
```

**Benefit:** Each run adds to what was previously found. Your data gets richer with each pass!

## Example Scenarios

### Scenario 1: Simple Enhancement
**Facility:** "Community Center"

```bash
# First run (basic)
npx tsx scripts/identify-facility-sports.ts
# Result: [] (no sports in name)

# Second run (with API)
npx tsx scripts/identify-facility-sports.ts --use-places-api
# Result: ['Basketball', 'Tennis', 'Volleyball']
# ✅ API found sports, database updated
```

### Scenario 2: Additive Enhancement
**Facility:** "Soccer Complex with Indoor Courts"

```bash
# First run (basic)
npx tsx scripts/identify-facility-sports.ts
# Result: ['Soccer'] (from name parsing)

# Second run (with API)
npx tsx scripts/identify-facility-sports.ts --use-places-api
# Result: ['Soccer', 'Basketball', 'Tennis', 'Volleyball']
# ✅ API added 3 new sports, kept 'Soccer'
```

### Scenario 3: No Changes Needed
**Facility:** "Joe's Gym"

```bash
# First run (basic)
npx tsx scripts/identify-facility-sports.ts
# Result: ['Gym/Fitness']

# Second run (with API)
npx tsx scripts/identify-facility-sports.ts --use-places-api
# Result: ['Gym/Fitness']
# ✅ No new sports found, database unchanged (efficient!)
```

## Console Output

The script now shows what's happening:

```bash
# New sports added
✓ [123] Soccer Complex... → Soccer, Basketball, Tennis (+Basketball, Tennis) (high)

# No changes (already had these sports)
= [124] Joe's Gym... → Gym/Fitness (unchanged)

# First time identification
✓ [125] Community Center... → Basketball, Volleyball (high)
```

Legend:
- `✓` = Sports identified (new or first time)
- `=` = No changes (already had these sports)
- `○` = No sports identified
- `(+...)` = Newly added sports in this run

## Safe Multi-Pass Strategy

You can run the script multiple times to build up comprehensive sport data:

```bash
# Pass 1: Quick name-based identification (free)
npx tsx scripts/identify-facility-sports.ts
# ➜ Identifies ~30-40% of facilities

# Pass 2: Add review analysis insights (free, slower)
npx tsx scripts/identify-facility-sports.ts
# ➜ Adds a few more from reviews

# Pass 3: Enhance with Google Places API (costs credits)
npx tsx scripts/identify-facility-sports.ts --use-places-api
# ➜ Adds sports missed by name/review parsing

# Pass 4: Manual additions (if needed)
# Update specific facilities via SQL or admin interface
```

Each pass is safe and only improves your data!

## Technical Details

### Data Flow

```
Database Load
    ↓
existing_sports = ['Soccer']  ← Read from DB
    ↓
Name Parsing
    ↓
sports = ['Soccer', 'Basketball']  ← Added 'Basketball'
    ↓
Review Analysis
    ↓
sports = ['Soccer', 'Basketball', 'Tennis']  ← Added 'Tennis'
    ↓
Google Places API (if enabled)
    ↓
sports = ['Soccer', 'Basketball', 'Tennis', 'Volleyball']  ← Added 'Volleyball'
    ↓
Database Update
    ↓
ONLY updates if: new_sports.length > existing_sports.length
```

### Code Changes Summary

1. **Added `existingSports` parameter** to `identifyFacilitySports()`
2. **Load existing sports** from database at start of processing
3. **Use Set for deduplication** - automatically handles duplicates
4. **Always run API** if flag is set (removed `sports.length === 0` check)
5. **Smart logging** - shows what was added vs unchanged
6. **Database efficiency** - only writes if new sports found

## Benefits

✅ **Safe to Re-run** - Never loses data
✅ **Incremental Improvement** - Build up sport data over time
✅ **Cost Efficient** - Only updates when there are changes
✅ **Clear Feedback** - Console shows exactly what changed
✅ **Flexible Strategy** - Run cheap passes first, expensive API last

## Questions?

**Q: Will it duplicate sports?**
A: No, uses a Set internally for automatic deduplication.

**Q: Can I run it on a subset of facilities?**
A: Yes, use `--offset=N` and `--batch-size=M` to target specific ranges.

**Q: What if I want to remove a sport?**
A: Manually update the database:
```sql
UPDATE sports_facilities
SET identified_sports = array_remove(identified_sports, 'Soccer')
WHERE place_id = 'ChIJ...';
```

**Q: How do I know what changed?**
A: Check the console output (shows `+NewSport`) or review the generated CSV report.
