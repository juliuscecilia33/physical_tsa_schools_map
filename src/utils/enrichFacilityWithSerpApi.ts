/**
 * Utility for enriching a single facility with SerpAPI data
 * Combines logic from:
 * - enrich-partnered-facilities.ts (photo/review scraping)
 * - assign-serpapi-tag.ts (tag assignment)
 * - reassess-sport-metadata-with-serpapi.ts (sport metadata reassessment)
 */

import { createClient } from "@supabase/supabase-js";
import { getJson } from "serpapi";
import axios from "axios";
import sharp from "sharp";
import { SPORT_KEYWORDS, findMatchingKeywords } from "@/constants/sportKeywords";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const serpApiKey = process.env.SERPAPI_API_KEY!;

// Service role client for storage operations and bypassing RLS
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Constants
const STORAGE_BUCKET = "facility-photos";
const SERPAPI_TAG_ID = "e326fe36-5536-4209-87ed-f99528e1d1ee"; // "Scraped by SerpAPI" tag
const MAX_PHOTOS = 40;
const MAX_REVIEWS = 58;
const DELAY_MS = 500;
const WEBP_QUALITY = 80; // WebP compression quality (0-100)

// Interfaces
export interface EnrichmentOptions {
  facilityId: string;
  placeId: string;
  facilityName: string;
  facilityAddress: string;
  lat: number;
  lng: number;
  onProgress?: (message: string) => void;
}

export interface EnrichmentResult {
  success: boolean;
  photosUploaded: number;
  reviewsCollected: number;
  sportsIdentified: string[];
  tagAssigned: boolean;
  error?: string;
}

interface SportMetadata {
  score: number;
  sources: Array<"name" | "review" | "api" | "serp_review">;
  keywords_matched: string[];
  confidence: "high" | "medium" | "low";
  matched_text?: string | string[];
}

interface Review {
  author_name?: string;
  text?: string;
  snippet?: string;
  rating: number;
  user?: {
    name: string;
    thumbnail?: string;
    reviews?: number;
    photos?: number;
  };
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Format bytes for logging
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

/**
 * Calculate compression ratio for logging
 */
function calculateCompressionRatio(before: number, after: number): string {
  if (before === 0) return "0%";
  const ratio = ((before - after) / before) * 100;
  return ratio.toFixed(1) + "%";
}

/**
 * Compress image to WebP format using Sharp
 */
async function compressImageToWebP(imageBuffer: Buffer): Promise<{
  buffer: Buffer;
  originalSize: number;
  compressedSize: number;
} | null> {
  try {
    const originalSize = imageBuffer.length;

    // Compress to WebP with specified quality
    const compressedBuffer = await sharp(imageBuffer)
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();

    const compressedSize = compressedBuffer.length;

    console.log(
      `     ✓ Compressed: ${formatBytes(originalSize)} → ${formatBytes(compressedSize)} (${calculateCompressionRatio(originalSize, compressedSize)} reduction)`
    );

    return {
      buffer: compressedBuffer,
      originalSize,
      compressedSize,
    };
  } catch (error: any) {
    console.log(`     ⚠️  Compression error: ${error.message}`);
    return null;
  }
}

/**
 * Download image from URL and return as Buffer
 */
async function downloadImage(url: string): Promise<Buffer | null> {
  try {
    const response = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 30000,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SerpAPI Image Downloader)",
      },
    });
    return Buffer.from(response.data);
  } catch (error: any) {
    console.log(`Failed to download image: ${error.message}`);
    return null;
  }
}

/**
 * Upload image to Supabase Storage (with WebP compression)
 */
async function uploadImageToStorage(
  facilityId: string,
  imageBuffer: Buffer,
  index: number,
  originalUrl: string
): Promise<string | null> {
  try {
    // Compress image to WebP before uploading
    const compressed = await compressImageToWebP(imageBuffer);

    if (!compressed) {
      console.log(`     ⚠️  Failed to compress image, skipping upload`);
      return null;
    }

    const { buffer: compressedBuffer } = compressed;

    // Always use .webp extension for compressed images
    const timestamp = Date.now();
    const filename = `${facilityId}/${timestamp}_${index}.webp`;

    const { error } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .upload(filename, compressedBuffer, {
        contentType: "image/webp",
        upsert: false,
      });

    if (error) {
      console.log(`     ⚠️  Upload error: ${error.message}`);
      return null;
    }

    const { data: urlData } = supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(filename);

    return urlData.publicUrl;
  } catch (error: any) {
    console.log(`     ⚠️  Exception during upload: ${error.message}`);
    return null;
  }
}

