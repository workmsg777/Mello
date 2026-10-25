import { DataTypes, Model, type Sequelize } from 'sequelize';
import {
  modelOptions,
  timestampAttributes,
  uuidPrimaryKey,
} from '../../modelHelpers';

export class UserLanguage extends Model {
  declare id: string;
  declare userId: string;
  declare languageId: string;
  declare proficiency: 'NATIVE' | 'FLUENT' | 'CONVERSATIONAL' | 'BASIC' | null;
  declare isPrimary: boolean;
  declare displayOrder: number | null;

  static initialize(sequelize: Sequelize): void {
    UserLanguage.init(
      {
        id: uuidPrimaryKey(),
        userId: { type: DataTypes.UUID, allowNull: false, field: 'user_id' },
        languageId: {
          type: DataTypes.UUID,
          allowNull: false,
          field: 'language_id',
        },
        proficiency: {
          type: DataTypes.ENUM('NATIVE', 'FLUENT', 'CONVERSATIONAL', 'BASIC'),
          allowNull: true,
        },
        isPrimary: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
          field: 'is_primary',
        },
        displayOrder: {
          type: DataTypes.INTEGER,
          allowNull: true,
          field: 'display_order',
        },
        ...timestampAttributes(),
      },
      modelOptions(sequelize, 'user_languages'),
    );
  }
}
