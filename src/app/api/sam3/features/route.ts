import { NextRequest, NextResponse } from "next/server";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!, {
  ssl: { rejectUnauthorized: false },
  max: 10,
});

export async function GET() {
  try {
    const rows = await sql`
      SELECT
        id,
        ST_AsGeoJSON(geometry)::json AS geojson,
        sport_type,
        area_sqm,
        rectangularity,
        aspect_ratio,
        compactness,
        created_at
      FROM sam3_features
      ORDER BY created_at DESC
    `;

    const features = rows.map((row) => ({
      type: "Feature" as const,
      geometry: row.geojson,
      properties: {
        id: row.id,
        sport_type: row.sport_type,
        area_sqm: row.area_sqm,
        rectangularity: row.rectangularity,
        aspect_ratio: row.aspect_ratio,
        compactness: row.compactness,
        created_at: row.created_at,
        saved: true,
      },
    }));

    return NextResponse.json({
      type: "FeatureCollection",
      features,
    });
  } catch (error: any) {
    console.error("GET /api/sam3/features error:", error);
    return NextResponse.json(
      { error: "Failed to load saved features", details: error?.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { geojson, sport_type } = body;

    if (!geojson?.features?.length || !sport_type) {
      return NextResponse.json(
        { error: "geojson (with features) and sport_type are required" },
        { status: 400 }
      );
    }

    const inserted: string[] = [];
    for (const feature of geojson.features) {
      const props = (feature.properties as Record<string, unknown>) ?? {};
      const geojsonStr = JSON.stringify(feature.geometry);

      const [row] = await sql`
        INSERT INTO sam3_features (geometry, sport_type, area_sqm, rectangularity, aspect_ratio, compactness)
        VALUES (
          ST_GeogFromGeoJSON(${geojsonStr}),
          ${sport_type},
          ${(props.area_sqm as number) ?? null},
          ${(props.rectangularity as number) ?? null},
          ${(props.aspect_ratio as number) ?? null},
          ${(props.compactness as number) ?? null}
        )
        RETURNING id
      `;
      inserted.push(row.id);
    }

    return NextResponse.json({
      message: `Saved ${inserted.length} features`,
      ids: inserted,
    });
  } catch (error: any) {
    console.error("POST /api/sam3/features error:", error);
    return NextResponse.json(
      { error: "Failed to save features", details: error?.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const ids: string[] = body.ids || (body.id ? [body.id] : []);

    if (ids.length === 0) {
      return NextResponse.json(
        { error: "id or ids required" },
        { status: 400 }
      );
    }

    const result = await sql`
      DELETE FROM sam3_features WHERE id = ANY(${ids}::uuid[])
    `;

    return NextResponse.json({
      message: `Deleted ${result.count} features`,
    });
  } catch (error: any) {
    console.error("DELETE /api/sam3/features error:", error);
    return NextResponse.json(
      { error: "Failed to delete features", details: error?.message },
      { status: 500 }
    );
  }
}
