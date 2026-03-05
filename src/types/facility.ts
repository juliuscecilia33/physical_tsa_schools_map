export interface SportMetadata {
  score: number; // 0-100 confidence score
  sources: Array<'name' | 'review' | 'api' | 'serp_review'>; // Where the sport was identified from
  keywords_matched: string[]; // Keywords that triggered identification
  confidence: 'high' | 'medium' | 'low'; // Confidence level
  matched_text?: string | string[]; // The actual text/review(s) that contained the match
}

export interface PhotoData {
  image: string; // Full resolution image URL
  thumbnail: string; // Thumbnail URL
  video?: string; // Optional video URL
  photo_meta_serpapi_link: string; // SerpAPI metadata link
}

export interface Facility {
  id: string; // Database UUID primary key
  place_id: string;
  name: string;
  sport_types: string[];
  identified_sports?: string[];
  sport_metadata?: Record<string, SportMetadata>; // Metadata for each identified sport
  address: string;
  location: {
    lat: number;
    lng: number;
  };
  phone?: string;
  website?: string;
  email?: string[];
  email_scraped_at?: string;
  rating?: number;
  user_ratings_total?: number;
  reviews?: Review[];
  photo_references?: string[];
  opening_hours?: OpeningHours;
  business_status?: string;
  hidden?: boolean;
  cleaned_up?: boolean;
  notes?: Note[];
  has_notes?: boolean;
  tags?: FacilityTag[];
  additional_photos?: PhotoData[]; // Full photo data from SerpAPI (beyond 10 from Google Places)
  additional_reviews?: Review[]; // Full review data from SerpAPI (beyond 5 from Google Places)
  serp_scraped?: boolean; // Whether this facility has been enriched with SerpAPI data
  serp_scraped_at?: string; // Timestamp of when SerpAPI enrichment was performed
  sport_metadata_reassessed?: boolean; // Whether sport_metadata has been re-assessed using additional_reviews
  total_photo_count?: number; // Precomputed total photo count (including review photos)
}

export interface Review {
  // Google Places API fields
  author_name?: string;
  rating: number;
  text?: string;
  time?: string;
  relative_time_description?: string;

  // SerpAPI fields
  date?: string; // Human-readable date (e.g., "2 months ago")
  link?: string; // URL to full review
  snippet?: string; // Review text from SerpAPI
  iso_date?: string; // ISO format timestamp
  likes?: number; // Number of likes/thumbs up on the review
  images?: string[]; // Array of image URLs attached to the review
  user?: {
    name: string;
    thumbnail?: string;
    reviews?: number;
    photos?: number;
    link?: string;
    local_guide?: boolean;
    contributor_id?: string;
  };
}

export interface OpeningHours {
  open_now?: boolean;
  weekday_text?: string[];
}

export interface PhotoReference {
  type: "scraped" | "review";
  scrapedIndex?: number;
  photoData?: PhotoData;
  reviewIndex?: number;
  photoIndexInReview?: number;
  reviewUserName?: string;
  reviewRating?: number;
  url: string;
  thumbnail?: string;
  assignedAt: string;
}

export interface Note {
  id: string;
  place_id: string;
  note_text: string;
  assigned_photo?: PhotoReference | null;
  created_by: string | null; // UUID of the user who created the note (null for legacy notes)
  user_display_name?: string | null; // Display name of the creator (from Google profile)
  user_avatar_url?: string | null; // Avatar URL of the creator (from Google profile)
  created_at: string;
  updated_at: string;
}

export interface FacilityTag {
  id: string;
  name: string;
  color: string;
  description: string | null;
  created_at?: string;
  updated_at?: string;
}

export type VisibilityFilter = 'UNHIDDEN_ONLY' | 'ALL' | 'HIDDEN_ONLY' | 'WITH_NOTES_ONLY' | 'CLEANED_UP_ONLY';

// Lightweight version of Facility for viewport-based loading
// Excludes heavy arrays (reviews, additional_reviews, additional_photos, notes)
// Keeps counts and metadata for popups and filtering
export type FacilityLightweight = Omit<
  Facility,
  'reviews' | 'additional_reviews' | 'additional_photos' | 'notes' | 'sport_metadata'
> & {
  additional_photos_count: number; // Count of additional photos without full array
};

// Map bounds for viewport queries
export interface MapBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
  zoom: number;
}
