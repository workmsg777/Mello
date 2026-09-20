export type VisibilityMode = "PROFILE" | "MATCHING_ONLY" | "PRIVATE";
export type StepStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "SKIPPED";

export interface CatalogItem {
  id: string;
  code: string;
  name?: string;
  label?: string;
  description?: string | null;
  categoryId?: string;
  displayOrder?: number;
}

export interface ProfileOptionCategory extends CatalogItem {
  name: string;
  selectionMode: "SINGLE" | "MULTIPLE";
  minSelections: number;
  maxSelections: number | null;
  isSensitive: boolean;
  allowProfileVisibility: boolean;
  allowMatchPreference: boolean;
  allowDealbreaker: boolean;
  isRequiredForOnboarding: boolean;
}

export interface ProfileOption extends CatalogItem {
  categoryId: string;
  label: string;
}

export interface OnboardingStep extends CatalogItem {
  name: string;
  onboardingVersion: number;
  sequence: number;
  isRequired: boolean;
  isSkippable: boolean;
}

export interface DatingCatalog {
  onboardingVersion: number;
  rules: {
    minimumAge: number;
    minimumPhotos: number;
    maximumPhotos: number;
    minimumInterests: number;
    maximumInterests: number;
    maximumPromptAnswers: number;
  };
  consent: {
    policyVersion: string;
    requiredCodes: string[];
    optionalCodes: string[];
  };
  profileOptionCategories: ProfileOptionCategory[];
  profileOptions: ProfileOption[];
  interestCategories: CatalogItem[];
  interests: Array<CatalogItem & { categoryId: string; name: string }>;
  languages: Array<{
    id: string;
    isoCode: string;
    name: string;
    nativeName: string | null;
  }>;
  promptCategories: CatalogItem[];
  prompts: Array<
    CatalogItem & {
      categoryId: string;
      promptText: string;
      maxAnswerLength: number;
    }
  >;
  values: Array<CatalogItem & { name: string }>;
  personalityFrameworks: Array<
    CatalogItem & { name: string; resultMode: string }
  >;
  personalityTypes: Array<CatalogItem & { frameworkId: string; name: string }>;
  onboardingSteps: OnboardingStep[];
}

export interface PrivateProfile {
  id: string;
  displayName: string;
  dateOfBirth: string;
  bio: string | null;
  heightCm: number | null;
  jobTitle: string | null;
  companyName: string | null;
  schoolName: string | null;
  currentCityId: string | null;
  hometownCityId: string | null;
  profileStatus: "DRAFT" | "ACTIVE" | "PAUSED";
}

export interface UserPhoto {
  id: string;
  mediaId: string;
  url: string | null;
  mimeType: string | null;
  displayOrder: number;
  isPrimary: boolean;
  moderationStatus: string;
}

export interface DatingState {
  profile: PrivateProfile | null;
  profileOptions: Array<{
    categoryId: string;
    optionId: string;
    isPrimary: boolean;
    displayOrder: number | null;
  }>;
  visibility: Array<{ fieldCode: string; visibility: VisibilityMode }>;
  matchPreferences: {
    minAge: number;
    maxAge: number;
    maxDistanceKm: number;
    ageIsDealbreaker: boolean;
    distanceIsDealbreaker: boolean;
    verifiedProfilesOnly: boolean;
    preferSameCity: boolean;
  } | null;
  optionPreferences: Array<{
    categoryId: string;
    optionId: string;
    isDealbreaker: boolean;
    priority: number;
  }>;
  interests: Array<{
    interestId: string;
    isFavorite: boolean;
    displayOrder: number | null;
  }>;
  languages: Array<{
    languageId: string;
    proficiency: string | null;
    isPrimary: boolean;
    displayOrder: number | null;
  }>;
  languagePreferences: Array<{
    languageId: string;
    isDealbreaker: boolean;
    priority: number;
  }>;
  promptAnswers: Array<{
    promptId: string;
    answerText: string | null;
    displayOrder: number;
  }>;
  values: Array<{
    valueId: string;
    importance: number;
    displayOrder: number | null;
  }>;
  partnerValuePreferences: Array<{
    valueId: string;
    importance: number;
    isDealbreaker: boolean;
  }>;
  personalityResults: Array<{
    frameworkId: string;
    personalityTypeId: string | null;
    source: string;
    isUsedForMatching: boolean;
  }>;
  photos: UserPhoto[];
  onboarding: {
    progress: null | {
      onboardingVersion: number;
      status: "IN_PROGRESS" | "COMPLETED";
      currentStepId: string | null;
    };
    steps: Array<{ onboardingStepId: string; status: StepStatus }>;
  };
  consents: Array<{
    consentCode: string;
    policyVersion: string;
    status: "GRANTED" | "REVOKED";
  }>;
}

export interface City {
  id: string;
  name: string;
  stateName: string | null;
  countryCode: string;
}

export interface ProfilePreview {
  profile: {
    displayName: string;
    age: number;
    bio: string | null;
    heightCm?: number | null;
    jobTitle?: string | null;
    companyName?: string | null;
    schoolName?: string | null;
    currentCity?: City | null;
    hometown?: City | null;
  };
  photos: Array<Pick<UserPhoto, "id" | "url" | "displayOrder" | "isPrimary">>;
  profileOptions: Array<{
    categoryCode: string;
    categoryName: string;
    optionCode: string;
    label: string;
  }>;
  interests: Array<{ id: string; code: string; name: string }>;
  languages: Array<{
    id: string;
    name: string;
    nativeName: string | null;
    proficiency: string | null;
  }>;
  prompts: Array<{
    promptId: string;
    promptText: string;
    answerText: string | null;
    displayOrder: number;
  }>;
}
