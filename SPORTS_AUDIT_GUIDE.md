# Sports Validation & Audit System - User Guide

This guide explains how to use the new sports validation and audit system to understand and fix incorrect sport assignments like the "Mabson Field" issue.

## 🎯 Overview

The system now includes:
- **Confidence scoring** for each identified sport (0-100)
- **Source tracking** (name, review, or API)
- **Audit scripts** to understand why sports were identified
- **Validation scripts** to remove false positives
- **UI improvements** showing confidence scores and reasoning

---

## 📋 Step-by-Step Usage

### Step 1: Run the Database Migration

First, apply the database migration to add the `sport_metadata` column:

```sql
-- Copy and paste this into your Supabase SQL Editor:

ALTER TABLE sports_facilities
ADD COLUMN IF NOT EXISTS sport_metadata JSONB DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_sports_facilities_sport_metadata
  ON sports_facilities USING GIN (sport_metadata);

COMMENT ON COLUMN sports_facilities.sport_metadata IS 'JSONB object containing confidence scores, sources, and reasoning for each identified sport. Format: {"SportName": {"score": 0-100, "sources": ["name"|"review"|"api"], "keywords_matched": [...], "confidence": "high"|"medium"|"low", "matched_text": "..."}}';
```

### Step 2: Run the Audit Script

This analyzes all existing sports and calculates confidence scores:

```bash
# Audit all facilities and update sport_metadata
npx tsx scripts/audit-facility-sports.ts

# Options:
npx tsx scripts/audit-facility-sports.ts --batch-size=50  # Process 50 at a time
npx tsx scripts/audit-facility-sports.ts --no-update      # Don't update database (report only)
npx tsx scripts/audit-facility-sports.ts --offset=100     # Start from facility 100
```

**Output:**
- Updates `sport_metadata` column for each facility
- Generates `sport-audit-report.csv` (sorted by score, lowest first)
- Generates `sport-audit-summary.txt` with statistics
- Shows warnings for low-confidence sports (score < 30)

**Example output:**
```
⚠️  [42] Mabson Field → Soccer (score: 15, sources: review)
⚠️  [67] Lincoln Park → Football (score: 25, sources: review)
```

### Step 3: Review the Audit Report

Open `sport-audit-report.csv` to see details:

| Place ID | Facility Name | Sport | Score | Confidence | Sources | Keywords Matched | Matched Text |
|----------|---------------|-------|-------|------------|---------|------------------|--------------|
| ChIJ... | Mabson Field | Soccer | 15 | low | review | soccer | ...wish they had soccer too... |
| ChIJ... | Mabson Field | Baseball | 95 | high | name | baseball | Mabson Baseball Field |

**Understanding Scores:**
- **90-100**: High confidence - found in facility name with specific keywords
- **70-89**: High confidence - found in API data or name with less specific keywords
- **30-69**: Medium confidence - found in reviews (position matters)
- **0-29**: Low confidence - likely false positive

### Step 4: Run the Validation Script (Dry Run)

Preview what would be removed:

```bash
# Dry run (no changes) - shows what would be removed
npx tsx scripts/validate-facility-sports.ts

# Options:
npx tsx scripts/validate-facility-sports.ts --threshold=30      # Remove sports with score < 30
npx tsx scripts/validate-facility-sports.ts --threshold=25      # More conservative
npx tsx scripts/validate-facility-sports.ts --auto-remove       # Auto-remove score < 15 (very low)
```

**Output:**
```
🗑️  [42] Mabson Field...
     - Removing: Soccer (score: 15, reason: Very low confidence (15) - likely false positive)
✅ Updated in database

Validation complete!
   - Facilities validated: 250
   - Total sports: 450
   - Kept: 430 (95.6%)
   - Removed: 20 (4.4%)
   - Facilities modified: 18

⚠️  DRY RUN - No changes were made to the database
   To apply changes, run with --apply flag
```

### Step 5: Apply the Validation (Remove False Positives)

