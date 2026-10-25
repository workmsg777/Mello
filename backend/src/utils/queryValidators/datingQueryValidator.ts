import { z, ZodError, type ZodType } from 'zod';
import Errors from '../../errors';

const uuid = z.string().uuid();
const nullableTrimmed = (max: number) =>
  z.string().trim().max(max).nullable().optional();

function parse<T>(schema: ZodType<T>, value: unknown): T {
  try {
    return schema.parse(value);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new Errors.BadRequestError(
        error.issues
          .map((issue) => {
            const field = issue.path.join('.');
            return field ? `${field}: ${issue.message}` : issue.message;
          })
          .join(', '),
      );
    }
    throw error;
  }
}

const profileSchema = z.object({
  displayName: z.string().trim().min(1).max(100),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  bio: nullableTrimmed(500),
  heightCm: z.number().int().positive().nullable().optional(),
  jobTitle: nullableTrimmed(150),
  companyName: nullableTrimmed(150),
  schoolName: nullableTrimmed(200),
  currentCityId: uuid.nullable().optional(),
  hometownCityId: uuid.nullable().optional(),
});

const profileOptionSelectionsSchema = z.object({
  selections: z
    .array(
      z.object({
        optionId: uuid,
        isPrimary: z.boolean().optional(),
        displayOrder: z.number().int().nonnegative().nullable().optional(),
      }),
    )
    .max(50),
});

const visibilitySchema = z.object({
  visibility: z.enum(['PROFILE', 'MATCHING_ONLY', 'PRIVATE']),
});

const matchPreferencesSchema = z.object({
  minAge: z.number().int().min(18).max(120),
  maxAge: z.number().int().min(18).max(120),
  maxDistanceKm: z.number().int().positive().max(20_000),
  ageIsDealbreaker: z.boolean().optional(),
  distanceIsDealbreaker: z.boolean().optional(),
  verifiedProfilesOnly: z.boolean().optional(),
  preferSameCity: z.boolean().optional(),
});

const optionPreferencesSchema = z.object({
  preferences: z
    .array(
      z.object({
        optionId: uuid,
        isDealbreaker: z.boolean().optional(),
        priority: z.number().int().min(1).max(5).optional(),
      }),
    )
    .max(50),
});

const interestsSchema = z.object({
  selections: z
    .array(
      z.object({
        interestId: uuid,
        isFavorite: z.boolean().optional(),
        displayOrder: z.number().int().nonnegative().nullable().optional(),
      }),
    )
    .max(20),
});

const languagesSchema = z.object({
  selections: z
    .array(
      z.object({
        languageId: uuid,
        proficiency: z
          .enum(['NATIVE', 'FLUENT', 'CONVERSATIONAL', 'BASIC'])
          .nullable()
          .optional(),
        isPrimary: z.boolean().optional(),
        displayOrder: z.number().int().nonnegative().nullable().optional(),
      }),
    )
    .max(30),
});

const languagePreferencesSchema = z.object({
  preferences: z
    .array(
      z.object({
        languageId: uuid,
        isDealbreaker: z.boolean().optional(),
        priority: z.number().int().min(1).max(5).optional(),
      }),
    )
    .max(30),
});

const valuesSchema = z.object({
  selections: z
    .array(
      z.object({
        valueId: uuid,
        importance: z.number().int().min(1).max(5).optional(),
        displayOrder: z.number().int().nonnegative().nullable().optional(),
      }),
    )
    .max(30),
});

const partnerValuesSchema = z.object({
  preferences: z
    .array(
      z.object({
        valueId: uuid,
        importance: z.number().int().min(1).max(5).optional(),
        isDealbreaker: z.boolean().optional(),
      }),
    )
    .max(30),
});

const promptAnswerSchema = z.object({
  answerText: z.string().trim().max(5_000).nullable().optional(),
  mediaId: uuid.nullable().optional(),
  displayOrder: z.number().int().nonnegative(),
});

const personalityResultSchema = z.object({
  personalityTypeId: uuid.nullable().optional(),
  scores: z.record(z.string(), z.number()).nullable().optional(),
  source: z.enum(['SELF_DECLARED', 'IN_APP_TEST', 'IMPORTED']),
  confidence: z.number().min(0).max(1).nullable().optional(),
  isUsedForMatching: z.boolean().optional(),
});

const onboardingStartSchema = z.object({
  onboardingVersion: z.number().int().positive(),
  firstStepId: uuid,
});

const onboardingStepSchema = z.object({
  onboardingVersion: z.number().int().positive(),
  status: z.enum(['COMPLETED', 'SKIPPED']),
});

