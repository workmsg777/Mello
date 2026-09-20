import type { Request, RequestHandler } from 'express';
import Errors from '../errors';
import {
  CityService,
  DatingCatalogService,
  DatingStateService,
  OnboardingService,
  UserConsentService,
  UserInterestService,
  UserLanguagePreferenceService,
  UserLanguageService,
  UserMatchPreferenceService,
  UserPartnerValuePreferenceService,
  UserPersonalityResultService,
  UserPhotoService,
  UserProfileOptionPreferenceService,
  UserProfileOptionService,
  UserProfileService,
  UserProfileVisibilityService,
  UserPromptAnswerService,
  UserValueService,
} from '../services/dating';
import {
  validateCategoryParams,
  validateCitySearch,
  validateConsent,
  validateDatingProfile,
  validateFieldParams,
  validateFrameworkParams,
  validateIdParams,
  validateInterests,
  validateLanguagePreferences,
  validateLanguages,
  validateMatchPreferences,
  validateOnboardingComplete,
  validateOnboardingStart,
  validateOnboardingStep,
  validateOptionPreferences,
  validatePartnerValues,
  validatePersonalityResult,
  validatePhotoOrder,
  validateProfileOptionSelections,
  validatePromptAnswer,
  validatePromptParams,
  validateStepParams,
  validateValues,
  validateVisibility,
} from '../utils/queryValidators';

const catalogService = new DatingCatalogService();
const stateService = new DatingStateService();
const cityService = new CityService();
const profileService = new UserProfileService();
const profileOptionService = new UserProfileOptionService();
const visibilityService = new UserProfileVisibilityService();
const matchPreferenceService = new UserMatchPreferenceService();
const optionPreferenceService = new UserProfileOptionPreferenceService();
const interestService = new UserInterestService();
const languageService = new UserLanguageService();
const languagePreferenceService = new UserLanguagePreferenceService();
const valueService = new UserValueService();
const partnerValuePreferenceService = new UserPartnerValuePreferenceService();
const promptAnswerService = new UserPromptAnswerService();
const personalityResultService = new UserPersonalityResultService();
const onboardingService = new OnboardingService();
const consentService = new UserConsentService();
const photoService = new UserPhotoService();

const userId = (req: Request): string => {
  if (!req.datingUserId)
    throw new Errors.UnauthorizedError('Dating-user access is required');
  return req.datingUserId;
};

export const getDatingCatalog: RequestHandler = async (req, res) => {
  const version = Number(req.query.version ?? 1);
  if (!Number.isInteger(version) || version <= 0)
    throw new Errors.BadRequestError('version must be a positive integer');
  res.status(200).json(await catalogService.get(version));
};

export const searchCities: RequestHandler = async (req, res) => {
  const input = validateCitySearch(req.query);
  res
    .status(200)
    .json(await cityService.search(input.search ?? '', input.limit));
};

export const getDatingState: RequestHandler = async (req, res) => {
  res.status(200).json(await stateService.get(userId(req)));
};

export const getProfilePreview: RequestHandler = async (req, res) => {
  res.status(200).json(await stateService.getPreview(userId(req)));
};

export const saveProfile: RequestHandler = async (req, res) => {
  const input = validateDatingProfile(req.body);
  await profileService.upsert(userId(req), input);
  res.status(200).json(await profileService.getPrivate(userId(req)));
};

export const saveProfileOptions: RequestHandler = async (req, res) => {
  const { categoryId } = validateCategoryParams(req.params);
  const { selections } = validateProfileOptionSelections(req.body);
  await profileOptionService.replaceCategory(
    userId(req),
    categoryId,
    selections,
  );
  res
    .status(200)
    .json({ selections: await profileOptionService.list(userId(req)) });
};

export const saveVisibility: RequestHandler = async (req, res) => {
  const { fieldCode } = validateFieldParams(req.params);
  const { visibility } = validateVisibility(req.body);
  await visibilityService.set(userId(req), fieldCode, visibility);
  res
    .status(200)
    .json({ visibility: await visibilityService.list(userId(req)) });
};

export const saveMatchPreferences: RequestHandler = async (req, res) => {
  const input = validateMatchPreferences(req.body);
  await matchPreferenceService.upsert(userId(req), input);
  res.status(200).json(await matchPreferenceService.get(userId(req)));
};

export const saveOptionPreferences: RequestHandler = async (req, res) => {
  const { categoryId } = validateCategoryParams(req.params);
  const { preferences } = validateOptionPreferences(req.body);
  await optionPreferenceService.replaceCategory(
    userId(req),
    categoryId,
    preferences,
  );
  res
    .status(200)
    .json({ preferences: await optionPreferenceService.list(userId(req)) });
};

