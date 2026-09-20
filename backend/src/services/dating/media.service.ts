import { randomUUID } from 'node:crypto';
import { Op, type Transaction } from 'sequelize';
import { MediaRepository } from '../../repositories';

export interface RegisterImageInput {
  accountId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}

export class MediaService {
  constructor(private readonly repository = new MediaRepository()) {}

  async registerLocalImage(
    input: RegisterImageInput,
    transaction: Transaction,
  ) {
    const media = await this.repository.create(
      {
        id: randomUUID(),
        uploadedByAccountId: input.accountId,
        storageProvider: 'LOCAL',
        storageKey: `profile-photos/${input.filename}`,
        url: `/uploads/profile-photos/${input.filename}`,
        mediaType: 'IMAGE',
        mimeType: input.mimeType,
        sizeBytes: String(input.sizeBytes),
        width: null,
        height: null,
        checksum: null,
      },
      { transaction },
    );
    return {
      id: media.id,
      url: media.url,
      mimeType: media.mimeType,
      sizeBytes: media.sizeBytes,
    };
  }

  async getByIds(ids: string[]) {
    if (!ids.length) return [];
    const media = await this.repository.findAll({
      where: { id: { [Op.in]: ids } },
    });
    return media.map((item) => ({
      id: item.id,
      url: item.url,
      mimeType: item.mimeType,
      width: item.width,
      height: item.height,
    }));
  }
}
