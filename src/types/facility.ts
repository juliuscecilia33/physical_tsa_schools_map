export interface Facility {
  place_id: string;
  name: string;
  sport_types: string[];
  identified_sports?: string[];
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
  notes?: Note[];
  has_notes?: boolean;
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
