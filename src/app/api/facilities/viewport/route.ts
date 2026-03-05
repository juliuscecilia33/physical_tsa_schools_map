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
    const searchParams = request.nextUrl.searchParams;

    // Extract bounds from query parameters
    const minLat = parseFloat(searchParams.get("minLat") || "");
    const maxLat = parseFloat(searchParams.get("maxLat") || "");
    const minLng = parseFloat(searchParams.get("minLng") || "");
    const maxLng = parseFloat(searchParams.get("maxLng") || "");
    const zoom = parseInt(searchParams.get("zoom") || "10");
    const includeHidden = searchParams.get("includeHidden") === "true";
    const includeCleanedUp = searchParams.get("includeCleanedUp") === "true";

    // Validate parameters
    if (
      isNaN(minLat) ||
      isNaN(maxLat) ||
      isNaN(minLng) ||
      isNaN(maxLng) ||
      isNaN(zoom)
    ) {
      return NextResponse.json(
        { error: "Invalid bounds parameters" },
        { status: 400 }
      );
    }

    // Call the lightweight RPC function
    const { data, error } = await supabase.rpc(
      "get_facilities_lightweight_by_bounds",
      {
        min_lat: minLat,
        max_lat: maxLat,
        min_lng: minLng,
        max_lng: maxLng,
        zoom_level: zoom,
        include_hidden: includeHidden,
        include_cleaned_up: includeCleanedUp,
      }
    );

    if (error) {
      console.error("Supabase RPC error:", error);
      return NextResponse.json(
        { error: "Failed to fetch facilities", details: error.message },
        { status: 500 }
      );
    }

    // Transform the data to match FacilityLightweight type
    const facilities: FacilityLightweight[] = (data || []).map(
      (facility: any) => ({
        id: facility.id,
        place_id: facility.place_id,
        name: facility.name,
        sport_types: facility.sport_types || [],
        identified_sports: facility.identified_sports || [],
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
    console.error("Viewport API error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error?.message },
      { status: 500 }
    );
  }
}