/**
 * Download and upload a single photo
 */
async function processAndUploadPhoto(
  facilityId: string,
  photo: any,
  index: number
): Promise<{ supabaseUrl: string | null; originalData: any; success: boolean }> {
  const originalUrl = photo.image || photo.thumbnail;

  if (!originalUrl) {
    return { supabaseUrl: null, originalData: photo, success: false };
  }

  const imageBuffer = await downloadImage(originalUrl);
  if (!imageBuffer) {
    return { supabaseUrl: null, originalData: photo, success: false };
  }

  const supabaseUrl = await uploadImageToStorage(
    facilityId,
    imageBuffer,
    index,
    originalUrl
  );

  return {
    supabaseUrl,
    originalData: photo,
    success: supabaseUrl !== null,
  };
}

/**
 * Fetch data_id from Google Maps API using place_id
 */
async function getDataIdFromPlaceId(placeId: string): Promise<{
  success: boolean;
  dataId?: string;
  error?: string;
}> {
  try {
    const response = await getJson({
      engine: "google_maps",
      place_id: placeId,
      api_key: serpApiKey,
    });

    const dataId = response.place_results?.data_id;

    if (dataId) {
      return { success: true, dataId };
    }

    return {
      success: false,
      error: "No data_id found in place_id query response",
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Failed to fetch data_id",
    };
  }
}

/**
 * Fetch photos and reviews from SerpAPI
 */
async function fetchSerpApiData(
  placeId: string,
  facilityId: string,
  onProgress?: (message: string) => void
): Promise<{
  success: boolean;
  photos?: any[];
  originalPhotos?: any[];
  reviews?: any[];
  dataId?: string;
  error?: string;
}> {
  let originalPhotos: any[] = [];
  let processedPhotos: any[] = [];
  let reviews: any[] = [];
  let dataId: string | undefined;

  try {
    // Step 1: Get data_id
    onProgress?.("🔍 Getting data_id from Google Maps...");
    const dataIdResult = await getDataIdFromPlaceId(placeId);

    if (!dataIdResult.success) {
      onProgress?.(`⚠️ Could not get data_id, will only fetch reviews`);
    } else {
      dataId = dataIdResult.dataId;
      onProgress?.(`✓ Got data_id`);
    }

    // Step 2: Fetch photos
    if (dataId) {
      onProgress?.(`📸 Fetching photos (up to ${MAX_PHOTOS})...`);
      try {
        let nextPageToken: string | undefined = undefined;
        let pageCount = 0;

        while (originalPhotos.length < MAX_PHOTOS) {
          const photosResponse: any = await getJson({
            engine: "google_maps_photos",
            data_id: dataId,
            ...(nextPageToken && { next_page_token: nextPageToken }),
            api_key: serpApiKey,
          });
          pageCount++;

          const pagePhotos = photosResponse.photos || [];
          originalPhotos.push(...pagePhotos);

          onProgress?.(
            `✓ Page ${pageCount}: ${pagePhotos.length} photos (total: ${originalPhotos.length})`
          );

          nextPageToken = photosResponse.serpapi_pagination?.next_page_token;
          if (!nextPageToken || originalPhotos.length >= MAX_PHOTOS) {
            break;
          }

          await delay(DELAY_MS);
        }

        if (originalPhotos.length > MAX_PHOTOS) {
          originalPhotos = originalPhotos.slice(0, MAX_PHOTOS);
        }

        onProgress?.(
          `✓ Photos collection complete: ${originalPhotos.length} photos`
        );

        // Step 2b: Download and upload photos
        if (originalPhotos.length > 0) {
          onProgress?.(
            `⬇️ Processing and uploading ${originalPhotos.length} photos...`
          );

          let uploaded = 0;
          let failed = 0;

          for (let i = 0; i < originalPhotos.length; i++) {
            const photo = originalPhotos[i];
            onProgress?.(
              `⬇️ Downloading and uploading photo ${i + 1}/${originalPhotos.length}...`
            );

            const result = await processAndUploadPhoto(facilityId, photo, i);

            if (result.success && result.supabaseUrl) {
              processedPhotos.push({
                url: result.supabaseUrl,
                thumbnail: result.supabaseUrl,
              });
              uploaded++;
            } else {
              failed++;
            }

            await delay(300);
          }

          onProgress?.(
            `✓ Upload complete: ${uploaded} uploaded, ${failed} failed`
          );
        }
      } catch (photoError: any) {
        onProgress?.(`⚠️ Photos API error: ${photoError.message}`);
      }

      await delay(DELAY_MS);
    }

    // Step 3: Fetch reviews
    onProgress?.(`⭐ Fetching reviews (up to ${MAX_REVIEWS})...`);
    try {
      let nextPageToken: string | undefined = undefined;
      let pageCount = 0;

      while (reviews.length < MAX_REVIEWS) {
        const reviewsResponse: any = await getJson({
          engine: "google_maps_reviews",
          place_id: placeId,
          ...(nextPageToken && { next_page_token: nextPageToken }),
          api_key: serpApiKey,
        });
        pageCount++;

        const pageReviews = reviewsResponse.reviews || [];
        reviews.push(...pageReviews);

        onProgress?.(
          `✓ Page ${pageCount}: ${pageReviews.length} reviews (total: ${reviews.length})`
        );

        nextPageToken = reviewsResponse.serpapi_pagination?.next_page_token;
        if (!nextPageToken || reviews.length >= MAX_REVIEWS) {
          break;
        }

        await delay(DELAY_MS);
      }

      if (reviews.length > MAX_REVIEWS) {
        reviews = reviews.slice(0, MAX_REVIEWS);
      }

      onProgress?.(
        `✓ Reviews collection complete: ${reviews.length} reviews`
      );
    } catch (reviewError: any) {
      onProgress?.(`⚠️ Reviews API error: ${reviewError.message}`);
    }

    return {
      success: true,
      photos: processedPhotos,
      originalPhotos,
      reviews,
      dataId,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Unknown error",
    };
  }
}

