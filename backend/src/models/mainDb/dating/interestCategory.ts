import { DataTypes, Model, type Sequelize } from 'sequelize';
import {
  modelOptions,
  timestampAttributes,
  uuidPrimaryKey,
} from '../../modelHelpers';

export class InterestCategory extends Model {
  declare id: string;
  declare code: string;
  declare name: string;
  declare labelKey: string | null;
  declare displayOrder: number;
  declare isActive: boolean;

  static initialize(sequelize: Sequelize): void {
    InterestCategory.init(
      {
        id: uuidPrimaryKey(),
        code: { type: DataTypes.STRING(100), allowNull: false, unique: true },
        name: { type: DataTypes.STRING(150), allowNull: false },
        labelKey: {
          type: DataTypes.STRING(200),
          allowNull: true,
          field: 'label_key',
        },
        displayOrder: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
          field: 'display_order',
        },
        isActive: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true,
          field: 'is_active',
        },
        ...timestampAttributes(),
      },
      modelOptions(sequelize, 'interest_categories'),
    );
  }
}