Once you're satisfied with the dry run results:

```bash
# Apply changes to database
npx tsx scripts/validate-facility-sports.ts --apply

# With custom threshold
npx tsx scripts/validate-facility-sports.ts --threshold=25 --apply

# Auto-remove very low confidence sports
npx tsx scripts/validate-facility-sports.ts --auto-remove --apply
```

This will:
- Remove sports with score < threshold
- Update both `identified_sports` and `sport_metadata` columns
- Generate reports of changes made

### Step 6: Use Enhanced Identification for New Facilities

When adding new facilities, the improved identification script now automatically:
- Calculates confidence scores
- Stores metadata
- Uses refined keywords (removed "pitch" from Soccer, etc.)
- Filters by threshold (optional)

```bash
# Run with enhanced metadata tracking
npx tsx scripts/identify-facility-sports.ts

# With confidence threshold (only keep sports with score >= 30)
npx tsx scripts/identify-facility-sports.ts --threshold=30

# With API data (more expensive but thorough)
npx tsx scripts/identify-facility-sports.ts --use-places-api
```

**New output format:**
```
✓ [42] Mabson Baseball Field → Baseball(95), Soccer(15) (+Soccer(15)) (high)
```
Numbers in parentheses are confidence scores.

---

## 🖥️ UI Changes

The FacilitySidebar now shows sport badges with:

### Color Coding
- **Green** 🟢: High confidence (score ≥ 70)
- **Yellow** 🟡: Medium confidence (score 30-69)
- **Red** 🔴: Low confidence (score < 30)
- **Gray** ⚪: Unknown (no metadata yet - run audit)

### Badge Features
- **Score display**: Each badge shows the confidence score
- **Warning icon**: ⚠️ appears on low-confidence sports
- **Hover tooltip**: Shows full details:
  - Confidence score (0-100)
  - Sources (name, review, API)
  - Matched keywords
  - Matched text snippet

**Example:**
```
🏀 Basketball [95]  ← Green badge, high confidence
⚽ Soccer [15] ⚠️   ← Red badge with warning, low confidence
```

Hover to see:
```
Confidence: 15/100 (low)
Sources: review
Keywords: soccer
Matched: "...wish they had soccer too..."
```

---

## 🔍 Investigating Specific Facilities

### Why does "Mabson Field" have Soccer?

1. **Run audit script** (if not already done)
2. **Check the report**: Open `sport-audit-report.csv`
3. **Find the facility**: Search for "Mabson Field"
4. **Review the data**:
   - Score: 15 (very low)
   - Source: review
   - Keywords: soccer
   - Matched text: "...wish they had soccer too..."

**Root cause**: Someone mentioned "soccer" in a review, but it was in the context of wishing they had soccer, not that it's actually available.

### Fixing It

```bash
# Option 1: Run validation to auto-remove low-confidence sports
npx tsx scripts/validate-facility-sports.ts --threshold=30 --apply

# Option 2: Manual SQL fix for specific facility
# (You can run this in Supabase SQL Editor)
UPDATE sports_facilities
SET identified_sports = array_remove(identified_sports, 'Soccer'),
    sport_metadata = sport_metadata - 'Soccer'
WHERE name = 'Mabson Field';
```

---

## 📊 Reports Generated

### 1. `sport-audit-report.csv`
Complete list of all sports with scores, sorted by confidence (lowest first).

### 2. `sport-audit-summary.txt`
Statistics summary:
- Total facilities/sports audited
- Confidence distribution
- Recommendations

### 3. `sport-validation-report.csv`
List of sports removed or flagged during validation.

### 4. `sport-validation-summary.txt`
Validation statistics and recommendations.

---

## ⚙️ Keyword Dictionary Improvements

The system now uses **refined keywords** to reduce false positives:

### Before
```typescript
Soccer: ["soccer", "football", "futbol", "pitch"]  // "pitch" causes baseball conflicts
Football: ["football", "gridiron"]                 // "football" conflicts with soccer
```

