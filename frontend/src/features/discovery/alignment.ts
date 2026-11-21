import type { DiscoveryCard } from "../../types/discovery";

export function alignmentScore(person: DiscoveryCard): number | null {
  return person.compatibility.isDemo
    ? person.compatibility.percentage
    : (person.ranking?.score ?? null);
}

export function alignmentLabel(person: DiscoveryCard): string {
  const score = alignmentScore(person);
  if (score === null) return "Alignment unavailable";
  return person.compatibility.isDemo
    ? `${score}% demo match`
    : `${score}% profile alignment`;
}

export function alignmentExplanation(person: DiscoveryCard): string {
  if (person.compatibility.isDemo)
    return "Illustrative score for this demo profile.";
  const ranking = person.ranking;
  if (ranking?.score != null) {
    return `Based on interests, preferences, and other available profile information. Information coverage is ${Math.round(ranking.coverage * 100)}%.`;
  }
  if (ranking?.scoreUnavailable === "INSUFFICIENT_PROFILE_DATA") {
    return "There isn’t enough eligible profile information to calculate an alignment percentage.";
  }
  if (
    ranking?.scoreUnavailable === "PERSONALIZATION_REQUIRED" ||
    (ranking?.mode === "BASELINE" && !ranking.scoreUnavailable)
  ) {
    return "An alignment percentage appears when both people enable personalized matching and enough profile information is available.";
  }
  return "An alignment percentage is unavailable for this profile.";
}
