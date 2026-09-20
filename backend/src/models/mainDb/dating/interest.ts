import { DataTypes, Model, type Sequelize } from 'sequelize';
import {
  modelOptions,
  timestampAttributes,
  uuidPrimaryKey,
} from '../../modelHelpers';

export class Interest extends Model {
  declare id: string;
  declare categoryId: string;
  declare code: string;
  declare name: string;
  declare labelKey: string | null;
  declare description: string | null;
  declare isActive: boolean;
  declare displayOrder: number | null;
  declare metadata: Record<string, unknown> | null;

  static initialize(sequelize: Sequelize): void {
    Interest.init(
      {
        id: uuidPrimaryKey(),
        categoryId: {
          type: DataTypes.UUID,
          allowNull: false,
          field: 'category_id',
        },
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
          allowNull: true,
          field: 'display_order',
        },
        metadata: { type: DataTypes.JSONB, allowNull: true },
        ...timestampAttributes(),
      },
      modelOptions(sequelize, 'interests'),
    );
  }
}
