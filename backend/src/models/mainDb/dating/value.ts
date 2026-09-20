import { DataTypes, Model, type Sequelize } from 'sequelize';
import {
  modelOptions,
  timestampAttributes,
  uuidPrimaryKey,
} from '../../modelHelpers';

export class Value extends Model {
  declare id: string;
  declare code: string;
  declare name: string;
  declare labelKey: string | null;
  declare description: string | null;
  declare isActive: boolean;
  declare displayOrder: number;

  static initialize(sequelize: Sequelize): void {
    Value.init(
      {
        id: uuidPrimaryKey(),
        code: { type: DataTypes.STRING(100), allowNull: false, unique: true },
        name: { type: DataTypes.STRING(150), allowNull: false },
        labelKey: {
          type: DataTypes.STRING(200),
          allowNull: true,
          field: 'label_key',
        },
        description: { type: DataTypes.TEXT, allowNull: true },
        isActive: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true,
          field: 'is_active',
        },
        displayOrder: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
          field: 'display_order',
        },
        ...timestampAttributes(),
      },
      modelOptions(sequelize, 'values'),
    );
  }
}
