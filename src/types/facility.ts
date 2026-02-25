export interface SportMetadata {
  score: number; // 0-100 confidence score
  sources: Array<'name' | 'review' | 'api'>; // Where the sport was identified from
  keywords_matched: string[]; // Keywords that triggered identification
  confidence: 'high' | 'medium' | 'low'; // Confidence level
  matched_text?: string; // The actual text that contained the match
}

export interface PhotoData {
  image: string; // Full resolution image URL
  thumbnail: string; // Thumbnail URL
  video?: string; // Optional video URL
  photo_meta_serpapi_link: string; // SerpAPI metadata link
}

export interface Facility {
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

export interface Note {
  id: string;
  place_id: string;
  note_text: string;
  created_at: string;
  updated_at: string;
}

export interface FacilityTag {
  id: string;
  name: string;
  color: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

export type VisibilityFilter = 'UNHIDDEN_ONLY' | 'ALL' | 'HIDDEN_ONLY' | 'WITH_NOTES_ONLY' | 'CLEANED_UP_ONLY';

// Lightweight version of Facility for viewport-based loading
// Excludes heavy arrays (reviews, additional_reviews, additional_photos, notes)
// Keeps counts and metadata for popups and filtering
export type FacilityLightweight = Omit<
  Facility,
  'reviews' | 'additional_reviews' | 'additional_photos' | 'notes'
>;

// Map bounds for viewport queries
export interface MapBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
  zoom: number;
}
