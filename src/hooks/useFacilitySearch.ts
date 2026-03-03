/**
 * @fileoverview Google Places API hook for facility/business name search
 *
 * Uses the new Google Places API to search for establishments by name
 * (e.g., "Dynamic Prep", "DBAT", "Lifetime Fitness")
 */

import { useCallback, useRef, useState } from "react";

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;

// ============================================================================
// Types
// ============================================================================

export interface FacilityPrediction {
  placeId: string;
  name: string;
  address: string;
  mainText: string;
  secondaryText: string;
}

export interface FacilityDetails {
  placeId: string;
  name: string;
  address: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  phone?: string;
  website?: string;
}

// Google Places API (New) response types
interface AutocompleteResponse {
  suggestions?: Array<{
    placePrediction?: {
      placeId: string;
      text: { text: string };
      structuredFormat: {
        mainText: { text: string };
        secondaryText?: { text: string };
      };
    };
  }>;
}

interface PlaceDetailsResponse {
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  addressComponents?: Array<{
    longText: string;
    shortText: string;
    types: string[];
  }>;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Fetch autocomplete predictions for establishments/businesses
 * Note: No type restrictions to allow any business (gyms, sports facilities,
 * training centers, etc. like "Dynamic Prep", "DBAT", "Lifetime Fitness")
 */
async function fetchFacilityPredictions(
  input: string,
  sessionToken: string
): Promise<FacilityPrediction[]> {
  if (!input.trim() || !API_KEY) return [];

  try {
    const response = await fetch(
      "https://places.googleapis.com/v1/places:autocomplete",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": API_KEY,
        },
        body: JSON.stringify({
          input,
          includedRegionCodes: ["us"],
          sessionToken,
        }),
      }
    );

    if (!response.ok) {
      console.error("[FacilitySearch] API error:", response.status);
      return [];
    }

    const data: AutocompleteResponse = await response.json();

    if (!data.suggestions) return [];

    return data.suggestions
      .filter((s) => s.placePrediction)
      .map((s) => ({
        placeId: s.placePrediction!.placeId,
        name: s.placePrediction!.structuredFormat.mainText.text,
        address: s.placePrediction!.text.text,
        mainText: s.placePrediction!.structuredFormat.mainText.text,
        secondaryText:
          s.placePrediction!.structuredFormat.secondaryText?.text || "",
      }));
  } catch (error) {
    console.error("[FacilitySearch] Fetch error:", error);
    return [];
  }
}

/**
 * Fetch place details including coordinates, phone, and website
 */
async function fetchFacilityDetails(
  placeId: string,
  sessionToken: string
): Promise<FacilityDetails | null> {
  if (!API_KEY) return null;

  try {
    const response = await fetch(
      `https://places.googleapis.com/v1/places/${placeId}?sessionToken=${sessionToken}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": API_KEY,
          "X-Goog-FieldMask":
            "displayName,formattedAddress,location,addressComponents,nationalPhoneNumber,internationalPhoneNumber,websiteUri",
        },
      }
    );

    if (!response.ok) {
      console.error("[FacilitySearch] Place details error:", response.status);
      return null;
    }

    const data: PlaceDetailsResponse = await response.json();

    if (!data.location) return null;

    // Parse address components
    const getComponent = (type: string, useShort = false): string => {
      const component = data.addressComponents?.find((c) =>
        c.types.includes(type)
      );
      return component
        ? useShort
          ? component.shortText
          : component.longText
        : "";
    };

    let city = getComponent("locality");
    if (!city) city = getComponent("sublocality_level_1");
    if (!city) city = getComponent("administrative_area_level_3");
    if (!city) city = getComponent("administrative_area_level_2");

    const state = getComponent("administrative_area_level_1", true);

    return {
      placeId,
      name: data.displayName?.text || "",
      address: data.formattedAddress || "",
      city,
      state,
      latitude: data.location.latitude,
      longitude: data.location.longitude,
      phone: data.nationalPhoneNumber || data.internationalPhoneNumber,
      website: data.websiteUri,
    };
  } catch (error) {
    console.error("[FacilitySearch] Place details fetch error:", error);
    return null;
  }
}

/**
 * Generate a unique session token for billing purposes
 */
function generateSessionToken(): string {
  return crypto.randomUUID();
}

// ============================================================================
// Hook
// ============================================================================

/**
 * @description Hook for searching facilities by business name using Google Places
 */
export function useFacilitySearch() {
  const [predictions, setPredictions] = useState<FacilityPrediction[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const sessionTokenRef = useRef<string>(generateSessionToken());
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Fetch predictions with debouncing
   */
  const handleInputChange = useCallback((input: string) => {
    if (!input.trim()) {
      setPredictions([]);
      setIsOpen(false);
      return;
    }

    // Debounce
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      setIsLoading(true);

      const results = await fetchFacilityPredictions(
        input,
        sessionTokenRef.current
      );

      setPredictions(results);
      setIsOpen(results.length > 0);
      setSelectedIndex(-1);
      setIsLoading(false);
    }, 300);
  }, []);

  /**
   * Select a prediction and fetch full details
   */
  const selectPrediction = useCallback(
    async (prediction: FacilityPrediction): Promise<FacilityDetails | null> => {
      setIsLoading(true);

      const details = await fetchFacilityDetails(
        prediction.placeId,
        sessionTokenRef.current
      );

      // Reset session token for next autocomplete session
      sessionTokenRef.current = generateSessionToken();

      setPredictions([]);
      setIsOpen(false);
      setIsLoading(false);

      return details;
    },
    []
  );

  /**
   * Keyboard navigation
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen || predictions.length === 0) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < predictions.length - 1 ? prev + 1 : prev
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
          break;
        case "Escape":
          setIsOpen(false);
          setSelectedIndex(-1);
          break;
      }
    },
    [isOpen, predictions]
  );

  /**
   * Close predictions dropdown
   */
  const closePredictions = useCallback(() => {
    setTimeout(() => {
      setIsOpen(false);
      setSelectedIndex(-1);
    }, 200);
  }, []);

  /**
   * Clear state
   */
  const clear = useCallback(() => {
    setPredictions([]);
    setIsOpen(false);
    setSelectedIndex(-1);
  }, []);

  return {
    predictions,
    isOpen,
    isLoading,
    selectedIndex,
    handleInputChange,
    selectPrediction,
    handleKeyDown,
    closePredictions,
    clear,
    hasApiKey: !!API_KEY,
  };
}
