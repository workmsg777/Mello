import { DataTypes, Model, type Sequelize } from 'sequelize';
import { PartnerRole } from '../../constants/partner';
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
  declare staffRole: PartnerRole;
  declare invitedByAccountId: string | null;
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
          type: DataTypes.ENUM(...Object.values(PartnerRole)),
          allowNull: false,
          field: 'staff_role',
        },
        invitedByAccountId: {
          type: DataTypes.UUID,
          allowNull: true,
          field: 'invited_by_account_id',
        },
        ...timestampAttributes(true),
      },
      modelOptions(sequelize, 'partner_users', true),
    );
  }
}
