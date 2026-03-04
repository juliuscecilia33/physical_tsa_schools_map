import { NextRequest, NextResponse } from "next/server";
import postgres from "postgres";
import { gzip } from "zlib";
import { promisify } from "util";
import { FacilityLightweight } from "@/types/facility";

const gzipAsync = promisify(gzip);

// Set maximum execution time for this route (5 minutes for batch loading)
export const maxDuration = 300;

// Initialize direct Postgres connection
const sql = postgres(process.env.DATABASE_URL!, {
  ssl: { rejectUnauthorized: false },
  max: 10,
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tagIdsParam = searchParams.get("tagIds");
    const offsetParam = searchParams.get("offset");
    const limitParam = searchParams.get("limit");

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

    // Check if pagination parameters are provided
    const isPaginated = offsetParam !== null || limitParam !== null;

    let facilities;
    if (isPaginated) {
      // Paginated query
      const offset = parseInt(offsetParam || "0", 10);
      const limit = parseInt(limitParam || "500", 10);

      if (isNaN(offset) || offset < 0 || isNaN(limit) || limit < 1) {
        return NextResponse.json(
          { error: "Invalid offset or limit parameters" },
          { status: 400 }
        );
      }

      facilities = await sql`
        SELECT * FROM get_facilities_by_tags_paginated(
          tag_ids := ${sql.array(tagIds)}::uuid[],
          offset_val := ${offset},
          limit_val := ${limit},
          include_hidden := true,
          include_cleaned_up := true
        )
      `;

      console.log(
        `Fetched ${facilities.length} facilities (offset: ${offset}, limit: ${limit}) with tags: ${tagIdsParam}`
      );
    } else {
      // Non-paginated query (backward compatibility)
      facilities = await sql`
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
    }

    // Transform the data to match FacilityLightweight type
    const transformedFacilities: FacilityLightweight[] = (
      facilities || []
    ).map((facility: any) => ({
      id: facility.id,
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

    // Prepare response data with pagination metadata if applicable
    const offset = isPaginated ? parseInt(offsetParam || "0", 10) : undefined;
    const limit = isPaginated ? parseInt(limitParam || "500", 10) : undefined;

    const responseData = isPaginated
      ? {
          facilities: transformedFacilities,
          count: transformedFacilities.length,
          offset,
          limit,
          hasMore: transformedFacilities.length === limit, // If we got full limit, there might be more
        }
      : {
          facilities: transformedFacilities,
          count: transformedFacilities.length,
        };

    // Compress response with gzip
    const jsonString = JSON.stringify(responseData);
    const compressed = await gzipAsync(jsonString);

    console.log(
      `Compression: ${jsonString.length} bytes → ${compressed.length} bytes (${((compressed.length / jsonString.length) * 100).toFixed(1)}%)`
    );

    // Return compressed response with appropriate headers
    return new Response(compressed, {
      headers: {
        "Content-Type": "application/json",
        "Content-Encoding": "gzip",
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (error: any) {
    console.error("By-tag facilities API error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error?.message },
      { status: 500 }
    );
  }
}
