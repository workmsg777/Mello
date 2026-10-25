import type { Href } from "expo-router";
import type { DatingCatalog, DatingState } from "../types/dating";

export const stepPathByCode: Record<string, Href> = {
  BASIC_PROFILE: "/onboarding/basic-profile",
  IDENTITY: "/onboarding/identity",
  DISCOVERY_PREFERENCES: "/onboarding/match-preferences",
  LOCATION: "/onboarding/location",
  PHOTOS: "/onboarding/photos",
  DATING_INTENTIONS: "/onboarding/dating-intentions",
  INTERESTS: "/onboarding/interests",
  PROMPTS: "/onboarding/prompts",
  LIFESTYLE: "/onboarding/lifestyle",
  LANGUAGES: "/onboarding/languages",
  VALUES: "/onboarding/values",
  PERSONALITY: "/onboarding/personality",
};

export function resumePath(catalog: DatingCatalog, state: DatingState): Href {
  const progress = state.onboarding.progress;
  if (!progress) return "/onboarding";
  if (!progress.currentStepId) return "/onboarding/preview";
  const step = catalog.onboardingSteps.find(
    ({ id }) => id === progress.currentStepId,
  );
  return step ? (stepPathByCode[step.code] ?? "/onboarding") : "/onboarding";
}

export function stepByCode(catalog: DatingCatalog, code: string) {
  const step = catalog.onboardingSteps.find((item) => item.code === code);
  if (!step) throw new Error(`Onboarding step is missing: ${code}`);
  return step;
}
