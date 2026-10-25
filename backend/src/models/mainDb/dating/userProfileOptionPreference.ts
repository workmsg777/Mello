import { DataTypes, Model, type Sequelize } from 'sequelize';
import {
  modelOptions,
  timestampAttributes,
  uuidPrimaryKey,
} from '../../modelHelpers';

export class UserProfileOptionPreference extends Model {
  declare id: string;
  declare userId: string;
  declare categoryId: string;
  declare optionId: string;
  declare isDealbreaker: boolean;
  declare priority: number;

  static initialize(sequelize: Sequelize): void {
    UserProfileOptionPreference.init(
      {
        id: uuidPrimaryKey(),
        userId: { type: DataTypes.UUID, allowNull: false, field: 'user_id' },
        categoryId: {
          type: DataTypes.UUID,
          allowNull: false,
          field: 'category_id',
        },
        optionId: {
          type: DataTypes.UUID,
          allowNull: false,
          field: 'option_id',
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
      modelOptions(sequelize, 'user_profile_option_preferences'),
    );
  }
}
