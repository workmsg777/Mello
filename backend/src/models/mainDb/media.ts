import { DataTypes, Model, type Sequelize } from 'sequelize';
import {
  modelOptions,
  timestampAttributes,
  uuidPrimaryKey,
} from '../modelHelpers';

/** Reusable object-storage metadata. File bytes remain outside PostgreSQL. */
export class Media extends Model {
  declare id: string;
  declare uploadedByAccountId: string | null;
  declare storageProvider: string;
  declare storageKey: string;
  declare url: string | null;
  declare mediaType: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'OTHER';
  declare mimeType: string;
  declare sizeBytes: string;
  declare width: number | null;
  declare height: number | null;
  declare checksum: string | null;
  declare createdAt: Date;
  declare updatedAt: Date;
  declare deletedAt: Date | null;

  static initialize(sequelize: Sequelize): void {
    Media.init(
      {
        id: uuidPrimaryKey(),
        uploadedByAccountId: {
          type: DataTypes.UUID,
          allowNull: true,
          field: 'uploaded_by_account_id',
        },
        storageProvider: {
          type: DataTypes.STRING(50),
          allowNull: false,
          field: 'storage_provider',
        },
        storageKey: {
          type: DataTypes.STRING(1024),
          allowNull: false,
          field: 'storage_key',
        },
        url: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        mediaType: {
          type: DataTypes.ENUM('IMAGE', 'VIDEO', 'AUDIO', 'OTHER'),
          allowNull: false,
          field: 'media_type',
        },
        mimeType: {
          type: DataTypes.STRING(255),
          allowNull: false,
          field: 'mime_type',
        },
        sizeBytes: {
          type: DataTypes.BIGINT,
          allowNull: false,
          field: 'size_bytes',
        },
        width: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },
        height: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },
        checksum: {
          type: DataTypes.STRING(255),
          allowNull: true,
        },
        ...timestampAttributes(true),
      },
      modelOptions(sequelize, 'media', true),
    );
  }
}
