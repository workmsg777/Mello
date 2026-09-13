import { DataTypes, Model, type Sequelize } from 'sequelize';
import {
  modelOptions,
  timestampAttributes,
  uuidPrimaryKey,
} from '../../modelHelpers';

/** Join entity recording an account-to-role authorization assignment. */
export class AccountRole extends Model {
  declare id: string;
  declare accountId: string;
  declare roleId: string;
  declare createdAt: Date;
  declare updatedAt: Date;

  static initialize(sequelize: Sequelize): void {
    AccountRole.init(
      {
        id: uuidPrimaryKey(),
        accountId: {
          type: DataTypes.UUID,
          allowNull: false,
          field: 'account_id',
        },
        roleId: {
          type: DataTypes.UUID,
          allowNull: false,
          field: 'role_id',
        },
        ...timestampAttributes(),
      },
      {
        ...modelOptions(sequelize, 'account_roles'),
        indexes: [
          {
            unique: true,
            fields: ['account_id', 'role_id'],
          },
        ],
      },
    );
  }
}
