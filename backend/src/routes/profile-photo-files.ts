import type { RequestHandler } from 'express';
import { z } from 'zod';
import { rows } from '../repositories/discovery.repository';
import { profilePhotoUploadDirectory } from '../config/uploads';
import Errors from '../errors';

const localImage = /^[a-z0-9_-]+\.(?:jpg|jpeg|png|webp)$/i;
const photoId = z.string().uuid();

function photoFile(access: 'public' | 'owner' | 'review'): RequestHandler {
  return async (req, res) => {
    const id = String(req.params.id ?? '');
    if (
      access === 'public'
        ? !localImage.test(id)
        : !photoId.safeParse(id).success
    )
      throw new Errors.NotFoundError('Photo not found');
    const [photo] = await rows<{ storageKey: string }>(
      `SELECT m.storage_key AS "storageKey" FROM user_photos p
       JOIN media m ON m.id=p.media_id AND m.deleted_at IS NULL AND m.storage_provider='LOCAL'
       WHERE p.deleted_at IS NULL AND ${
         access === 'owner'
           ? 'p.id=:id AND p.user_id=:userId'
           : access === 'review'
             ? "p.id=:id AND p.moderation_status='PENDING' AND EXISTS (SELECT 1 FROM users u WHERE u.id=p.user_id AND u.deleted_at IS NULL)"
             : `m.storage_key=:key AND p.moderation_status='APPROVED'
            AND NOT EXISTS(SELECT 1 FROM user_profile_visibility v WHERE v.user_id=p.user_id AND v.field_code='PHOTOS' AND v.visibility<>'PROFILE')`
       }
       LIMIT 1`,
      { id, key: `profile-photos/${id}`, userId: req.datingUserId ?? null },
    );
    const filename = photo?.storageKey.match(/^profile-photos\/(.+)$/)?.[1];
    if (!filename || !localImage.test(filename))
      throw new Errors.NotFoundError('Photo not found');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Cache-Control', 'private, no-store');
    res.sendFile(filename, {
      root: profilePhotoUploadDirectory,
      cacheControl: false,
    });
  };
}

export const publicProfilePhoto = photoFile('public');
export const ownProfilePhoto = photoFile('owner');
export const reviewProfilePhoto = photoFile('review');
