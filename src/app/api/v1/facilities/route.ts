import { NextRequest } from "next/server";
import { gzip } from "zlib";
import { promisify } from "util";
import sql from "@/lib/db/public-api";

const gzipAsync = promisify(gzip);

const SORT_WHITELIST = ["name", "rating", "created_at"] as const;
const ORDER_WHITELIST = ["asc", "desc"] as const;
const MAX_LIMIT = 200;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(searchParams.get("limit") || "50", 10) || 50));
    const offset = (page - 1) * limit;

    const serpScrapedParam = searchParams.get("serp_scraped");
    const serpScraped = serpScrapedParam === null ? true : serpScrapedParam === "true";

    const sport = searchParams.get("sport");
    const q = searchParams.get("q");

    const sortParam = searchParams.get("sort") || "name";
    const sort = SORT_WHITELIST.includes(sortParam as any) ? sortParam : "name";

    const orderParam = (searchParams.get("order") || "asc").toLowerCase();
    const order = ORDER_WHITELIST.includes(orderParam as any) ? orderParam : "asc";

    // Build WHERE clauses
    const conditions: string[] = ["(hidden IS NULL OR hidden = false)"];
    const values: any[] = [];
    let paramIndex = 1;

    conditions.push(`serp_scraped = $${paramIndex}`);
    values.push(serpScraped);
    paramIndex++;

    if (sport) {
      conditions.push(`$${paramIndex} = ANY(identified_sports)`);
      values.push(sport);
      paramIndex++;
    }

    if (q) {
      conditions.push(`name ILIKE $${paramIndex}`);
      values.push(`%${q}%`);
      paramIndex++;
    }

    const whereClause = conditions.join(" AND ");

    // Count total
    const countQuery = `SELECT COUNT(*) AS total FROM sports_facilities WHERE ${whereClause}`;
    const countResult = await sql.unsafe(countQuery, values);
    const total = parseInt(countResult[0].total, 10);
    const totalPages = Math.ceil(total / limit);

    // Fetch paginated data
    const dataQuery = `
      SELECT
        id,
        place_id,
        name,
        sport_types,
        identified_sports,
        address,
        ST_Y(location::geometry) AS lat,
        ST_X(location::geometry) AS lng,
        phone,
        website,
        rating,
        user_ratings_total,
        photo_references,
        opening_hours,
        business_status,
        serp_scraped,
        serp_scraped_at,
        additional_photos,
        additional_reviews,
        COALESCE(array_length(photo_references, 1), 0) + COALESCE(jsonb_array_length(additional_photos), 0) AS total_photo_count
      FROM sports_facilities
      WHERE ${whereClause}
      ORDER BY ${sort} ${order}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const rows = await sql.unsafe(dataQuery, [...values, limit, offset]);

    const data = rows.map((r: any) => ({
      id: r.id,
      place_id: r.place_id,
      name: r.name,
      sport_types: r.sport_types || [],
      identified_sports: r.identified_sports || [],
      address: r.address,
      location: { lat: parseFloat(r.lat), lng: parseFloat(r.lng) },
      phone: r.phone,
      website: r.website,
      rating: r.rating ? parseFloat(r.rating) : null,
      user_ratings_total: r.user_ratings_total ? parseInt(r.user_ratings_total, 10) : null,
      photo_references: r.photo_references || [],
      opening_hours: r.opening_hours,
      business_status: r.business_status,
      serp_scraped: r.serp_scraped,
      serp_scraped_at: r.serp_scraped_at,
      additional_photos: r.additional_photos || [],
      additional_reviews: r.additional_reviews || [],
      total_photo_count: parseInt(r.total_photo_count, 10) || 0,
    }));

    const responseBody = {
      data,
      pagination: {
        total,
        page,
        limit,
        total_pages: totalPages,
        has_next: page < totalPages,
        has_prev: page > 1,
      },
    };

    const jsonString = JSON.stringify(responseBody);

    // Gzip if response > 50KB
    if (jsonString.length > 50 * 1024) {
      const compressed = await gzipAsync(jsonString);
      return new Response(compressed, {
        headers: {
          "Content-Type": "application/json",
          "Content-Encoding": "gzip",
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      });
    }

    return new Response(jsonString, {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (error: any) {
    console.error("Public API list error:", error);
    return Response.json(
      { error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
