import { NextRequest } from "next/server";
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
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required fields: facilityId, placeId, facilityName",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!lat || !lng) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing location coordinates: lat, lng",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Validate environment variables
    if (!process.env.SERPAPI_API_KEY) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "SERPAPI_API_KEY not configured on server",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "SUPABASE_SERVICE_ROLE_KEY not configured on server",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Create SSE stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send progress events via SSE
          const sendEvent = (event: string, data: any) => {
            const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
            controller.enqueue(encoder.encode(message));
          };

          // Call enrichment utility with progress callback
          const result = await enrichFacilityWithSerpApi({
            facilityId,
            placeId,
            facilityName,
            facilityAddress: facilityAddress || "",
            lat,
            lng,
            onProgress: (message) => {
              // Send progress update to client
              sendEvent("progress", { message });
              console.log(`[Enrichment ${facilityId}] ${message}`);
            },
          });

          // Send final result
          sendEvent("complete", result);

          // Close the stream
          controller.close();
        } catch (error: any) {
          console.error("Enrichment error:", error);
          // Send error event
          const message = `event: error\ndata: ${JSON.stringify({
            success: false,
            photosUploaded: 0,
            reviewsCollected: 0,
            sportsIdentified: [],
            tagAssigned: false,
            error: error.message || "Internal server error",
          })}\n\n`;
          controller.enqueue(encoder.encode(message));
          controller.close();
        }
      },
    });

    // Return SSE response
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error: any) {
    console.error("API route error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        photosUploaded: 0,
        reviewsCollected: 0,
        sportsIdentified: [],
        tagAssigned: false,
        error: error.message || "Internal server error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
