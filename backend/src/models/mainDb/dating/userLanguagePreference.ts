import { DataTypes, Model, type Sequelize } from 'sequelize';
import {
  modelOptions,
  timestampAttributes,
  uuidPrimaryKey,
} from '../../modelHelpers';

export class UserLanguagePreference extends Model {
  declare id: string;
  declare userId: string;
  declare languageId: string;
  declare isDealbreaker: boolean;
  declare priority: number;

  static initialize(sequelize: Sequelize): void {
    UserLanguagePreference.init(
      {
        id: uuidPrimaryKey(),
        userId: { type: DataTypes.UUID, allowNull: false, field: 'user_id' },
        languageId: {
          type: DataTypes.UUID,
          allowNull: false,
          field: 'language_id',
        },
        isDealbreaker: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
          field: 'is_dealbreaker',
        },
        priority: {
          type: DataTypes.SMALLINT,
          allowNull: false,
          defaultValue: 3,
        },
        ...timestampAttributes(),
      },
      modelOptions(sequelize, 'user_language_preferences'),
    );
  }
}
