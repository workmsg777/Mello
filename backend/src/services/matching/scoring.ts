import type {
  MatchingProfile,
  PairRanking,
  WeightedPreference,
} from '../../types/matching';

export const RANKING_VERSION = 'reciprocal-v2';
export const MINIMUM_SCORE_COVERAGE = 0.2;
const weights = {
  intention: 25,
  values: 25,
  interests: 20,
  options: 10,
  languages: 10,
  location: 5,
  age: 5,
};
const clamp = (x: number) => Math.max(0, Math.min(1, x));
const round = (x: number) => Math.round(x * 1000) / 1000;

export function jaccard(a: string[], b: string[]): number | null {
  if (!a.length || !b.length) return null;
  const left = new Set(a),
    right = new Set(b);
  const common = [...left].filter((id) => right.has(id)).length;
  return common / new Set([...left, ...right]).size;
}
function preferenceFit(
  wanted: WeightedPreference[],
  actual: string[],
): number | null {
  if (!wanted.length || !actual.length) return null;
  const selected = new Set(actual);
  const total = wanted.reduce((sum, p) => sum + p.weight, 0);
  return total
    ? wanted.reduce((sum, p) => sum + (selected.has(p.id) ? p.weight : 0), 0) /
        total
    : null;
}
function alternativeFit(
  wanted: WeightedPreference[],
  actual: string[],
): number | null {
  if (!wanted.length || !actual.length) return null;
  const selected = new Set(actual);
  const highest = Math.max(...wanted.map((p) => p.weight));
  const matched = Math.max(
    0,
    ...wanted.filter((p) => selected.has(p.id)).map((p) => p.weight),
  );
  return highest > 0 ? matched / highest : null;
}
function anyOverlap(left: string[], right: string[]) {
  return left.length && right.length
    ? Number(left.some((id) => right.includes(id)))
    : null;
}
export function distanceKm(
  a: MatchingProfile,
  b: MatchingProfile,
): number | null {
  if (
    a.latitude === null ||
    a.longitude === null ||
    b.latitude === null ||
    b.longitude === null
  )
    return null;
  const rad = (v: number) => (v * Math.PI) / 180;
  const h =
    Math.sin(rad(b.latitude - a.latitude) / 2) ** 2 +
    Math.cos(rad(a.latitude)) *
      Math.cos(rad(b.latitude)) *
      Math.sin(rad(b.longitude - a.longitude) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(clamp(h)));
}
function directional(a: MatchingProfile, b: MatchingProfile) {
  const components: [number, number | null][] = [];
  const intention = a.optionPreferences.DATING_INTENTION;
  const goalFit =
    a.preferSharedIntention === false && !intention?.length
      ? null
      : intention?.length
        ? alternativeFit(intention, b.options.DATING_INTENTION ?? [])
        : anyOverlap(
            a.options.DATING_INTENTION ?? [],
            b.options.DATING_INTENTION ?? [],
          );
  components.push([weights.intention, goalFit]);
  components.push([
    weights.values,
    preferenceFit(a.valuePreferences, b.values),
  ]);
  components.push([weights.interests, jaccard(a.interests, b.interests)]);
  const optionScores = Object.entries(a.optionPreferences)
    .filter(([code]) => code !== 'DATING_INTENTION')
    .map(([code, prefs]) => alternativeFit(prefs, b.options[code] ?? []))
    .filter((value): value is number => value !== null);
  components.push([
    weights.options,
    optionScores.length
      ? optionScores.reduce((s, x) => s + x, 0) / optionScores.length
      : null,
  ]);
  components.push([
    weights.languages,
    a.languagePreferences.length
      ? alternativeFit(a.languagePreferences, b.languages)
      : anyOverlap(a.languages, b.languages),
  ]);
  const distance = distanceKm(a, b);
  components.push([
    weights.location,
    a.preferSameCity && a.cityId && b.cityId
      ? Number(a.cityId === b.cityId)
      : distance !== null && a.maxDistanceKm > 0
        ? clamp(1 - distance / (2 * a.maxDistanceKm))
        : null,
  ]);
  components.push([
    weights.age,
    a.ageIsDealbreaker
      ? null
      : b.age >= a.minAge && b.age <= a.maxAge
        ? 1
        : clamp(
            1 -
              Math.min(Math.abs(b.age - a.minAge), Math.abs(b.age - a.maxAge)) /
                10,
          ),
  ]);
  const known = components.filter(
    (entry): entry is [number, number] => entry[1] !== null,
  );
  const available = known.reduce((sum, [weight]) => sum + weight, 0);
  return {
    score: available
      ? (100 *
          known.reduce((sum, [weight, value]) => sum + weight * value, 0)) /
        available
      : null,
    goalFit,
    coverage: available / 100,
    domains: known.filter(([weight]) => weight >= 10).length,
  };
}

