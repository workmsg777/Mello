import { Account } from './mainDb/account';
import { AuthIdentity } from './mainDb/authIdentity';
import { Media } from './mainDb/media';
import { OtpChallenge } from './mainDb/otpChallenge';
import { Partner } from './mainDb/partner';
import { PartnerUser } from './mainDb/partnerUser';
import { PlatformUser } from './mainDb/platformUser';
import { Role } from './mainDb/role';
import { User } from './mainDb/user';
import { UserSession } from './mainDb/userSession';
import { AccountRole } from './mainDb/throughTables/accountRole';
import { PartnerPhoto } from './mainDb/throughTables/partnerPhoto';
import { UserPhoto } from './mainDb/throughTables/userPhoto';
import {
  City,
  Interest,
  InterestCategory,
  Language,
  OnboardingStep,
  PersonalityFramework,
  PersonalityType,
  ProfileOption,
  ProfileOptionCategory,
  Prompt,
  PromptCategory,
  UserConsent,
  UserInterest,
  UserLanguage,
  UserLanguagePreference,
  UserMatchPreference,
  UserOnboardingProgress,
  UserOnboardingStepProgress,
  UserPartnerValuePreference,
  UserPersonalityResult,
  UserProfile,
  UserProfileOption,
  UserProfileOptionPreference,
  UserProfileVisibility,
  UserPromptAnswer,
  UserValue,
  Value,
} from './mainDb/dating';

/**
 * Single source of truth for model initialization order.
 * Mello currently uses one database, so every model belongs to mainDb.
 */
export const melloModelConfig = [
  Account,
  User,
  Partner,
  PartnerUser,
  PlatformUser,
  Role,
  AccountRole,
  AuthIdentity,
  OtpChallenge,
  UserSession,
  Media,
  UserPhoto,
  PartnerPhoto,
  City,
  UserProfile,
  ProfileOptionCategory,
  ProfileOption,
  UserProfileOption,
  UserProfileVisibility,
  Language,
  UserLanguage,
  InterestCategory,
  Interest,
  UserInterest,
  PromptCategory,
  Prompt,
  UserPromptAnswer,
  Value,
  UserValue,
  UserPartnerValuePreference,
  PersonalityFramework,
  PersonalityType,
  UserPersonalityResult,
  UserMatchPreference,
  UserProfileOptionPreference,
  UserLanguagePreference,
  OnboardingStep,
  UserOnboardingProgress,
  UserOnboardingStepProgress,
  UserConsent,
] as const;
