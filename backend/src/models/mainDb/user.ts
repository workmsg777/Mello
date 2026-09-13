import { Model, type Sequelize } from 'sequelize';
import {
  modelOptions,
  timestampAttributes,
  uuidPrimaryKey,
} from '../modelHelpers';
import { DataTypes } from 'sequelize';

/** Minimal dating-user extension. Profile, preference, and discovery data do not belong here. */
export class User extends Model {
  declare id: string;
  declare accountId: string;
  declare createdAt: Date;
  declare updatedAt: Date;
  declare deletedAt: Date | null;

  static initialize(sequelize: Sequelize): void {
    User.init(
      {
        id: uuidPrimaryKey(),
        accountId: {
          type: DataTypes.UUID,
          allowNull: false,
          unique: true,
          field: 'account_id',
        },
        ...timestampAttributes(true),
      },
      modelOptions(sequelize, 'users', true),
    );
  }
}
