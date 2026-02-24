import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { FacilityLightweight } from "@/types/facility";

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: NextRequest) {
  try {
    // Fetch all facilities with pagination to bypass Supabase's 1000 row limit
    const allFacilities: any[] = [];
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .rpc("get_all_facilities_lightweight", {
          row_limit: 20000,
          include_hidden: true,
          include_cleaned_up: true,
        })
        .range(from, from + pageSize - 1);

      if (error) {
        console.error("Supabase RPC error:", error);
        return NextResponse.json(
          { error: "Failed to fetch facilities", details: error.message },
          { status: 500 }
        );
      }

      if (data && data.length > 0) {
        allFacilities.push(...data);
        from += pageSize;

        console.log(`Fetched ${allFacilities.length} facilities so far...`);

        // If we got fewer rows than pageSize, we've reached the end
        if (data.length < pageSize) {
          hasMore = false;
        }
      } else {
        hasMore = false;
      }
    }

    console.log(`Total fetched: ${allFacilities.length} lightweight facilities`);

    // Transform the data to match FacilityLightweight type
    const facilities: FacilityLightweight[] = (allFacilities || []).map(
      (facility: any) => ({
        place_id: facility.place_id,
        name: facility.name,
        sport_types: facility.sport_types || [],
        identified_sports: facility.identified_sports || [],
        sport_metadata: facility.sport_metadata || {},
        address: facility.address,
        location: {
          lat: facility.lat,
          lng: facility.lng,
        },
        phone: facility.phone,
        website: facility.website,
        rating: facility.rating,
        user_ratings_total: facility.user_ratings_total,
        photo_references: facility.photo_references || [],
        opening_hours: facility.opening_hours,
        business_status: facility.business_status,
        hidden: facility.hidden,
        cleaned_up: facility.cleaned_up,
        has_notes: facility.has_notes,
        tags: facility.tags || [],
        serp_scraped: facility.serp_scraped,
        serp_scraped_at: facility.serp_scraped_at,
      })
    );


    // Return the facilities with cache headers
    return NextResponse.json(
      { facilities, count: facilities.length },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (error: any) {
    console.error("All facilities API error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error?.message },
      { status: 500 }
    );
  }
}
