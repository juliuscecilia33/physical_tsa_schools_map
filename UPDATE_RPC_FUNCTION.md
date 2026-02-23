# Update RPC Function to Include identified_sports

## Quick Fix

Your RPC function needs to be updated to return the `identified_sports` column.

### Steps:

1. **Open Supabase SQL Editor**
   - Go to your Supabase dashboard
   - Click on "SQL Editor" in the left sidebar

2. **Copy and Run the SQL**
   - Open the file: `create-rpc-with-limit.sql`
   - Copy ALL the contents (lines 1-64)
   - Paste into the Supabase SQL Editor
   - Click "Run" or press Cmd/Ctrl + Enter

3. **Refresh Your App**
   - Reload your browser (the app should already be running on `npm run dev`)
   - Open any facility on the map
   - You should now see the "Available Sports" section with emoji pills! 🏀 ⚽ 🎾

## What This Does

The updated RPC function now includes `identified_sports` in:
- ✅ Return type definition (line 14)
- ✅ SELECT query (line 38)
- ✅ GROUP BY clause (line 57)

This allows the frontend to receive and display the sports data that you identified with the script.

## Verification

After running the SQL and refreshing:
1. Open the browser console (F12)
2. Check the network tab for the RPC call to `get_facilities_with_coords`
3. You should see `identified_sports: ['Gym/Fitness']` (or other sports) in the response data

## If You See Errors

If you get a "function already exists" error, the script handles this by:
- First dropping the old function (line 2)
- Then creating the new version with the updated columns

Just run the entire script - it's safe to run multiple times.
