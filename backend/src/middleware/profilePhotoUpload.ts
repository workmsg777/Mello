import path from 'node:path';
import { randomUUID } from 'node:crypto';
import multer from 'multer';
import type { RequestHandler } from 'express';
import Errors from '../errors';
import { profilePhotoUploadDirectory } from '../config/uploads';

const supportedMimeTypes = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
]);

const uploader = multer({
  storage: multer.diskStorage({
    destination: profilePhotoUploadDirectory,
    filename: (_req, file, callback) => {
      const extension =
        supportedMimeTypes.get(file.mimetype) ||
        path.extname(file.originalname).toLowerCase();
      callback(null, `${randomUUID()}${extension}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!supportedMimeTypes.has(file.mimetype)) {
      callback(
        new Errors.BadRequestError(
          'Profile photos must be JPEG, PNG, or WebP images',
        ),
      );
      return;
    }
    callback(null, true);
  },
});

export const uploadProfilePhoto: RequestHandler = (req, res, next) => {
  uploader.single('photo')(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError) {
      next(
        new Errors.BadRequestError(
          error.code === 'LIMIT_FILE_SIZE'
            ? 'Profile photo must be 10 MB or smaller'
            : error.message,
        ),
      );
      return;
    }
    next(error);
  });
};
