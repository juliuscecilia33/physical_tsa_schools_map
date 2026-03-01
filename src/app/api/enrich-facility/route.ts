import { NextRequest, NextResponse } from "next/server";
import { enrichFacilityWithSerpApi } from "@/utils/enrichFacilityWithSerpApi";

export const maxDuration = 300; // 5 minutes timeout for long-running enrichment

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const { facilityId, placeId, facilityName, facilityAddress, lat, lng } =
      body;

    // Validate required fields
    if (!facilityId || !placeId || !facilityName) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: facilityId, placeId, facilityName",
        },
        { status: 400 }
      );
    }

    if (!lat || !lng) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing location coordinates: lat, lng",
        },
        { status: 400 }
      );
    }

    // Validate environment variables
    if (!process.env.SERPAPI_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          error: "SERPAPI_API_KEY not configured on server",
        },
        { status: 500 }
      );
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        {
          success: false,
          error: "SUPABASE_SERVICE_ROLE_KEY not configured on server",
        },
        { status: 500 }
      );
    }

    // Call enrichment utility
    const result = await enrichFacilityWithSerpApi({
      facilityId,
      placeId,
      facilityName,
      facilityAddress: facilityAddress || "",
      lat,
      lng,
      onProgress: (message) => {
        // Log progress messages to server console
        console.log(`[Enrichment ${facilityId}] ${message}`);
      },
    });

    // Return result
    return NextResponse.json(result, { status: result.success ? 200 : 500 });
  } catch (error: any) {
    console.error("API route error:", error);
    return NextResponse.json(
      {
        success: false,
        photosUploaded: 0,
        reviewsCollected: 0,
        sportsIdentified: [],
        tagAssigned: false,
        error: error.message || "Internal server error",
      },
      { status: 500 }
    );
  }
}
