import { DataTypes, Model, type Sequelize } from 'sequelize';
import {
  modelOptions,
  timestampAttributes,
  uuidPrimaryKey,
} from '../../modelHelpers';

/** Dating-photo mapping with profile ordering, primary selection, and moderation state. */
export class UserPhoto extends Model {
  declare id: string;
  declare userId: string;
  declare mediaId: string;
  declare displayOrder: number;
  declare isPrimary: boolean;
  declare moderationStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  declare createdAt: Date;
  declare updatedAt: Date;
  declare deletedAt: Date | null;

  static initialize(sequelize: Sequelize): void {
    UserPhoto.init(
      {
        id: uuidPrimaryKey(),
        userId: {
          type: DataTypes.UUID,
          allowNull: false,
          field: 'user_id',
        },
        mediaId: {
          type: DataTypes.UUID,
          allowNull: false,
          field: 'media_id',
        },
        displayOrder: {
          type: DataTypes.INTEGER,
          allowNull: false,
          field: 'display_order',
        },
        isPrimary: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
          field: 'is_primary',
        },
        moderationStatus: {
          type: DataTypes.ENUM('PENDING', 'APPROVED', 'REJECTED'),
          allowNull: false,
          defaultValue: 'PENDING',
          field: 'moderation_status',
        },
        ...timestampAttributes(true),
      },
      modelOptions(sequelize, 'user_photos', true),
    );
  }
}
