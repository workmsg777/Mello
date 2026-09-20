import { DataTypes, Model, type Sequelize } from 'sequelize';
import {
  modelOptions,
  timestampAttributes,
  uuidPrimaryKey,
} from '../../modelHelpers';

export class UserProfileOption extends Model {
  declare id: string;
  declare userId: string;
  declare categoryId: string;
  declare optionId: string;
  declare isPrimary: boolean;
  declare displayOrder: number | null;

  static initialize(sequelize: Sequelize): void {
    UserProfileOption.init(
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
      modelOptions(sequelize, 'user_profile_options'),
    );
  }
}
