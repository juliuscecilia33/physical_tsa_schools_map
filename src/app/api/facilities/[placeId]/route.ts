import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Facility } from "@/types/facility";

// Type for the raw data returned by the RPC function
// The RPC function returns lat/lng as flat properties, not nested in location
type FacilityRPCResponse = Omit<Facility, 'location'> & {
  lat: number;
  lng: number;
};

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ placeId: string }> }
) {
  try {
    const { placeId } = await params;

    if (!placeId) {
      return NextResponse.json(
        { error: "place_id parameter is required" },
        { status: 400 }
      );
    }

    // Call the RPC function to get full facility data
    const { data, error } = await supabase
      .rpc("get_facility_full_by_place_id", {
        p_place_id: placeId,
      })
      .single<FacilityRPCResponse>();

    if (error) {
      console.error("Supabase RPC error:", error);
      return NextResponse.json(
        { error: "Failed to fetch facility", details: error.message },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Facility not found" },
        { status: 404 }
      );
    }

    // Transform the data to match Facility type
    const facility: Facility = {
      place_id: data.place_id,
      name: data.name,
      sport_types: data.sport_types || [],
      identified_sports: data.identified_sports || [],
      sport_metadata: data.sport_metadata || {},
      address: data.address,
      location: {
        lat: data.lat,
        lng: data.lng,
      },
      phone: data.phone,
      website: data.website,
      rating: data.rating,
      user_ratings_total: data.user_ratings_total,
      reviews: data.reviews || [],
      photo_references: data.photo_references || [],
      opening_hours: data.opening_hours,
      business_status: data.business_status,
      hidden: data.hidden,
      cleaned_up: data.cleaned_up,
      has_notes: data.has_notes,
      tags: data.tags || [],
      additional_photos: data.additional_photos || [],
      additional_reviews: data.additional_reviews || [],
      serp_scraped: data.serp_scraped,
      serp_scraped_at: data.serp_scraped_at,
    };

    // Return the facility with cache headers
    return NextResponse.json(
      { facility },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        },
      }
    );
  } catch (error: any) {
    console.error("Facility details API error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error?.message },
      { status: 500 }
    );
  }
}
