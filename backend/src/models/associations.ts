import {
  Account,
  AccountRole,
  AuthIdentity,
  Media,
  Partner,
  PartnerPhoto,
  PartnerUser,
  PlatformUser,
  Role,
  User,
  UserPhoto,
  UserSession,
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
} from './entities';

export function initializeAssociations(): void {
  Account.hasOne(User, {
    foreignKey: 'accountId',
    as: 'user',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });
  User.belongsTo(Account, { foreignKey: 'accountId', as: 'account' });
  Account.hasOne(PartnerUser, {
    foreignKey: 'accountId',
    as: 'partnerUser',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });
  PartnerUser.belongsTo(Account, { foreignKey: 'accountId', as: 'account' });
  Account.hasOne(PlatformUser, {
    foreignKey: 'accountId',
    as: 'platformUser',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });
  PlatformUser.belongsTo(Account, { foreignKey: 'accountId', as: 'account' });

  Partner.hasMany(PartnerUser, {
    foreignKey: 'partnerId',
    as: 'staff',
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  });
  PartnerUser.belongsTo(Partner, { foreignKey: 'partnerId', as: 'partner' });

  Account.hasMany(AuthIdentity, {
    foreignKey: 'accountId',
    as: 'authIdentities',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });
  AuthIdentity.belongsTo(Account, { foreignKey: 'accountId', as: 'account' });
  Account.hasMany(UserSession, {
    foreignKey: 'accountId',
    as: 'sessions',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });
  UserSession.belongsTo(Account, { foreignKey: 'accountId', as: 'account' });

  Account.belongsToMany(Role, {
    through: AccountRole,
    foreignKey: 'accountId',
    otherKey: 'roleId',
    as: 'roles',
  });
  Role.belongsToMany(Account, {
    through: AccountRole,
    foreignKey: 'roleId',
    otherKey: 'accountId',
    as: 'accounts',
  });
  AccountRole.belongsTo(Account, { foreignKey: 'accountId', as: 'account' });
  AccountRole.belongsTo(Role, { foreignKey: 'roleId', as: 'role' });

  Account.hasMany(Media, {
    foreignKey: 'uploadedByAccountId',
    as: 'uploadedMedia',
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
  });
  Media.belongsTo(Account, {
    foreignKey: 'uploadedByAccountId',
    as: 'uploader',
  });

  User.hasMany(UserPhoto, {
    foreignKey: 'userId',
    as: 'photos',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });
  UserPhoto.belongsTo(User, { foreignKey: 'userId', as: 'user' });
  Media.hasMany(UserPhoto, {
    foreignKey: 'mediaId',
    as: 'userPhotos',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });
  UserPhoto.belongsTo(Media, { foreignKey: 'mediaId', as: 'media' });

  Partner.hasMany(PartnerPhoto, {
    foreignKey: 'partnerId',
    as: 'photos',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });
  PartnerPhoto.belongsTo(Partner, { foreignKey: 'partnerId', as: 'partner' });
  Media.hasMany(PartnerPhoto, {
    foreignKey: 'mediaId',
    as: 'partnerPhotos',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });
  PartnerPhoto.belongsTo(Media, { foreignKey: 'mediaId', as: 'media' });

  User.hasOne(UserProfile, {
    foreignKey: 'userId',
    as: 'profile',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });
  UserProfile.belongsTo(User, { foreignKey: 'userId', as: 'user' });
  City.hasMany(UserProfile, {
    foreignKey: 'currentCityId',
    as: 'currentResidents',
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  });
  UserProfile.belongsTo(City, {
    foreignKey: 'currentCityId',
    as: 'currentCity',
  });
  City.hasMany(UserProfile, {
    foreignKey: 'hometownCityId',
    as: 'hometownResidents',
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  });
  UserProfile.belongsTo(City, {
    foreignKey: 'hometownCityId',
    as: 'hometownCity',
  });

  ProfileOptionCategory.hasMany(ProfileOption, {
    foreignKey: 'categoryId',
    as: 'options',
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  });
  ProfileOption.belongsTo(ProfileOptionCategory, {
    foreignKey: 'categoryId',
    as: 'category',
  });
  User.hasMany(UserProfileOption, {
    foreignKey: 'userId',
    as: 'profileOptions',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });
  UserProfileOption.belongsTo(User, { foreignKey: 'userId', as: 'user' });
  ProfileOptionCategory.hasMany(UserProfileOption, {
    foreignKey: 'categoryId',
    as: 'userSelections',
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  });
  UserProfileOption.belongsTo(ProfileOptionCategory, {
    foreignKey: 'categoryId',
    as: 'category',
  });
  ProfileOption.hasMany(UserProfileOption, {
    foreignKey: 'optionId',
    as: 'userSelections',
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  });
  UserProfileOption.belongsTo(ProfileOption, {
    foreignKey: 'optionId',
    as: 'option',
  });
  User.hasMany(UserProfileVisibility, {
    foreignKey: 'userId',
    as: 'profileVisibilityRules',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });
  UserProfileVisibility.belongsTo(User, { foreignKey: 'userId', as: 'user' });

  User.hasMany(UserLanguage, {
    foreignKey: 'userId',
    as: 'languages',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });
  UserLanguage.belongsTo(User, { foreignKey: 'userId', as: 'user' });
  Language.hasMany(UserLanguage, {
    foreignKey: 'languageId',
    as: 'userLanguages',
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  });
  UserLanguage.belongsTo(Language, {
    foreignKey: 'languageId',
    as: 'language',
  });
  User.hasMany(UserLanguagePreference, {
    foreignKey: 'userId',
    as: 'languagePreferences',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });
  UserLanguagePreference.belongsTo(User, { foreignKey: 'userId', as: 'user' });
  Language.hasMany(UserLanguagePreference, {
    foreignKey: 'languageId',
    as: 'userPreferences',
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  });
  UserLanguagePreference.belongsTo(Language, {
    foreignKey: 'languageId',
    as: 'language',
  });

  InterestCategory.hasMany(Interest, {
    foreignKey: 'categoryId',
    as: 'interests',
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  });
  Interest.belongsTo(InterestCategory, {
    foreignKey: 'categoryId',
    as: 'category',
  });
  User.hasMany(UserInterest, {
    foreignKey: 'userId',
    as: 'interests',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });
  UserInterest.belongsTo(User, { foreignKey: 'userId', as: 'user' });
  Interest.hasMany(UserInterest, {
    foreignKey: 'interestId',
    as: 'userInterests',
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  });
  UserInterest.belongsTo(Interest, {
    foreignKey: 'interestId',
    as: 'interest',
  });

  PromptCategory.hasMany(Prompt, {
    foreignKey: 'categoryId',
    as: 'prompts',
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  });
  Prompt.belongsTo(PromptCategory, {
    foreignKey: 'categoryId',
    as: 'category',
  });
  User.hasMany(UserPromptAnswer, {
    foreignKey: 'userId',
    as: 'promptAnswers',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });
  UserPromptAnswer.belongsTo(User, { foreignKey: 'userId', as: 'user' });
  Prompt.hasMany(UserPromptAnswer, {
    foreignKey: 'promptId',
    as: 'userAnswers',
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  });
  UserPromptAnswer.belongsTo(Prompt, { foreignKey: 'promptId', as: 'prompt' });
  Media.hasMany(UserPromptAnswer, {
    foreignKey: 'mediaId',
    as: 'promptAnswers',
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  });
  UserPromptAnswer.belongsTo(Media, { foreignKey: 'mediaId', as: 'media' });

  User.hasMany(UserValue, {
    foreignKey: 'userId',
    as: 'values',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });
  UserValue.belongsTo(User, { foreignKey: 'userId', as: 'user' });
  Value.hasMany(UserValue, {
    foreignKey: 'valueId',
    as: 'userValues',
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  });
  UserValue.belongsTo(Value, { foreignKey: 'valueId', as: 'value' });
  User.hasMany(UserPartnerValuePreference, {
    foreignKey: 'userId',
    as: 'partnerValuePreferences',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });
  UserPartnerValuePreference.belongsTo(User, {
    foreignKey: 'userId',
    as: 'user',
  });
  Value.hasMany(UserPartnerValuePreference, {
    foreignKey: 'valueId',
    as: 'partnerPreferences',
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  });
  UserPartnerValuePreference.belongsTo(Value, {
    foreignKey: 'valueId',
    as: 'value',
  });

  PersonalityFramework.hasMany(PersonalityType, {
    foreignKey: 'frameworkId',
    as: 'types',
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  });
  PersonalityType.belongsTo(PersonalityFramework, {
    foreignKey: 'frameworkId',
    as: 'framework',
  });
  User.hasMany(UserPersonalityResult, {
    foreignKey: 'userId',
    as: 'personalityResults',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });
  UserPersonalityResult.belongsTo(User, { foreignKey: 'userId', as: 'user' });
  PersonalityFramework.hasMany(UserPersonalityResult, {
    foreignKey: 'frameworkId',
    as: 'userResults',
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  });
  UserPersonalityResult.belongsTo(PersonalityFramework, {
    foreignKey: 'frameworkId',
    as: 'framework',
  });
  PersonalityType.hasMany(UserPersonalityResult, {
    foreignKey: 'personalityTypeId',
    as: 'userResults',
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  });
  UserPersonalityResult.belongsTo(PersonalityType, {
    foreignKey: 'personalityTypeId',
    as: 'personalityType',
  });

  User.hasOne(UserMatchPreference, {
    foreignKey: 'userId',
    as: 'matchPreferences',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });
  UserMatchPreference.belongsTo(User, { foreignKey: 'userId', as: 'user' });
  User.hasMany(UserProfileOptionPreference, {
    foreignKey: 'userId',
    as: 'profileOptionPreferences',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });
  UserProfileOptionPreference.belongsTo(User, {
    foreignKey: 'userId',
    as: 'user',
  });
  ProfileOptionCategory.hasMany(UserProfileOptionPreference, {
    foreignKey: 'categoryId',
    as: 'userPreferences',
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  });
  UserProfileOptionPreference.belongsTo(ProfileOptionCategory, {
    foreignKey: 'categoryId',
    as: 'category',
  });
  ProfileOption.hasMany(UserProfileOptionPreference, {
    foreignKey: 'optionId',
    as: 'userPreferences',
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  });
  UserProfileOptionPreference.belongsTo(ProfileOption, {
    foreignKey: 'optionId',
    as: 'option',
  });

  User.hasOne(UserOnboardingProgress, {
    foreignKey: 'userId',
    as: 'onboardingProgress',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });
  UserOnboardingProgress.belongsTo(User, { foreignKey: 'userId', as: 'user' });
  OnboardingStep.hasMany(UserOnboardingProgress, {
    foreignKey: 'currentStepId',
    as: 'currentUsers',
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  });
  UserOnboardingProgress.belongsTo(OnboardingStep, {
    foreignKey: 'currentStepId',
    as: 'currentStep',
  });
  User.hasMany(UserOnboardingStepProgress, {
    foreignKey: 'userId',
    as: 'onboardingSteps',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });
  UserOnboardingStepProgress.belongsTo(User, {
    foreignKey: 'userId',
    as: 'user',
  });
  OnboardingStep.hasMany(UserOnboardingStepProgress, {
    foreignKey: 'onboardingStepId',
    as: 'userProgress',
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  });
  UserOnboardingStepProgress.belongsTo(OnboardingStep, {
    foreignKey: 'onboardingStepId',
    as: 'onboardingStep',
  });
  User.hasMany(UserConsent, {
    foreignKey: 'userId',
    as: 'consents',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });
  UserConsent.belongsTo(User, { foreignKey: 'userId', as: 'user' });
}
