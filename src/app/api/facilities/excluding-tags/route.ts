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
    const excludeTagIdsParam = searchParams.get("excludeTagIds");
    const offsetParam = searchParams.get("offset") || "0";
    const limitParam = searchParams.get("limit") || "1000";

    if (!excludeTagIdsParam) {
      return NextResponse.json(
        { error: "excludeTagIds query parameter is required" },
        { status: 400 }
      );
    }

    // Parse comma-separated UUID array
    const excludeTagIds = excludeTagIdsParam.split(",").map((id) => id.trim());

    // Validate UUIDs (basic check)
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!excludeTagIds.every((id) => uuidRegex.test(id))) {
      return NextResponse.json(
        { error: "Invalid UUID format in excludeTagIds" },
        { status: 400 }
      );
    }

    // Parse pagination params
    const offset = parseInt(offsetParam, 10);
    const limit = parseInt(limitParam, 10);

    if (isNaN(offset) || offset < 0 || isNaN(limit) || limit < 1) {
      return NextResponse.json(
        { error: "Invalid offset or limit parameters" },
        { status: 400 }
      );
    }

    // Call RPC function with tag exclusion and pagination
    const facilities = await sql`
      SELECT * FROM get_facilities_excluding_tags_paginated(
        exclude_tag_ids := ${sql.array(excludeTagIds)}::uuid[],
        offset_val := ${offset},
        limit_val := ${limit},
        include_hidden := true,
        include_cleaned_up := true
      )
    `;

    console.log(
      `Fetched ${facilities.length} facilities (offset: ${offset}, limit: ${limit}) excluding tags: ${excludeTagIdsParam}`
    );

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

    // Prepare response data
    const responseData = {
      facilities: transformedFacilities,
      count: transformedFacilities.length,
      offset,
      limit,
      hasMore: transformedFacilities.length === limit, // If we got full limit, there might be more
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
    console.error("Excluding-tags facilities API error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error?.message },
      { status: 500 }
    );
  }
}
