import { NextRequest, NextResponse } from "next/server";
import postgres from "postgres";
import { Facility } from "@/types/facility";

// Initialize direct Postgres connection (bypasses REST API)
const sql = postgres(process.env.DATABASE_URL!, {
  ssl: { rejectUnauthorized: false },
  max: 10, // Connection pool size for serverless
  prepare: false,
  connect_timeout: 10, // 10 seconds to establish connection
  connection: {
    statement_timeout: 30000, // 30 seconds query timeout
  },
});

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

    // Call RPC + fetch photo_visibility_overrides in parallel
    // (overrides are not part of the RPC yet, so fetched separately)
    const [result, overridesResult] = await Promise.all([
      sql`
        SELECT * FROM get_facility_full_by_place_id(
          p_place_id := ${placeId}
        )
      `,
      sql`
        SELECT COALESCE(photo_visibility_overrides, '{}'::jsonb) AS photo_visibility_overrides
        FROM sports_facilities
        WHERE place_id = ${placeId}
        LIMIT 1
      `,
    ]);

    if (!result || result.length === 0) {
      return NextResponse.json(
        { error: "Facility not found" },
        { status: 404 }
      );
    }

    const data = result[0];

    const allPhotos = data.additional_photos || [];
    const allReviews = data.additional_reviews || [];

    // Transform the data to match Facility type
    const facility: Facility = {
      id: data.id,
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
      email: data.email || [],
      email_scraped_at: data.email_scraped_at,
      rating: data.rating ? parseFloat(data.rating) : undefined,
      user_ratings_total: data.user_ratings_total ? parseInt(data.user_ratings_total) : undefined,
      reviews: data.reviews || [],
      photo_references: data.photo_references || [],
      opening_hours: data.opening_hours,
      business_status: data.business_status,
      hidden: data.hidden,
      cleaned_up: data.cleaned_up,
      has_notes: data.has_notes,
      tags: data.tags || [],
      additional_photos: allPhotos,
      additional_reviews: allReviews,
      serp_scraped: data.serp_scraped,
      serp_scraped_at: data.serp_scraped_at,
      total_photo_count: data.total_photo_count,
      review_images_analysis: data.review_images_analysis || [],
      photo_visibility_overrides: (overridesResult[0]?.photo_visibility_overrides as Record<string, "show" | "hide">) || {},
    };

    // Return the facility with cache headers and truncation metadata
    return NextResponse.json(
      {
        facility,
        totalPhotos: allPhotos.length,
        totalReviews: allReviews.length,
      },
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ placeId: string }> }
) {
  try {
    const { placeId } = await params;
    const { photoUrl, override } = await request.json();

    if (!placeId || !photoUrl) {
      return NextResponse.json({ error: "placeId and photoUrl required" }, { status: 400 });
    }

    if (override === null) {
      // Remove the key: JSONB `-` operator removes by text key
      await sql`
        UPDATE sports_facilities
        SET photo_visibility_overrides =
          COALESCE(photo_visibility_overrides, '{}'::jsonb) - ${photoUrl}::text
        WHERE place_id = ${placeId}
      `;
    } else {
      // Upsert the key: JSONB `||` operator merges/overwrites
      await sql`
        UPDATE sports_facilities
        SET photo_visibility_overrides =
          COALESCE(photo_visibility_overrides, '{}'::jsonb) ||
          jsonb_build_object(${photoUrl}::text, ${override}::text)
        WHERE place_id = ${placeId}
      `;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Photo visibility PATCH error:", error);
    return NextResponse.json({ error: "Internal server error", details: error?.message }, { status: 500 });
  }
}