const onboardingCompleteSchema = z.object({
  onboardingVersion: z.number().int().positive(),
});

const consentSchema = z.object({
  consentCode: z.string().trim().min(1).max(100),
  policyVersion: z.string().trim().min(1).max(50),
  status: z.enum(['GRANTED', 'REVOKED']),
});

const photoOrderSchema = z.object({
  photoIds: z.array(uuid).min(1).max(6),
  primaryPhotoId: uuid,
});

const idParamsSchema = z.object({ id: uuid });
const categoryParamsSchema = z.object({ categoryId: uuid });
const fieldParamsSchema = z.object({
  fieldCode: z.string().trim().min(1).max(100),
});
const promptParamsSchema = z.object({ promptId: uuid });
const frameworkParamsSchema = z.object({ frameworkId: uuid });
const stepParamsSchema = z.object({ stepId: uuid });
const citySearchSchema = z.object({
  search: z.string().trim().max(150).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export type DatingProfileInput = z.infer<typeof profileSchema>;
export type ProfileOptionSelectionsInput = z.infer<
  typeof profileOptionSelectionsSchema
>;
export type VisibilityInput = z.infer<typeof visibilitySchema>;
export type MatchPreferencesInput = z.infer<typeof matchPreferencesSchema>;
export type OptionPreferencesInput = z.infer<typeof optionPreferencesSchema>;
export type InterestsInput = z.infer<typeof interestsSchema>;
export type LanguagesInput = z.infer<typeof languagesSchema>;
export type LanguagePreferencesInput = z.infer<
  typeof languagePreferencesSchema
>;
export type ValuesInput = z.infer<typeof valuesSchema>;
export type PartnerValuesInput = z.infer<typeof partnerValuesSchema>;
export type PromptAnswerBody = z.infer<typeof promptAnswerSchema>;
export type PersonalityResultBody = z.infer<typeof personalityResultSchema>;
export type OnboardingStartInput = z.infer<typeof onboardingStartSchema>;
export type OnboardingStepInput = z.infer<typeof onboardingStepSchema>;
export type OnboardingCompleteInput = z.infer<typeof onboardingCompleteSchema>;
export type ConsentInput = z.infer<typeof consentSchema>;
export type PhotoOrderInput = z.infer<typeof photoOrderSchema>;
export type CitySearchInput = z.infer<typeof citySearchSchema>;

export const validateDatingProfile = (value: unknown) =>
  parse(profileSchema, value);
export const validateProfileOptionSelections = (value: unknown) =>
  parse(profileOptionSelectionsSchema, value);
export const validateVisibility = (value: unknown) =>
  parse(visibilitySchema, value);
export const validateMatchPreferences = (value: unknown) =>
  parse(matchPreferencesSchema, value);
export const validateOptionPreferences = (value: unknown) =>
  parse(optionPreferencesSchema, value);
export const validateInterests = (value: unknown) =>
  parse(interestsSchema, value);
export const validateLanguages = (value: unknown) =>
  parse(languagesSchema, value);
export const validateLanguagePreferences = (value: unknown) =>
  parse(languagePreferencesSchema, value);
export const validateValues = (value: unknown) => parse(valuesSchema, value);
export const validatePartnerValues = (value: unknown) =>
  parse(partnerValuesSchema, value);
export const validatePromptAnswer = (value: unknown) =>
  parse(promptAnswerSchema, value);
export const validatePersonalityResult = (value: unknown) =>
  parse(personalityResultSchema, value);
export const validateOnboardingStart = (value: unknown) =>
  parse(onboardingStartSchema, value);
export const validateOnboardingStep = (value: unknown) =>
  parse(onboardingStepSchema, value);
export const validateOnboardingComplete = (value: unknown) =>
  parse(onboardingCompleteSchema, value);
export const validateConsent = (value: unknown) => parse(consentSchema, value);
export const validatePhotoOrder = (value: unknown) =>
  parse(photoOrderSchema, value);
export const validateIdParams = (value: unknown) =>
  parse(idParamsSchema, value);
export const validateCategoryParams = (value: unknown) =>
  parse(categoryParamsSchema, value);
export const validateFieldParams = (value: unknown) =>
  parse(fieldParamsSchema, value);
export const validatePromptParams = (value: unknown) =>
  parse(promptParamsSchema, value);
export const validateFrameworkParams = (value: unknown) =>
  parse(frameworkParamsSchema, value);
export const validateStepParams = (value: unknown) =>
  parse(stepParamsSchema, value);
export const validateCitySearch = (value: unknown) =>
  parse(citySearchSchema, value);
