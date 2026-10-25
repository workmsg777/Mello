import { DataTypes, Model, type Sequelize } from 'sequelize';
import {
  modelOptions,
  timestampAttributes,
  uuidPrimaryKey,
} from '../../modelHelpers';

export class UserProfileVisibility extends Model {
  declare id: string;
  declare userId: string;
  declare fieldCode: string;
  declare visibility: 'PROFILE' | 'MATCHING_ONLY' | 'PRIVATE';

  static initialize(sequelize: Sequelize): void {
    UserProfileVisibility.init(
      {
        id: uuidPrimaryKey(),
        userId: { type: DataTypes.UUID, allowNull: false, field: 'user_id' },
        fieldCode: {
          type: DataTypes.STRING(100),
          allowNull: false,
          field: 'field_code',
        },
        visibility: {
          type: DataTypes.ENUM('PROFILE', 'MATCHING_ONLY', 'PRIVATE'),
          allowNull: false,
        },
        ...timestampAttributes(),
      },
      modelOptions(sequelize, 'user_profile_visibility'),
    );
  }
}
