import { NextRequest, NextResponse } from "next/server";
import postgres from "postgres";
import { FacilityLightweight } from "@/types/facility";

// Initialize direct Postgres connection
const sql = postgres(process.env.DATABASE_URL!, {
  prepare: false,
  ssl: { rejectUnauthorized: false },
  max: 10,
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tagIdsParam = searchParams.get("tagIds");

    if (!tagIdsParam) {
      return NextResponse.json(
        { error: "tagIds query parameter is required" },
        { status: 400 }
      );
    }

    // Parse comma-separated UUID array
    const tagIds = tagIdsParam.split(",").map((id) => id.trim());

    // Validate UUIDs (basic check)
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!tagIds.every((id) => uuidRegex.test(id))) {
      return NextResponse.json(
        { error: "Invalid UUID format in tagIds" },
        { status: 400 }
      );
    }

    // Call RPC function with tag filtering
    const facilities = await sql`
      SELECT * FROM get_facilities_by_tags(
        tag_ids := ${sql.array(tagIds)}::uuid[],
        row_limit := 20000,
        include_hidden := true,
        include_cleaned_up := true
      )
    `;

    console.log(
      `Fetched ${facilities.length} facilities with tags: ${tagIdsParam}`
    );

    // Transform the data to match FacilityLightweight type
    const transformedFacilities: FacilityLightweight[] = (
      facilities || []
    ).map((facility: any) => ({
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
      user_ratings_total: facility.user_ratings_total
        ? parseInt(facility.user_ratings_total)
        : undefined,
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
    }));

    // Return with cache headers
    return NextResponse.json(
      { facilities: transformedFacilities, count: transformedFacilities.length },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (error: any) {
    console.error("By-tag facilities API error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error?.message },
      { status: 500 }
    );
  }
}
