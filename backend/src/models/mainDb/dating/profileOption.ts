import { DataTypes, Model, type Sequelize } from 'sequelize';
import {
  modelOptions,
  timestampAttributes,
  uuidPrimaryKey,
} from '../../modelHelpers';

export class ProfileOption extends Model {
  declare id: string;
  declare categoryId: string;
  declare code: string;
  declare label: string;
  declare labelKey: string | null;
  declare description: string | null;
  declare displayOrder: number;
  declare isActive: boolean;
  declare metadata: Record<string, unknown> | null;

  static initialize(sequelize: Sequelize): void {
    ProfileOption.init(
      {
        id: uuidPrimaryKey(),
        categoryId: {
          type: DataTypes.UUID,
          allowNull: false,
          field: 'category_id',
        },
        code: { type: DataTypes.STRING(100), allowNull: false },
        label: { type: DataTypes.STRING(150), allowNull: false },
        labelKey: {
          type: DataTypes.STRING(200),
          allowNull: true,
          field: 'label_key',
        },
        description: { type: DataTypes.TEXT, allowNull: true },
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
        metadata: { type: DataTypes.JSONB, allowNull: true },
        ...timestampAttributes(),
      },
      modelOptions(sequelize, 'profile_options'),
    );
  }
}
