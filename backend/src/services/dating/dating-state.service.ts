import { DatingCatalogService } from './dating-catalog.service';
import {
  UserLanguagePreferenceService,
  UserMatchPreferenceService,
  UserProfileOptionPreferenceService,
} from './preference.services';
import {
  UserInterestService,
  UserLanguageService,
  UserPartnerValuePreferenceService,
  UserProfileOptionService,
  UserProfileService,
  UserProfileVisibilityService,
  UserValueService,
} from './profile.services';
import {
  UserPersonalityResultService,
  UserPromptAnswerService,
} from './prompt-personality.services';
import {
  UserConsentService,
  UserOnboardingProgressService,
  UserOnboardingStepProgressService,
} from './onboarding.services';
import { UserPhotoService } from './photo.service';

export class DatingStateService {
  constructor(
    private readonly profileService = new UserProfileService(),
    private readonly profileOptionService = new UserProfileOptionService(),
    private readonly visibilityService = new UserProfileVisibilityService(),
    private readonly matchPreferenceService = new UserMatchPreferenceService(),
    private readonly optionPreferenceService = new UserProfileOptionPreferenceService(),
    private readonly interestService = new UserInterestService(),
    private readonly languageService = new UserLanguageService(),
    private readonly languagePreferenceService = new UserLanguagePreferenceService(),
    private readonly promptAnswerService = new UserPromptAnswerService(),
    private readonly valueService = new UserValueService(),
    private readonly partnerValuePreferenceService = new UserPartnerValuePreferenceService(),
    private readonly personalityResultService = new UserPersonalityResultService(),
    private readonly photoService = new UserPhotoService(),
    private readonly onboardingProgressService = new UserOnboardingProgressService(),
    private readonly onboardingStepProgressService = new UserOnboardingStepProgressService(),
    private readonly consentService = new UserConsentService(),
    private readonly catalogService = new DatingCatalogService(),
  ) {}

  async get(userId: string) {
    const [
      profile,
      profileOptions,
      visibility,
      matchPreferences,
      optionPreferences,
      interests,
      languages,
      languagePreferences,
      promptAnswers,
      values,
      partnerValuePreferences,
      personalityResults,
      photos,
      onboardingProgress,
      onboardingStepProgress,
      consents,
    ] = await Promise.all([
      this.profileService.getPrivate(userId),
      this.profileOptionService.list(userId),
      this.visibilityService.list(userId),
      this.matchPreferenceService.get(userId),
      this.optionPreferenceService.list(userId),
      this.interestService.list(userId),
      this.languageService.list(userId),
      this.languagePreferenceService.list(userId),
      this.promptAnswerService.list(userId),
      this.valueService.list(userId),
      this.partnerValuePreferenceService.list(userId),
      this.personalityResultService.list(userId),
      this.photoService.list(userId),
      this.onboardingProgressService.get(userId),
      this.onboardingStepProgressService.list(userId),
      this.consentService.list(userId),
    ]);
    return {
      profile,
      profileOptions,
      visibility,
      matchPreferences,
      optionPreferences,
      interests,
      languages,
      languagePreferences,
      promptAnswers,
      values,
      partnerValuePreferences,
      personalityResults,
      photos,
      onboarding: {
        progress: onboardingProgress,
        steps: onboardingStepProgress,
      },
      consents,
    };
  }

  async getPreview(userId: string) {
    const [
      profile,
      profileOptions,
      visibility,
      interests,
      languages,
      promptAnswers,
      photos,
      catalog,
    ] = await Promise.all([
      this.profileService.getPublic(userId),
      this.profileOptionService.list(userId),
      this.visibilityService.list(userId),
      this.interestService.list(userId),
      this.languageService.list(userId),
      this.promptAnswerService.list(userId),
      this.photoService.list(userId),
      this.catalogService.get(),
    ]);
    const visibleFields = new Set(
      visibility
        .filter(({ visibility: mode }) => mode === 'PROFILE')
        .map(({ fieldCode }) => fieldCode),
    );
    const optionById = new Map(
      catalog.profileOptions.map((option) => [option.id, option]),
    );
    const categoryById = new Map(
      catalog.profileOptionCategories.map((category) => [
        category.id,
        category,
      ]),
    );
    const interestById = new Map(
      catalog.interests.map((interest) => [interest.id, interest]),
    );
    const languageById = new Map(
      catalog.languages.map((language) => [language.id, language]),
    );
    const promptById = new Map(
      catalog.prompts.map((prompt) => [prompt.id, prompt]),
    );

    return {
      profile,
      photos: photos.map(({ id, url, displayOrder, isPrimary }) => ({
        id,
        url,
        displayOrder,
        isPrimary,
      })),
      profileOptions: profileOptions
        .map((selection) => {
          const category = categoryById.get(selection.categoryId);
          const option = optionById.get(selection.optionId);
          if (!category || !option || !visibleFields.has(category.code))
            return null;
          return {
            categoryCode: category.code,
            categoryName: category.name,
            optionCode: option.code,
            label: option.label,
          };
        })
        .filter((item) => item !== null),
      interests: interests
        .map(({ interestId }) => interestById.get(interestId))
        .filter((item) => item !== undefined)
        .map(({ id, code, name }) => ({ id, code, name })),
      languages: languages
        .map((selection) => {
          const language = languageById.get(selection.languageId);
          return language
            ? {
                id: language.id,
                name: language.name,
                nativeName: language.nativeName,
                proficiency: selection.proficiency,
              }
            : null;
        })
        .filter((item) => item !== null),
      prompts: promptAnswers
        .map((answer) => {
          const prompt = promptById.get(answer.promptId);
          return prompt
            ? {
                promptId: prompt.id,
                promptText: prompt.promptText,
                answerText: answer.answerText,
                mediaId: answer.mediaId,
                displayOrder: answer.displayOrder,
              }
            : null;
        })
        .filter((item) => item !== null),
    };
  }
}
