import { DataTypes, Model, type Sequelize } from 'sequelize';
import {
  modelOptions,
  timestampAttributes,
  uuidPrimaryKey,
} from '../../modelHelpers';

export class UserInterest extends Model {
  declare id: string;
  declare userId: string;
  declare interestId: string;
  declare isFavorite: boolean;
  declare displayOrder: number | null;
  declare source: 'SELF_SELECTED' | 'SUGGESTED' | 'INFERRED';

  static initialize(sequelize: Sequelize): void {
    UserInterest.init(
      {
        id: uuidPrimaryKey(),
        userId: { type: DataTypes.UUID, allowNull: false, field: 'user_id' },
        interestId: {
          type: DataTypes.UUID,
          allowNull: false,
          field: 'interest_id',
        },
        isFavorite: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
          field: 'is_favorite',
        },
        displayOrder: {
          type: DataTypes.INTEGER,
          allowNull: true,
          field: 'display_order',
        },
        source: {
          type: DataTypes.ENUM('SELF_SELECTED', 'SUGGESTED', 'INFERRED'),
          allowNull: false,
          defaultValue: 'SELF_SELECTED',
        },
        ...timestampAttributes(),
      },
      modelOptions(sequelize, 'user_interests'),
    );
  }
}
