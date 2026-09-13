import { DataTypes, Model, type Sequelize } from 'sequelize';
import {
  modelOptions,
  timestampAttributes,
  uuidPrimaryKey,
} from '../../modelHelpers';

/** Partner-photo mapping with presentation category and gallery ordering. */
export class PartnerPhoto extends Model {
  declare id: string;
  declare partnerId: string;
  declare mediaId: string;
  declare category: 'COVER' | 'GALLERY' | 'MENU' | 'VENUE' | 'OTHER';
  declare displayOrder: number;
  declare isPrimary: boolean;
  declare createdAt: Date;
  declare updatedAt: Date;
  declare deletedAt: Date | null;

  static initialize(sequelize: Sequelize): void {
    PartnerPhoto.init(
      {
        id: uuidPrimaryKey(),
        partnerId: {
          type: DataTypes.UUID,
          allowNull: false,
          field: 'partner_id',
        },
        mediaId: {
          type: DataTypes.UUID,
          allowNull: false,
          field: 'media_id',
        },
        category: {
          type: DataTypes.ENUM('COVER', 'GALLERY', 'MENU', 'VENUE', 'OTHER'),
          allowNull: false,
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
        ...timestampAttributes(true),
      },
      modelOptions(sequelize, 'partner_photos', true),
    );
  }
}
