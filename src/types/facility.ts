export interface SportMetadata {
  score: number; // 0-100 confidence score
  sources: Array<'name' | 'review' | 'api'>; // Where the sport was identified from
  keywords_matched: string[]; // Keywords that triggered identification
  confidence: 'high' | 'medium' | 'low'; // Confidence level
  matched_text?: string; // The actual text that contained the match
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
}

export interface Review {
  author_name: string;
  rating: number;
  text: string;
  time: string;
  relative_time_description: string;
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
