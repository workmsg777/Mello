import { Router } from 'express';
import {
  completeOnboarding,
  deletePersonalityResult,
  deletePhoto,
  deletePromptAnswer,
  finishOnboardingStep,
  getDatingCatalog,
  getDatingState,
  getProfilePreview,
  listPhotos,
  recordConsent,
  reorderPhotos,
  saveInterests,
  saveLanguagePreferences,
  saveLanguages,
  saveMatchPreferences,
  saveOptionPreferences,
  savePartnerValuePreferences,
  savePersonalityResult,
  saveProfile,
  saveProfileOptions,
  savePromptAnswer,
  saveValues,
  saveVisibility,
  searchCities,
  startOnboarding,
  uploadPhoto,
} from '../controllers/dating.controller';
import {
  authenticate,
  requireDatingUser,
  uploadProfilePhoto,
} from '../middleware';

export const datingRouter = Router();

datingRouter.use(authenticate, requireDatingUser);

datingRouter.get('/catalog', getDatingCatalog);
datingRouter.get('/cities', searchCities);
datingRouter.get('/state', getDatingState);
datingRouter.get('/preview', getProfilePreview);

datingRouter.put('/profile', saveProfile);
datingRouter.put('/profile-options/:categoryId', saveProfileOptions);
datingRouter.put('/visibility/:fieldCode', saveVisibility);
datingRouter.put('/match-preferences', saveMatchPreferences);
datingRouter.put('/option-preferences/:categoryId', saveOptionPreferences);
datingRouter.put('/interests', saveInterests);
datingRouter.put('/languages', saveLanguages);
datingRouter.put('/language-preferences', saveLanguagePreferences);
datingRouter.put('/values', saveValues);
datingRouter.put('/partner-value-preferences', savePartnerValuePreferences);
datingRouter.put('/prompt-answers/:promptId', savePromptAnswer);
datingRouter.delete('/prompt-answers/:promptId', deletePromptAnswer);
datingRouter.put('/personality/:frameworkId', savePersonalityResult);
datingRouter.delete('/personality/:frameworkId', deletePersonalityResult);

datingRouter.get('/photos', listPhotos);
datingRouter.post('/photos', uploadProfilePhoto, uploadPhoto);
datingRouter.put('/photos/order', reorderPhotos);
datingRouter.delete('/photos/:id', deletePhoto);

datingRouter.post('/onboarding/start', startOnboarding);
datingRouter.post('/onboarding/steps/:stepId', finishOnboardingStep);
datingRouter.post('/onboarding/complete', completeOnboarding);
datingRouter.post('/consents', recordConsent);
