export type FieldVisibility = { fieldCode: string; visibility: string };
export function publicFields(rules: readonly FieldVisibility[]) {
  const visible = new Set([
    'BIO',
    'INTERESTS',
    'LANGUAGES',
    'PROMPTS',
    'CURRENT_CITY',
    'PHOTOS',
  ]);
  for (const field of rules) {
    if (field.visibility === 'PROFILE') visible.add(field.fieldCode);
    else visible.delete(field.fieldCode);
  }
  return visible;
}
export const displayablePhotoStatus = 'APPROVED';
export function displayableText(status: string) {
  return status === 'APPROVED' || status === 'NOT_REVIEWED';
}