### After (Improved)
```typescript
Soccer: ["soccer", "futbol"]           // Removed ambiguous "football" and "pitch"
Football: ["football", "gridiron"]     // Still has "football" but handled in code
```

---

## 🚀 Recommended Workflow

For ongoing maintenance:

1. **Weekly**: Run audit script to update confidence scores
   ```bash
   npx tsx scripts/audit-facility-sports.ts
   ```

2. **Monthly**: Run validation to remove accumulated false positives
   ```bash
   npx tsx scripts/validate-facility-sports.ts --threshold=30 --apply
   ```

3. **New facilities**: Use enhanced identification with threshold
   ```bash
   npx tsx scripts/identify-facility-sports.ts --threshold=25
   ```

4. **Review UI**: Check the map for red badges (low confidence) and investigate

---

## 🐛 Troubleshooting

### Q: I ran the audit script but no metadata appears in the UI
**A**: Make sure to:
1. Refresh the browser (hard refresh: Cmd+Shift+R or Ctrl+Shift+F5)
2. Check that the migration was applied successfully
3. Verify the audit script didn't have errors

### Q: The validation script wants to remove too many sports
**A**: Try:
1. Lowering the threshold: `--threshold=20` instead of 30
2. Running without `--auto-remove` flag
3. Reviewing the report first before applying changes

### Q: Some sports have score 0 or no metadata
**A**: These sports were identified before the audit system was implemented. Run:
```bash
npx tsx scripts/audit-facility-sports.ts
```

---

## 📈 Future Improvements

Potential enhancements:
1. **Manual override UI**: Add ability to correct sports directly in the app
2. **Machine learning**: Train model on verified data
3. **Semantic analysis**: Use NLP to understand review context better
4. **User feedback**: Let users report incorrect sports
5. **Validation rules**: Check for incompatible sport combinations

---

## 📝 Example Complete Workflow

```bash
# 1. Apply database migration (in Supabase SQL Editor)
# (Copy SQL from Step 1 above)

# 2. Audit all existing facilities
npx tsx scripts/audit-facility-sports.ts

# 3. Review the report
open sport-audit-report.csv

# 4. Test validation (dry run)
npx tsx scripts/validate-facility-sports.ts --threshold=30

# 5. Apply validation
npx tsx scripts/validate-facility-sports.ts --threshold=30 --apply

# 6. Check the UI - look for red badges with low scores

# 7. For new facilities, use enhanced identification
npx tsx scripts/identify-facility-sports.ts --threshold=25
```

---

## 🎓 Understanding Confidence Scoring

### Score Calculation

**Name Match** (90-100):
- Base: 85 points
- Bonus: +1 point per character in keyword (up to 15)
- Example: "Basketball" (10 chars) = 85 + 10 = 95

**API Match** (70-80):
- Base: 70 points
- Bonus: +1 point per character (up to 10)

**Review Match** (25-50):
- Base: 25 points
- Position bonus: Earlier reviews get more points
  - Review 0: +10 points
  - Review 1: +8 points
  - Review 2: +6 points
  - etc.
- Keyword bonus: +5 points per keyword matched (up to 15)

**Multiple Sources**:
- +10 points if found in multiple sources

### Examples

| Facility | Sport | Sources | Score | Why |
|----------|-------|---------|-------|-----|
| "Lincoln HS Baseball Field" | Baseball | name | 95 | High - explicit in name |
| "Community Center" | Basketball | api | 75 | High - from Google API |
| "City Park" | Soccer | review (pos 0) | 40 | Medium - early review |
| "City Park" | Football | review (pos 8) | 27 | Low - late review |
| "Mabson Field" | Soccer | review (pos 5) | 15 | Very Low - late review, likely false positive |

---

**Questions?** Check the reports or examine the source code:
- `scripts/audit-facility-sports.ts` - Confidence scoring logic
- `scripts/validate-facility-sports.ts` - Validation logic
- `src/components/FacilitySidebar.tsx:512-592` - UI implementation
