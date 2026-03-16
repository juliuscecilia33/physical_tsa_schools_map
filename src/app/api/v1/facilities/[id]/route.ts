import { NextRequest } from "next/server";
import sql from "@/lib/db/public-api";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return Response.json(
        { error: { code: "BAD_REQUEST", message: "Facility ID is required" } },
        { status: 400 }
      );
    }

    const isUUID = UUID_REGEX.test(id);

    const result = await sql`
      SELECT
        id,
        place_id,
        name,
        sport_types,
        identified_sports,
        sport_metadata,
        address,
        ST_Y(location::geometry) AS lat,
        ST_X(location::geometry) AS lng,
        phone,
        website,
        email,
        email_scraped_at,
        rating,
        user_ratings_total,
        reviews,
        photo_references,
        additional_photos,
        additional_reviews,
        opening_hours,
        business_status,
        serp_scraped,
        serp_scraped_at,
        COALESCE(array_length(photo_references, 1), 0) + COALESCE(jsonb_array_length(additional_photos), 0) AS total_photo_count
      FROM sports_facilities
      WHERE ${isUUID ? sql`id = ${id}` : sql`place_id = ${id}`}
        AND (hidden IS NULL OR hidden = false)
      LIMIT 1
    `;

    if (!result || result.length === 0) {
      return Response.json(
        { error: { code: "NOT_FOUND", message: "Facility not found" } },
        { status: 404 }
      );
    }

    const r = result[0];

    const data = {
      id: r.id,
      place_id: r.place_id,
      name: r.name,
      sport_types: r.sport_types || [],
      identified_sports: r.identified_sports || [],
      sport_metadata: r.sport_metadata || {},
      address: r.address,
      location: { lat: parseFloat(r.lat), lng: parseFloat(r.lng) },
      phone: r.phone,
      website: r.website,
      email: r.email || [],
      email_scraped_at: r.email_scraped_at,
      rating: r.rating ? parseFloat(r.rating) : null,
      user_ratings_total: r.user_ratings_total ? parseInt(r.user_ratings_total, 10) : null,
      reviews: r.reviews || [],
      photo_references: r.photo_references || [],
      additional_photos: r.additional_photos || [],
      additional_reviews: r.additional_reviews || [],
      opening_hours: r.opening_hours,
      business_status: r.business_status,
      serp_scraped: r.serp_scraped,
      serp_scraped_at: r.serp_scraped_at,
      total_photo_count: parseInt(r.total_photo_count, 10) || 0,
    };

    return Response.json(
      { data },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        },
      }
    );
  } catch (error: any) {
    console.error("Public API detail error:", error);
    return Response.json(
      { error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
