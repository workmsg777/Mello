import { mkdirSync } from 'node:fs';
import path from 'node:path';

export const profilePhotoUploadDirectory = path.resolve(
  process.cwd(),
  'uploads',
  'profile-photos',
);

mkdirSync(profilePhotoUploadDirectory, { recursive: true });
