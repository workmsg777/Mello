import type { DatingState } from "../types/dating";

export function photoReviewStatus(
  profile: DatingState | null,
  minimum: number,
) {
  const publiclyVisible = !profile?.visibility.some(
    (field) => field.fieldCode === "PHOTOS" && field.visibility !== "PROFILE",
  );
  const approved = publiclyVisible
    ? (profile?.photos.filter(
        (photo) => photo.moderationStatus === "APPROVED" && photo.url,
      ).length ?? 0)
    : 0;
  const pending =
    profile?.photos.filter((photo) => photo.moderationStatus === "PENDING")
      .length ?? 0;
  return {
    approved,
    pending,
    ready: approved >= minimum,
    awaitingReview: publiclyVisible && approved < minimum && pending > 0,
  };
}