export const saveInterests: RequestHandler = async (req, res) => {
  const { selections } = validateInterests(req.body);
  await interestService.replace(userId(req), selections);
  res.status(200).json({ interests: await interestService.list(userId(req)) });
};

export const saveLanguages: RequestHandler = async (req, res) => {
  const { selections } = validateLanguages(req.body);
  await languageService.replace(userId(req), selections);
  res.status(200).json({ languages: await languageService.list(userId(req)) });
};

export const saveLanguagePreferences: RequestHandler = async (req, res) => {
  const { preferences } = validateLanguagePreferences(req.body);
  await languagePreferenceService.replace(userId(req), preferences);
  res
    .status(200)
    .json({ preferences: await languagePreferenceService.list(userId(req)) });
};

export const saveValues: RequestHandler = async (req, res) => {
  const { selections } = validateValues(req.body);
  await valueService.replace(userId(req), selections);
  res.status(200).json({ values: await valueService.list(userId(req)) });
};

export const savePartnerValuePreferences: RequestHandler = async (req, res) => {
  const { preferences } = validatePartnerValues(req.body);
  await partnerValuePreferenceService.replace(userId(req), preferences);
  res.status(200).json({
    preferences: await partnerValuePreferenceService.list(userId(req)),
  });
};

export const savePromptAnswer: RequestHandler = async (req, res) => {
  const { promptId } = validatePromptParams(req.params);
  const body = validatePromptAnswer(req.body);
  await promptAnswerService.save(userId(req), { promptId, ...body });
  res
    .status(200)
    .json({ promptAnswers: await promptAnswerService.list(userId(req)) });
};

export const deletePromptAnswer: RequestHandler = async (req, res) => {
  const { promptId } = validatePromptParams(req.params);
  await promptAnswerService.remove(userId(req), promptId);
  res.status(204).send();
};

export const savePersonalityResult: RequestHandler = async (req, res) => {
  const { frameworkId } = validateFrameworkParams(req.params);
  const body = validatePersonalityResult(req.body);
  await personalityResultService.save(userId(req), { frameworkId, ...body });
  res.status(200).json({
    personalityResults: await personalityResultService.list(userId(req)),
  });
};

export const deletePersonalityResult: RequestHandler = async (req, res) => {
  const { frameworkId } = validateFrameworkParams(req.params);
  await personalityResultService.remove(userId(req), frameworkId);
  res.status(204).send();
};

export const startOnboarding: RequestHandler = async (req, res) => {
  const input = validateOnboardingStart(req.body);
  await onboardingService.start(
    userId(req),
    input.onboardingVersion,
    input.firstStepId,
  );
  res.status(200).json((await stateService.get(userId(req))).onboarding);
};

export const finishOnboardingStep: RequestHandler = async (req, res) => {
  const { stepId } = validateStepParams(req.params);
  const input = validateOnboardingStep(req.body);
  await onboardingService.finishStep(
    userId(req),
    input.onboardingVersion,
    stepId,
    input.status === 'SKIPPED',
  );
  res.status(200).json((await stateService.get(userId(req))).onboarding);
};

export const completeOnboarding: RequestHandler = async (req, res) => {
  const input = validateOnboardingComplete(req.body);
  await onboardingService.complete(userId(req), input.onboardingVersion);
  res.status(200).json((await stateService.get(userId(req))).onboarding);
};

export const recordConsent: RequestHandler = async (req, res) => {
  const input = validateConsent(req.body);
  await consentService.record(userId(req), {
    ...input,
    ipAddress: req.ip ?? null,
    userAgent: req.get('user-agent') ?? null,
  });
  res.status(201).json({ consents: await consentService.list(userId(req)) });
};

export const listPhotos: RequestHandler = async (req, res) => {
  res.status(200).json({ photos: await photoService.list(userId(req)) });
};

export const uploadPhoto: RequestHandler = async (req, res) => {
  if (!req.file) throw new Errors.BadRequestError('Photo file is required');
  if (!req.auth)
    throw new Errors.UnauthorizedError('Authentication is required');
  const photos = await photoService.upload(
    userId(req),
    req.auth.accountId,
    req.file,
  );
  res.status(201).json({ photos });
};

export const reorderPhotos: RequestHandler = async (req, res) => {
  const input = validatePhotoOrder(req.body);
  await photoService.reorder(userId(req), input.photoIds, input.primaryPhotoId);
  res.status(200).json({ photos: await photoService.list(userId(req)) });
};

export const deletePhoto: RequestHandler = async (req, res) => {
  const { id } = validateIdParams(req.params);
  await photoService.remove(userId(req), id);
  res.status(204).send();
};
