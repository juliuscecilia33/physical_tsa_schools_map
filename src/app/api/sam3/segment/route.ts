import { NextRequest, NextResponse } from "next/server";

const SAM3_SERVER_URL = process.env.SAM3_SERVER_URL || "http://localhost:8000";

// Texas bounding box limits
const TEXAS_BOUNDS = {
  west: -106.7,
  south: 25.8,
  east: -93.5,
  north: 36.5,
};

// Max bbox area in square degrees (~50km x 50km at Texas latitudes)
const MAX_BBOX_AREA = 0.05;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { bbox, prompt, zoom, box_threshold, text_threshold } = body;

    // Validate bbox
    if (!bbox || !Array.isArray(bbox) || bbox.length !== 4) {
      return NextResponse.json(
        { error: "bbox must be [west, south, east, north]" },
        { status: 400 }
      );
    }

    const [west, south, east, north] = bbox;

    // Validate bbox is within Texas
    if (
      west < TEXAS_BOUNDS.west ||
      south < TEXAS_BOUNDS.south ||
      east > TEXAS_BOUNDS.east ||
      north > TEXAS_BOUNDS.north
    ) {
      return NextResponse.json(
        { error: "Bounding box must be within Texas" },
        { status: 400 }
      );
    }

    // Validate bbox area
    const area = Math.abs((east - west) * (north - south));
    if (area > MAX_BBOX_AREA) {
      return NextResponse.json(
        {
          error: `Bounding box too large (${area.toFixed(4)} sq deg). Max: ${MAX_BBOX_AREA} sq deg. Zoom in more.`,
        },
        { status: 400 }
      );
    }

    // Validate prompt
    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return NextResponse.json(
        { error: "Text prompt is required" },
        { status: 400 }
      );
    }

    // Proxy to FastAPI server
    const response = await fetch(`${SAM3_SERVER_URL}/segment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bbox,
        prompt: prompt.trim(),
        zoom: zoom ?? 18,
        box_threshold: box_threshold ?? 0.24,
        text_threshold: text_threshold ?? 0.24,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json(
        { error: `SAM3 server error: ${err}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("SAM3 segment proxy error:", error);
    return NextResponse.json(
      { error: "Failed to connect to SAM3 server. Is it running on port 8000?" },
      { status: 502 }
    );
  }
}
