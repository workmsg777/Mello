import { DataTypes, Model, type Sequelize } from 'sequelize';
import {
  modelOptions,
  timestampAttributes,
  uuidPrimaryKey,
} from '../modelHelpers';

/** Partner-domain staff profile. staffRole is organizational and is not platform RBAC. */
export class PartnerUser extends Model {
  declare id: string;
  declare accountId: string;
  declare partnerId: string;
  declare name: string;
  declare staffRole: 'OWNER' | 'MANAGER' | 'STAFF';
  declare createdAt: Date;
  declare updatedAt: Date;
  declare deletedAt: Date | null;

  static initialize(sequelize: Sequelize): void {
    PartnerUser.init(
      {
        id: uuidPrimaryKey(),
        accountId: {
          type: DataTypes.UUID,
          allowNull: false,
          unique: true,
          field: 'account_id',
        },
        partnerId: {
          type: DataTypes.UUID,
          allowNull: false,
          field: 'partner_id',
        },
        name: {
          type: DataTypes.STRING(200),
          allowNull: false,
        },
        staffRole: {
          type: DataTypes.ENUM('OWNER', 'MANAGER', 'STAFF'),
          allowNull: false,
          field: 'staff_role',
        },
        ...timestampAttributes(true),
      },
      modelOptions(sequelize, 'partner_users', true),
    );
  }
}
