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
} from '../models';
import { BaseRepository } from './base.repository';

export class CityRepository extends BaseRepository<City> {
  constructor() {
    super(City);
  }
}
export class UserProfileRepository extends BaseRepository<UserProfile> {
  constructor() {
    super(UserProfile);
  }
}
export class ProfileOptionCategoryRepository extends BaseRepository<ProfileOptionCategory> {
  constructor() {
    super(ProfileOptionCategory);
  }
}
export class ProfileOptionRepository extends BaseRepository<ProfileOption> {
  constructor() {
    super(ProfileOption);
  }
}
export class UserProfileOptionRepository extends BaseRepository<UserProfileOption> {
  constructor() {
    super(UserProfileOption);
  }
}
export class UserProfileVisibilityRepository extends BaseRepository<UserProfileVisibility> {
  constructor() {
    super(UserProfileVisibility);
  }
}
export class LanguageRepository extends BaseRepository<Language> {
  constructor() {
    super(Language);
  }
}
export class UserLanguageRepository extends BaseRepository<UserLanguage> {
  constructor() {
    super(UserLanguage);
  }
}
export class InterestCategoryRepository extends BaseRepository<InterestCategory> {
  constructor() {
    super(InterestCategory);
  }
}
export class InterestRepository extends BaseRepository<Interest> {
  constructor() {
    super(Interest);
  }
}
export class UserInterestRepository extends BaseRepository<UserInterest> {
  constructor() {
    super(UserInterest);
  }
}
export class PromptCategoryRepository extends BaseRepository<PromptCategory> {
  constructor() {
    super(PromptCategory);
  }
}
export class PromptRepository extends BaseRepository<Prompt> {
  constructor() {
    super(Prompt);
  }
}
export class UserPromptAnswerRepository extends BaseRepository<UserPromptAnswer> {
  constructor() {
    super(UserPromptAnswer);
  }
}
export class ValueRepository extends BaseRepository<Value> {
  constructor() {
    super(Value);
  }
}
export class UserValueRepository extends BaseRepository<UserValue> {
  constructor() {
    super(UserValue);
  }
}
export class UserPartnerValuePreferenceRepository extends BaseRepository<UserPartnerValuePreference> {
  constructor() {
    super(UserPartnerValuePreference);
  }
}
export class PersonalityFrameworkRepository extends BaseRepository<PersonalityFramework> {
  constructor() {
    super(PersonalityFramework);
  }
}
export class PersonalityTypeRepository extends BaseRepository<PersonalityType> {
  constructor() {
    super(PersonalityType);
  }
}
export class UserPersonalityResultRepository extends BaseRepository<UserPersonalityResult> {
  constructor() {
    super(UserPersonalityResult);
  }
}
export class UserMatchPreferenceRepository extends BaseRepository<UserMatchPreference> {
  constructor() {
    super(UserMatchPreference);
  }
}
export class UserProfileOptionPreferenceRepository extends BaseRepository<UserProfileOptionPreference> {
  constructor() {
    super(UserProfileOptionPreference);
  }
}
export class UserLanguagePreferenceRepository extends BaseRepository<UserLanguagePreference> {
  constructor() {
    super(UserLanguagePreference);
  }
}
export class OnboardingStepRepository extends BaseRepository<OnboardingStep> {
  constructor() {
    super(OnboardingStep);
  }
}
export class UserOnboardingProgressRepository extends BaseRepository<UserOnboardingProgress> {
  constructor() {
    super(UserOnboardingProgress);
  }
}
export class UserOnboardingStepProgressRepository extends BaseRepository<UserOnboardingStepProgress> {
  constructor() {
    super(UserOnboardingStepProgress);
  }
}
export class UserConsentRepository extends BaseRepository<UserConsent> {
  constructor() {
    super(UserConsent);
  }
}