/**
 * Update facility with SerpAPI data
 */
async function updateFacilityWithSerpData(
  facilityId: string,
  photos: any[],
  originalPhotos: any[],
  reviews: any[],
  dataId?: string
): Promise<boolean> {
  try {
    const updateData: any = {
      additional_photos: photos,
      additional_photos_original: originalPhotos,
      additional_reviews: reviews,
      serp_scraped: true,
      serp_scraped_at: new Date().toISOString(),
    };

    if (dataId) {
      updateData.serp_data_id = dataId;
    }

    const { error } = await supabaseAdmin
      .from("sports_facilities")
      .update(updateData)
      .eq("id", facilityId);

    if (error) {
      console.error(`Database error: ${error.message}`);
      return false;
    }

    return true;
  } catch (error: any) {
    console.error(`Error updating facility: ${error.message}`);
    return false;
  }
}

/**
 * Assign SerpAPI tag to facility
 */
async function assignSerpApiTag(placeId: string): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin
      .from("facility_tag_assignments")
      .insert({
        place_id: placeId,
        tag_id: SERPAPI_TAG_ID,
      });

    if (error) {
      // Unique constraint violation means tag already assigned
      if (error.code === "23505") {
        return true;
      }
      console.error(`Tag assignment error: ${error.message}`);
      return false;
    }

    return true;
  } catch (error: any) {
    console.error(`Exception during tag assignment: ${error.message}`);
    return false;
  }
}

/**
 * Calculate confidence score for serp_review matches
 */
function calculateSerpReviewScore(
  keywordCount: number,
  reviewPosition: number
): number {
  const positionBonus = Math.max(0, 15 - Math.floor(reviewPosition / 4));
  const keywordBonus = Math.min(10, keywordCount * 2);
  return 30 + positionBonus + keywordBonus;
}

/**
 * Find matching keywords in review and return full review text
 */
function findMatchingKeywordsInReview(
  sport: string,
  reviewText: string
): { keywords: string[]; fullReview: string } {
  const keywords = findMatchingKeywords(sport as any, reviewText);
  return { keywords, fullReview: reviewText };
}

/**
 * Identify sports from additional_reviews
 */
