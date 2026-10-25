const positiveInteger = (name: string, fallback: number): number => {
  const value = Number(process.env[name] ?? fallback);
  return Number.isInteger(value) && value > 0 ? value : fallback;
};

/** Adjustable onboarding rules; schema constraints only protect durable invariants. */
export const datingProfileConfig = {
  minimumAge: positiveInteger('DATING_MINIMUM_AGE', 18),
  minimumPhotos: positiveInteger('DATING_MINIMUM_PHOTOS', 3),
  maximumPhotos: positiveInteger('DATING_MAXIMUM_PHOTOS', 6),
  minimumInterests: positiveInteger('DATING_MINIMUM_INTERESTS', 3),
  maximumInterests: positiveInteger('DATING_MAXIMUM_INTERESTS', 8),
  maximumPromptAnswers: positiveInteger('DATING_MAXIMUM_PROMPT_ANSWERS', 3),
  consentPolicyVersion: process.env.CONSENT_POLICY_VERSION?.trim() || '1.0',
  requiredConsentCodes: ['TERMS', 'PRIVACY_POLICY'] as const,
} as const;
