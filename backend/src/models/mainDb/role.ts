import { DataTypes, Model, type Sequelize } from 'sequelize';
import {
  modelOptions,
  timestampAttributes,
  uuidPrimaryKey,
} from '../modelHelpers';

/** Reusable authorization role owned by the access-control domain. */
export class Role extends Model {
  declare id: string;
  declare code: string;
  declare name: string;
  declare description: string | null;
  declare isSystem: boolean;
  declare createdAt: Date;
  declare updatedAt: Date;

  static initialize(sequelize: Sequelize): void {
    Role.init(
      {
        id: uuidPrimaryKey(),
        code: {
          type: DataTypes.STRING(64),
          allowNull: false,
          unique: true,
        },
        name: {
          type: DataTypes.STRING(120),
          allowNull: false,
        },
        description: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        isSystem: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
          field: 'is_system',
        },
        ...timestampAttributes(),
      },
      modelOptions(sequelize, 'roles'),
    );
  }
}
