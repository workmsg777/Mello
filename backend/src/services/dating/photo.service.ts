import { unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import type { Transaction } from 'sequelize';
import { sequelize } from '../../config/database';
import { datingProfileConfig } from '../../config/datingProfile';
import Errors from '../../errors';
import { UserPhotoRepository } from '../../repositories';
import { MediaService } from './media.service';

export interface UploadedProfilePhoto {
  path: string;
  filename: string;
  mimetype: string;
  size: number;
}

export class UserPhotoService {
  constructor(
    private readonly repository = new UserPhotoRepository(),
    private readonly mediaService = new MediaService(),
  ) {}

  async list(userId: string) {
    const photos = await this.repository.findAll({
      where: { userId },
      order: [['displayOrder', 'ASC']],
    });
    const media = await this.mediaService.getByIds(
      photos.map(({ mediaId }) => mediaId),
    );
    const mediaById = new Map(media.map((item) => [item.id, item]));
    return photos.map((photo) => ({
      id: photo.id,
      mediaId: photo.mediaId,
      url: mediaById.get(photo.mediaId)?.url ?? null,
      mimeType: mediaById.get(photo.mediaId)?.mimeType ?? null,
      displayOrder: photo.displayOrder,
      isPrimary: photo.isPrimary,
      moderationStatus: photo.moderationStatus,
    }));
  }

  async upload(userId: string, accountId: string, file: UploadedProfilePhoto) {
    try {
      await sequelize.transaction(async (transaction) => {
        const count = await this.repository.count({
          where: { userId },
          transaction,
        });
        if (count >= datingProfileConfig.maximumPhotos)
          throw new Errors.BadRequestError(
            `A profile may have at most ${datingProfileConfig.maximumPhotos} photos`,
          );
        const media = await this.mediaService.registerLocalImage(
          {
            accountId,
            filename: file.filename,
            mimeType: file.mimetype,
            sizeBytes: file.size,
          },
          transaction,
        );
        await this.repository.create(
          {
            id: randomUUID(),
            userId,
            mediaId: media.id,
            displayOrder: count,
            isPrimary: count === 0,
            moderationStatus: 'PENDING',
          },
          { transaction },
        );
      });
      return this.list(userId);
    } catch (error) {
      await unlink(file.path).catch(() => undefined);
      throw error;
    }
  }

  async remove(userId: string, photoId: string): Promise<void> {
    await sequelize.transaction(async (transaction) => {
      const photo = await this.repository.findOne({
        where: { id: photoId, userId },
        transaction,
      });
      if (!photo) throw new Errors.NotFoundError('Profile photo not found');
      await this.repository.destroy({
        where: { id: photo.id, userId },
        transaction,
      });
      if (photo.isPrimary) {
        const next = await this.repository.findOne({
          where: { userId },
          order: [['displayOrder', 'ASC']],
          transaction,
        });
        if (next)
          await this.repository.update(
            { isPrimary: true },
            { where: { id: next.id }, transaction },
          );
      }
    });
  }

  async reorder(
    userId: string,
    photoIds: string[],
    primaryPhotoId: string,
  ): Promise<void> {
    if (new Set(photoIds).size !== photoIds.length)
      throw new Errors.BadRequestError('Photo order contains duplicates');
    if (!photoIds.includes(primaryPhotoId))
      throw new Errors.BadRequestError('Primary photo must be in photo order');
    await sequelize.transaction(async (transaction) => {
      const current = await this.repository.findAll({
        where: { userId },
        transaction,
      });
      const currentIds = new Set(current.map(({ id }) => id));
      if (
        current.length !== photoIds.length ||
        photoIds.some((id) => !currentIds.has(id))
      )
        throw new Errors.BadRequestError(
          'Photo order must include every active profile photo exactly once',
        );
      await this.repository.update(
        { isPrimary: false },
        { where: { userId }, transaction },
      );
      for (const [index, id] of photoIds.entries()) {
        await this.repository.update(
          { displayOrder: 1000 + index },
          { where: { id, userId }, transaction },
        );
      }
      for (const [index, id] of photoIds.entries()) {
        await this.repository.update(
          { displayOrder: index, isPrimary: id === primaryPhotoId },
          { where: { id, userId }, transaction },
        );
      }
    });
  }

  async assertOnboardingReady(
    userId: string,
    transaction?: Transaction,
  ): Promise<void> {
    const photos = await this.repository.findAll({
      where: { userId },
      ...(transaction ? { transaction } : {}),
    });
    if (
      photos.length < datingProfileConfig.minimumPhotos ||
      photos.length > datingProfileConfig.maximumPhotos
    )
      throw new Errors.BadRequestError(
        `Profile photos must be between ${datingProfileConfig.minimumPhotos} and ${datingProfileConfig.maximumPhotos}`,
      );
    if (photos.filter(({ isPrimary }) => isPrimary).length !== 1)
      throw new Errors.BadRequestError(
        'Exactly one profile photo must be primary',
      );
  }
}
