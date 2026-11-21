export interface WeightedPreference {
  id: string;
  weight: number;
}
export interface MatchingProfile {
  userId: string;
  personalized: boolean;
  age: number;
  cityId: string | null;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
  interests: string[];
  languages: string[];
  publicInterests?: boolean;
  publicLanguages?: boolean;
  preferSharedIntention?: boolean;
  publicIntentions?: boolean;
  labels?: ReadonlyMap<string, string>;
  values: string[];
  valuePreferences: WeightedPreference[];
  languagePreferences: WeightedPreference[];
  options: Record<string, string[]>;
  optionPreferences: Record<string, WeightedPreference[]>;
  minAge: number;
  maxAge: number;
  ageIsDealbreaker: boolean;
  maxDistanceKm: number;
  preferSameCity: boolean;
  semanticText: string;
}
export interface Ranking {
  score: number | null;
  scoreUnavailable?:
    'PERSONALIZATION_REQUIRED' | 'INSUFFICIENT_PROFILE_DATA' | 'UNAVAILABLE';
  coverage: number;
  mode: 'BASELINE' | 'RULES' | 'HYBRID';
  version: string;
  reasons: string[];
}
export interface PairRanking extends Ranking {
  effectiveScore: number;
}
export interface FeedCycle {
  shuffleSeed?: string | undefined;
  after?: string | undefined;
  feedSessionId?: string | undefined;
  cursor?: number | undefined;
}
