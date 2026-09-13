import { DataTypes, Model, type Sequelize } from 'sequelize';
import {
  modelOptions,
  timestampAttributes,
  uuidPrimaryKey,
} from '../modelHelpers';

/** Central authenticated actor owned by the account domain. */
export class Account extends Model {
  declare id: string;
  declare accountType: 'DATING_USER' | 'PARTNER_USER' | 'PLATFORM_USER';
  declare status:
    'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'BLOCKED' | 'DEACTIVATED' | 'DELETED';
  declare createdAt: Date;
  declare updatedAt: Date;
  declare deletedAt: Date | null;

  static initialize(sequelize: Sequelize): void {
    Account.init(
      {
        id: uuidPrimaryKey(),
        accountType: {
          type: DataTypes.ENUM('DATING_USER', 'PARTNER_USER', 'PLATFORM_USER'),
          allowNull: false,
          field: 'account_type',
        },
        status: {
          type: DataTypes.ENUM(
            'PENDING',
            'ACTIVE',
            'SUSPENDED',
            'BLOCKED',
            'DEACTIVATED',
            'DELETED',
          ),
          allowNull: false,
          defaultValue: 'PENDING',
        },
        ...timestampAttributes(true),
      },
      modelOptions(sequelize, 'accounts', true),
    );
  }
}