function identifySportsFromReviews(
  reviews: Review[] | undefined
): {
  sports: string[];
  metadata: Record<string, SportMetadata>;
} {
  const sportsFound = new Set<string>();
  const metadata: Record<string, SportMetadata> = {};

  if (!reviews || reviews.length === 0) {
    return { sports: Array.from(sportsFound), metadata };
  }

  const sportReviewsMap: Record<string, string[]> = {};

  for (const [sport, _keywords] of Object.entries(SPORT_KEYWORDS)) {
    const matchingReviews: string[] = [];

    for (let i = 0; i < reviews.length; i++) {
      const review = reviews[i];
      const reviewText = review.snippet || review.text || "";

      if (!reviewText) continue;

      const match = findMatchingKeywordsInReview(sport, reviewText);

      if (match.keywords.length > 0) {
        matchingReviews.push(match.fullReview);
      }
    }

    if (matchingReviews.length > 0) {
      sportsFound.add(sport);
      sportReviewsMap[sport] = matchingReviews;

      const firstMatchIndex = reviews.findIndex((r) => {
        const text = r.snippet || r.text || "";
        return (
          findMatchingKeywordsInReview(sport, text).keywords.length > 0
        );
      });

      const allKeywords = new Set<string>();
      matchingReviews.forEach((reviewText) => {
        const match = findMatchingKeywordsInReview(sport, reviewText);
        match.keywords.forEach((k) => allKeywords.add(k));
      });

      const score = calculateSerpReviewScore(
        allKeywords.size,
        firstMatchIndex
      );

      metadata[sport] = {
        score,
        sources: ["serp_review"],
        keywords_matched: Array.from(allKeywords),
        confidence: score >= 70 ? "high" : score >= 30 ? "medium" : "low",
        matched_text: matchingReviews,
      };
    }
  }

  return { sports: Array.from(sportsFound), metadata };
}

/**
 * Merge new sport metadata with existing metadata
 */
function mergeSportMetadata(
  existing: SportMetadata | undefined,
  newMetadata: SportMetadata
): SportMetadata {
  if (!existing) {
    return newMetadata;
  }

  const mergedSources = [
    ...new Set([...existing.sources, ...newMetadata.sources]),
  ] as Array<"name" | "review" | "api" | "serp_review">;

  const mergedKeywords = [
    ...new Set([...existing.keywords_matched, ...newMetadata.keywords_matched]),
  ];

  const mergedScore = Math.max(existing.score, newMetadata.score);

  let mergedMatchedText: string | string[] = existing.matched_text || "";

  if (newMetadata.matched_text) {
    if (
      Array.isArray(newMetadata.matched_text) &&
      newMetadata.sources.includes("serp_review")
    ) {
      if (Array.isArray(existing.matched_text)) {
        mergedMatchedText = [
          ...existing.matched_text,
          ...newMetadata.matched_text,
        ];
      } else if (existing.matched_text) {
        mergedMatchedText = [
          existing.matched_text,
          ...newMetadata.matched_text,
        ];
      } else {
        mergedMatchedText = newMetadata.matched_text;
      }
    } else {
      if (newMetadata.sources.includes("name")) {
        mergedMatchedText = newMetadata.matched_text;
      } else if (
        !existing.sources.includes("name") &&
        newMetadata.sources.includes("api")
      ) {
        mergedMatchedText = newMetadata.matched_text;
      } else if (
        !existing.sources.includes("name") &&
        !existing.sources.includes("api") &&
        newMetadata.sources.includes("review")
      ) {
        mergedMatchedText = newMetadata.matched_text;
      }
    }
  }

  const confidence =
    mergedScore >= 70 ? "high" : mergedScore >= 30 ? "medium" : "low";

  return {
    score: mergedScore,
    sources: mergedSources,
    keywords_matched: mergedKeywords,
    confidence,
    matched_text: mergedMatchedText,
  };
}

/**
 * Reassess sport metadata using additional_reviews
 */
