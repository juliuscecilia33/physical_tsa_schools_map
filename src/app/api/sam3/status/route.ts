import { NextRequest, NextResponse } from "next/server";

const SAM3_SERVER_URL = process.env.SAM3_SERVER_URL || "http://localhost:8000";

export async function GET(request: NextRequest) {
  try {
    const jobId = request.nextUrl.searchParams.get("jobId");

    if (!jobId) {
      return NextResponse.json({ error: "jobId parameter required" }, { status: 400 });
    }

    const response = await fetch(`${SAM3_SERVER_URL}/status/${jobId}`);

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
    console.error("SAM3 status proxy error:", error);
    return NextResponse.json(
      { error: "Failed to connect to SAM3 server. Is it running on port 8000?" },
      { status: 502 }
    );
  }
}
