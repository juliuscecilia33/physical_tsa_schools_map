export interface Facility {
  place_id: string;
  name: string;
  sport_types: string[];
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
}

export interface Review {
  author_name: string;
  rating: number;
  text: string;
  time: number;
  relative_time_description: string;
}

export interface OpeningHours {
  open_now?: boolean;
  weekday_text?: string[];
}