async function reassessSportMetadata(
  facilityId: string,
  placeId: string,
  additionalReviews: Review[],
  onProgress?: (message: string) => void
): Promise<string[]> {
  try {
    onProgress?.("🏅 Analyzing reviews for sports...");

    // Get current facility data
    const { data: facility, error: fetchError } = await supabaseAdmin
      .from("sports_facilities")
      .select("identified_sports, sport_metadata")
      .eq("id", facilityId)
      .single();

    if (fetchError) {
      console.error(`Error fetching facility: ${fetchError.message}`);
      return [];
    }

    const existingSports = new Set(facility?.identified_sports || []);
    const existingMetadata = facility?.sport_metadata || {};

    // Identify sports from reviews
    const { sports: newSportsFromReviews, metadata: newMetadata } =
      identifySportsFromReviews(additionalReviews);

    const finalMetadata: Record<string, SportMetadata> = {
      ...existingMetadata,
    };
    const newSports: string[] = [];
    const minScore = 30;

    for (const sport of newSportsFromReviews) {
      const mergedMetadata = mergeSportMetadata(
        existingMetadata[sport],
        newMetadata[sport]
      );

      if (mergedMetadata.score >= minScore) {
        finalMetadata[sport] = mergedMetadata;

        if (!existingSports.has(sport)) {
          newSports.push(sport);
          existingSports.add(sport);
        }
      }
    }

    // Update facility
    const { error: updateError } = await supabaseAdmin
      .from("sports_facilities")
      .update({
        identified_sports: Array.from(existingSports),
        sport_metadata: finalMetadata,
        sport_metadata_reassessed: true,
      })
      .eq("place_id", placeId);

    if (updateError) {
      console.error(`Error updating sport metadata: ${updateError.message}`);
      return [];
    }

    onProgress?.(
      `✓ Sport metadata reassessed: ${newSports.length} new sports identified`
    );

    return newSports;
  } catch (error: any) {
    console.error(`Exception during sport reassessment: ${error.message}`);
    return [];
  }
}

/**
 * Main enrichment function
 */
export async function enrichFacilityWithSerpApi(
  options: EnrichmentOptions
): Promise<EnrichmentResult> {
  const {
    facilityId,
    placeId,
    facilityName,
    facilityAddress,
    lat,
    lng,
    onProgress,
  } = options;

  let photosUploaded = 0;
  let reviewsCollected = 0;
  let sportsIdentified: string[] = [];
  let tagAssigned = false;

  try {
    onProgress?.("🚀 Starting SerpAPI enrichment...");

    // Step 1: Fetch SerpAPI data
    const serpData = await fetchSerpApiData(placeId, facilityId, onProgress);

    if (!serpData.success) {
      return {
        success: false,
        photosUploaded: 0,
        reviewsCollected: 0,
        sportsIdentified: [],
        tagAssigned: false,
        error: serpData.error || "Failed to fetch SerpAPI data",
      };
    }

    photosUploaded = serpData.photos?.length || 0;
    reviewsCollected = serpData.reviews?.length || 0;

    // Step 2: Update facility with data
    onProgress?.("💾 Updating facility with scraped data...");
    const updated = await updateFacilityWithSerpData(
      facilityId,
      serpData.photos || [],
      serpData.originalPhotos || [],
      serpData.reviews || [],
      serpData.dataId
    );

    if (!updated) {
      return {
        success: false,
        photosUploaded,
        reviewsCollected,
        sportsIdentified: [],
        tagAssigned: false,
        error: "Failed to update facility with SerpAPI data",
      };
    }

    // Step 3: Assign SerpAPI tag
    onProgress?.("🏷️ Assigning 'Scraped by SerpAPI' tag...");
    tagAssigned = await assignSerpApiTag(placeId);

    if (tagAssigned) {
      onProgress?.("✓ Tag assigned successfully");
    } else {
      onProgress?.("⚠️ Failed to assign tag (continuing anyway)");
    }

    // Step 4: Reassess sport metadata
    if (serpData.reviews && serpData.reviews.length > 0) {
      sportsIdentified = await reassessSportMetadata(
        facilityId,
        placeId,
        serpData.reviews,
        onProgress
      );
    }

    onProgress?.(
      `✅ Enrichment complete! ${photosUploaded} photos, ${reviewsCollected} reviews, ${sportsIdentified.length} new sports`
    );

    return {
      success: true,
      photosUploaded,
      reviewsCollected,
      sportsIdentified,
      tagAssigned,
    };
  } catch (error: any) {
    console.error("Exception during enrichment:", error);
    return {
      success: false,
      photosUploaded,
      reviewsCollected,
      sportsIdentified,
      tagAssigned,
      error: error.message || "Unknown error during enrichment",
    };
  }
}
