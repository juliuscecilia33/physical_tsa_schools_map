# Sport Identification Feature Guide

This guide explains how to use the sport identification system to categorize facilities by the sports they offer.

## Overview

The sport identification feature allows you to:
- Automatically identify sports offered at each facility
- Filter facilities by specific sports (Basketball, Soccer, Tennis, etc.)
- Display identified sports as badges on facility details

## Setup

### 1. Apply Database Migration

First, add the `identified_sports` column to your database:

```bash
# Connect to your Supabase instance and run:
psql -h <your-supabase-host> -U postgres -d postgres -f migrations/001_add_identified_sports.sql
```

Or apply it directly in the Supabase SQL Editor by copying the contents of `migrations/001_add_identified_sports.sql`.

### 2. Run the Sport Identification Script

The script analyzes facility data and identifies sports using multiple methods:

#### Basic Usage (Name Parsing Only)
```bash
npx tsx scripts/identify-facility-sports.ts
```

This will:
- Parse facility names for sport keywords
- Analyze reviews in the database for sport mentions
- Process 100 facilities at a time
- Update the database with identified sports
- Generate a CSV report

**IMPORTANT:** The script is **additive and non-destructive**:
- It preserves existing identified sports from previous runs
- New sports are added to the list, never removed
- Safe to run multiple times with different options
- Running with `--use-places-api` will enhance existing results, not replace them

#### Advanced Options

**Use Google Places Details API (Recommended for Enhancement):**
```bash
npx tsx scripts/identify-facility-sports.ts --use-places-api
```
This fetches additional data from Google Places API (costs API credits).
- **Safe to run after basic identification** - will add newly discovered sports to existing ones
- **Example:** If "Soccer Complex" already has `['Soccer']`, API might add `['Soccer', 'Baseball', 'Tennis']`

**Disable Review Analysis:**
```bash
npx tsx scripts/identify-facility-sports.ts --no-reviews
```

**Custom Batch Size:**
```bash
npx tsx scripts/identify-facility-sports.ts --batch-size=200
```

**Resume from Specific Offset:**
```bash
npx tsx scripts/identify-facility-sports.ts --offset=1000
```

**Combine Options:**
```bash
npx tsx scripts/identify-facility-sports.ts --use-places-api --batch-size=50 --offset=500
```

## Identified Sports

The script can identify 20+ sports including:

### Core Sports
- Basketball
- Soccer
- Baseball
- Football
- Tennis
- Volleyball
- Swimming
- Track & Field

### Extended Sports
- Golf
- Hockey
- Lacrosse
- Softball
- Wrestling
- Gymnastics
- Pickleball
- Racquetball
- Squash
- Badminton

### Fitness Activities
- Gym/Fitness
- CrossFit
- Yoga
- Pilates
- Martial Arts
- Boxing

### Other
- Bowling
- Skating
- Climbing
- Water Sports

## How It Works

The script uses a multi-step identification process:

### Step 1: Name-Based Identification
Parses facility names for sport keywords:
- "MoneyGram Soccer Complex" → Soccer
- "Basketball Court at XYZ Park" → Basketball
- "24 Hour Fitness" → Gym/Fitness

**Confidence:** High

### Step 2: Review Analysis
Analyzes user reviews for sport mentions:
- "Great basketball courts and tennis facilities" → Basketball, Tennis
- Uses first 10 reviews in database

**Confidence:** Medium

### Step 3: Google Places Details API (Optional)
Fetches additional data:
- Editorial summaries
- Fresh reviews from Google
- More detailed facility information

**Confidence:** Medium

## Using the Filter in the UI

After running the script:

1. **View Identified Sports**: Open any facility detail card to see "Available Sports" badges
2. **Filter by Sport**: Use the "Filter by Sport" dropdown in the map sidebar
3. **Multi-Select**: Click multiple sports to show facilities that offer any of the selected sports
4. **Clear Filter**: Click "Clear Sport Filter" to reset

## Output

### Database Updates
Sports are stored in the `identified_sports` column as a text array:
```sql
SELECT name, identified_sports FROM sports_facilities WHERE identified_sports IS NOT NULL LIMIT 5;
```

### CSV Report
A detailed report is generated at `sport-identification-report.csv`:
```csv
Place ID,Facility Name,Identified Sports,Confidence,Method
ChIJ...,MoneyGram Soccer Complex,"Soccer",high,name
ChIJ...,24 Hour Fitness,"Gym/Fitness",high,name
```

## Tips for Best Results

1. **Start with name parsing only** (default) - it's fast and free
2. **Review the CSV report** to see which facilities need manual tagging
3. **Run with Places API as enhancement** - adds sports to existing results without removing any
4. **Process in batches** to monitor progress and costs
5. **Re-run periodically** as new facilities are added
6. **Run multiple times safely** - each run only adds new sports, never removes existing ones

### Recommended Workflow

```bash
# Step 1: Initial identification (fast, free)
npx tsx scripts/identify-facility-sports.ts

# Step 2: Review results
# Check sport-identification-report.csv

# Step 3: Enhance with Google Places API (costs API credits)
npx tsx scripts/identify-facility-sports.ts --use-places-api

# Result: Facilities now have sports from BOTH runs combined
```

## Troubleshooting

### No sports identified
- Check that facility names contain sport keywords
- Enable `--use-places-api` for additional data
- Manually tag facilities by updating the database:
  ```sql
  UPDATE sports_facilities
  SET identified_sports = ARRAY['Basketball', 'Tennis']
  WHERE place_id = 'ChIJ...';
  ```

### API rate limits
- Reduce batch size: `--batch-size=50`
- The script includes 100ms delays between API calls
- Monitor your Google Places API quota in Google Cloud Console

### Script crashes mid-process
- Resume from where it stopped: `--offset=<last_processed_count>`
- Check the last console output for the offset number

## Customization

### Adding New Sports

Edit `scripts/identify-facility-sports.ts` and add to `SPORT_KEYWORDS`:

```typescript
const SPORT_KEYWORDS = {
  // ... existing sports
  "Disc Golf": ["disc golf", "frisbee golf"],
  "Rugby": ["rugby"],
};
```

### Changing Confidence Levels

Modify the confidence logic in the `identifyFacilitySports` function to adjust what's considered high/medium/low confidence.

## Next Steps

After sport identification is complete:
- Use filters to discover facilities by sport
- Share findings with your users
- Consider adding sport icons or color-coding
- Build sport-specific reports or analytics
