import { api } from "../config/api";
import type {
  City,
  DatingCatalog,
  DatingState,
  ProfilePreview,
  UserPhoto,
  VisibilityMode,
} from "../types/dating";

export const datingApi = {
  async catalog() {
    return (await api.get<DatingCatalog>("/dating/catalog")).data;
  },
  async state() {
    return (await api.get<DatingState>("/dating/state")).data;
  },
  async preview() {
    return (await api.get<ProfilePreview>("/dating/preview")).data;
  },
  async cities(search = "") {
    return (
      await api.get<City[]>("/dating/cities", { params: { search, limit: 50 } })
    ).data;
  },
  async profile(body: Record<string, unknown>) {
    return (await api.put("/dating/profile", body)).data;
  },
  async profileOptions(categoryId: string, optionIds: string[]) {
    return (
      await api.put(`/dating/profile-options/${categoryId}`, {
        selections: optionIds.map((optionId, displayOrder) => ({
          optionId,
          displayOrder,
          isPrimary: displayOrder === 0,
        })),
      })
    ).data;
  },
  async visibility(fieldCode: string, visibility: VisibilityMode) {
    return (await api.put(`/dating/visibility/${fieldCode}`, { visibility }))
      .data;
  },
  async matchPreferences(body: Record<string, unknown>) {
    return (await api.put("/dating/match-preferences", body)).data;
  },
  async optionPreferences(
    categoryId: string,
    optionIds: string[],
    isDealbreaker = false,
  ) {
    return (
      await api.put(`/dating/option-preferences/${categoryId}`, {
        preferences: optionIds.map((optionId) => ({
          optionId,
          isDealbreaker,
          priority: 3,
        })),
      })
    ).data;
  },
  async interests(ids: string[]) {
    return (
      await api.put("/dating/interests", {
        selections: ids.map((interestId, displayOrder) => ({
          interestId,
          displayOrder,
        })),
      })
    ).data;
  },
  async languages(ids: string[]) {
    return (
      await api.put("/dating/languages", {
        selections: ids.map((languageId, displayOrder) => ({
          languageId,
          displayOrder,
          isPrimary: displayOrder === 0,
          proficiency: displayOrder === 0 ? "NATIVE" : "CONVERSATIONAL",
        })),
      })
    ).data;
  },
  async values(ids: string[]) {
    return (
      await api.put("/dating/values", {
        selections: ids.map((valueId, displayOrder) => ({
          valueId,
          displayOrder,
          importance: 3,
        })),
      })
    ).data;
  },
  async partnerValues(ids: string[]) {
    return (
      await api.put("/dating/partner-value-preferences", {
        preferences: ids.map((valueId) => ({
          valueId,
          importance: 3,
          isDealbreaker: false,
        })),
      })
    ).data;
  },
  async promptAnswer(
    promptId: string,
    answerText: string,
    displayOrder: number,
  ) {
    return (
      await api.put(`/dating/prompt-answers/${promptId}`, {
        answerText,
        displayOrder,
      })
    ).data;
  },
  async personality(frameworkId: string, personalityTypeId: string) {
    return (
      await api.put(`/dating/personality/${frameworkId}`, {
        personalityTypeId,
        source: "SELF_DECLARED",
        isUsedForMatching: true,
      })
    ).data;
  },
  async start(onboardingVersion: number, firstStepId: string) {
    return (
      await api.post("/dating/onboarding/start", {
        onboardingVersion,
        firstStepId,
      })
    ).data;
  },
  async finishStep(onboardingVersion: number, stepId: string, skipped = false) {
    return (
      await api.post(`/dating/onboarding/steps/${stepId}`, {
        onboardingVersion,
        status: skipped ? "SKIPPED" : "COMPLETED",
      })
    ).data;
  },
  async complete(onboardingVersion: number) {
    return (
      await api.post("/dating/onboarding/complete", { onboardingVersion })
    ).data;
  },
  async consent(consentCode: string, policyVersion: string, granted = true) {
    return (
      await api.post("/dating/consents", {
        consentCode,
        policyVersion,
        status: granted ? "GRANTED" : "REVOKED",
      })
    ).data;
  },
  async uploadPhoto(
    asset: { uri: string; fileName?: string | null; mimeType?: string | null },
    onProgress?: (value: number) => void,
  ) {
    const data = new FormData();
    data.append("photo", {
      uri: asset.uri,
      name: asset.fileName || `mello-${Date.now()}.jpg`,
      type: asset.mimeType || "image/jpeg",
    } as unknown as Blob);
    const response = await api.post<{ photos: UserPhoto[] }>(
      "/dating/photos",
      data,
      {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: ({ loaded, total }) =>
          onProgress?.(total ? loaded / total : 0),
      },
    );
    return response.data.photos;
  },
  async deletePhoto(id: string) {
    await api.delete(`/dating/photos/${id}`);
  },
  async reorderPhotos(photoIds: string[], primaryPhotoId: string) {
    return (
      await api.put<{ photos: UserPhoto[] }>("/dating/photos/order", {
        photoIds,
        primaryPhotoId,
      })
    ).data.photos;
  },
};