function publicReasons(a: MatchingProfile, b: MatchingProfile) {
  const reasons: string[] = [];
  const sharedLabel = (
    left: string[],
    right: string[],
    wantedA: WeightedPreference[] = [],
    wantedB: WeightedPreference[] = [],
  ) => {
    const allowed = (id: string, prefs: WeightedPreference[]) =>
      !prefs.length || prefs.some((p) => p.id === id);
    const id = left
      .filter(
        (item) =>
          right.includes(item) &&
          allowed(item, wantedA) &&
          allowed(item, wantedB),
      )
      .sort()[0];
    return id ? a.labels?.get(id) : undefined;
  };
  const intention = sharedLabel(
    a.options.DATING_INTENTION ?? [],
    b.options.DATING_INTENTION ?? [],
    a.optionPreferences.DATING_INTENTION,
    b.optionPreferences.DATING_INTENTION,
  );
  if (
    intention &&
    a.preferSharedIntention !== false &&
    b.preferSharedIntention !== false &&
    a.publicIntentions &&
    b.publicIntentions
  )
    reasons.push(`You both selected “${intention}” as a dating goal.`);
  const interest = sharedLabel(a.interests, b.interests);
  if (interest && a.publicInterests && b.publicInterests)
    reasons.push(`You both enjoy ${interest}.`);
  const language = sharedLabel(
    a.languages,
    b.languages,
    a.languagePreferences,
    b.languagePreferences,
  );
  if (language && a.publicLanguages && b.publicLanguages)
    reasons.push(`You both speak ${language}.`);
  return reasons;
}

/** Symmetric, conservative alignment. Missing data is unknown, not disagreement. */
export function scorePair(
  a: MatchingProfile,
  b: MatchingProfile,
  semantic?: number,
): PairRanking {
  if (!a.personalized || !b.personalized)
    return {
      score: null,
      scoreUnavailable: 'PERSONALIZATION_REQUIRED',
      coverage: 0,
      effectiveScore: 50,
      mode: 'BASELINE',
      version: RANKING_VERSION,
      reasons: [],
    };
  const ab = directional(a, b),
    ba = directional(b, a);
  const coverage = Math.min(ab.coverage, ba.coverage);
  const ruleScore =
    ab.score === null || ba.score === null || coverage < MINIMUM_SCORE_COVERAGE
      ? null
      : Math.min(ab.score, ba.score);
  const useSemantic =
    ruleScore !== null &&
    ab.goalFit !== 0 &&
    ba.goalFit !== 0 &&
    semantic !== undefined &&
    Number.isFinite(semantic) &&
    semantic >= 0 &&
    semantic <= 1;
  const score =
    ruleScore === null
      ? null
      : Math.round(useSemantic ? 0.8 * ruleScore + 20 * semantic : ruleScore);
  const displayScore =
    coverage >= 0.4 && Math.min(ab.domains, ba.domains) >= 2 ? score : null;
  return {
    score: displayScore,
    ...(displayScore === null && {
      scoreUnavailable: 'INSUFFICIENT_PROFILE_DATA' as const,
    }),
    coverage: round(coverage),
    mode: useSemantic ? 'HYBRID' : 'RULES',
    version: RANKING_VERSION,
    // Shrink sparse evidence towards neutral instead of promoting a one-answer 100/100.
    effectiveScore: round((score ?? 50) * coverage + 50 * (1 - coverage)),
    reasons: publicReasons(a, b),
  };
}
