/**
 * Shared sport keywords for identifying sports from facility names, reviews, and other text sources.
 * Used across both client and server code for consistency.
 */

export const SPORT_KEYWORDS = {
  // Core Sports
  Basketball: ["basketball", "bball", "hoops"],
  Soccer: ["soccer", "futbol"],
  Baseball: ["baseball", "diamond"],
  Football: ["football", "gridiron"],
  Tennis: ["tennis"],
  Volleyball: ["volleyball", "vball"],
  Swimming: ["swimming", "pool", "aquatic", "natatorium"],
  "Track & Field": ["track", "track and field", "athletics"],

  // Extended Sports
  Golf: ["golf", "putting green", "driving range"],
  Hockey: ["hockey", "ice rink"],
  Lacrosse: ["lacrosse", "lax"],
  Softball: ["softball"],
  Wrestling: ["wrestling", "mat room"],
  Gymnastics: ["gymnastics", "tumbling"],
  Pickleball: ["pickleball"],
  Racquetball: ["racquetball"],
  Squash: ["squash court"],
  Badminton: ["badminton"],

  // Fitness Activities
  "Gym/Fitness": [
    "gym",
    "fitness",
    "24 hour fitness",
    "la fitness",
    "anytime fitness",
    "planet fitness",
    "gold's gym",
    "lifetime fitness",
  ],
  CrossFit: ["crossfit"],
  Yoga: ["yoga"],
  Pilates: ["pilates"],
  "Martial Arts": [
    "martial arts",
    "karate",
    "taekwondo",
    "jiu jitsu",
    "bjj",
    "judo",
    "kickboxing",
    "mma",
  ],
  Boxing: ["boxing"],

  // Other Sports
  Bowling: ["bowling"],
  Skating: ["skating", "skate park", "roller"],
  Climbing: ["climbing", "bouldering"],
  "Water Sports": ["kayak", "canoe", "rowing", "sailing"],
} as const;

export type SportType = keyof typeof SPORT_KEYWORDS;

/**
 * Get all sport types as an array
 */
export function getAllSportTypes(): SportType[] {
  return Object.keys(SPORT_KEYWORDS) as SportType[];
}

/**
 * Find matching keywords in text for a specific sport
 */
export function findMatchingKeywords(
  sport: SportType,
  text: string
): string[] {
  const keywords = SPORT_KEYWORDS[sport] || [];
  const textLower = text.toLowerCase();
  const matched: string[] = [];

  for (const keyword of keywords) {
    if (textLower.includes(keyword)) {
      matched.push(keyword);
    }
  }

  return matched;
}

/**
 * Identify all sports mentioned in text
 */
export function identifySportsInText(text: string): {
  sports: SportType[];
  matchedKeywords: Record<SportType, string[]>;
} {
  const sports: SportType[] = [];
  const matchedKeywords: Record<string, string[]> = {};

  for (const sport of getAllSportTypes()) {
    const keywords = findMatchingKeywords(sport, text);
    if (keywords.length > 0) {
      sports.push(sport);
      matchedKeywords[sport] = keywords;
    }
  }

  return { sports, matchedKeywords };
}
