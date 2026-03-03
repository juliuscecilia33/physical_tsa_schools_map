import { NextRequest, NextResponse } from "next/server";
import postgres from "postgres";
import { FacilityLightweight } from "@/types/facility";

// Initialize direct Postgres connection (bypasses REST API 1000-row limit)
const sql = postgres(process.env.DATABASE_URL!, {
  ssl: { rejectUnauthorized: false },
  max: 10, // Connection pool size for serverless
});

export async function GET(request: NextRequest) {
  try {
    // Call RPC function directly via SQL - no REST API pagination needed!
    const allFacilities = await sql`
      SELECT * FROM get_all_facilities_lightweight(
        row_limit := 20000,
        include_hidden := true,
        include_cleaned_up := true
      )
    `;

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
        rating: facility.rating ? parseFloat(facility.rating) : undefined,
        user_ratings_total: facility.user_ratings_total ? parseInt(facility.user_ratings_total) : undefined,
        photo_references: facility.photo_references || [],
        additional_photos_count: facility.additional_photos_count || 0,
        opening_hours: facility.opening_hours,
        business_status: facility.business_status,
        hidden: facility.hidden,
        cleaned_up: facility.cleaned_up,
        has_notes: facility.has_notes,
        tags: facility.tags || [],
        serp_scraped: facility.serp_scraped,
        serp_scraped_at: facility.serp_scraped_at,
        total_photo_count: facility.total_photo_count,
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
