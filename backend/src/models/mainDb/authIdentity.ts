import { DataTypes, Model, type Sequelize } from 'sequelize';
import {
  modelOptions,
  timestampAttributes,
  uuidPrimaryKey,
} from '../modelHelpers';

/** Authentication identity. passwordHash is nullable for passwordless providers. */
export class AuthIdentity extends Model {
  declare id: string;
  declare accountId: string;
  declare provider: 'PHONE' | 'EMAIL' | 'GOOGLE' | 'APPLE';
  declare identifier: string;
  declare passwordHash: string | null;
  declare isPrimary: boolean;
  declare verifiedAt: Date | null;
  declare lastUsedAt: Date | null;
  declare createdAt: Date;
  declare updatedAt: Date;
  declare deletedAt: Date | null;

  static initialize(sequelize: Sequelize): void {
    AuthIdentity.init(
      {
        id: uuidPrimaryKey(),
        accountId: {
          type: DataTypes.UUID,
          allowNull: false,
          field: 'account_id',
        },
        provider: {
          type: DataTypes.ENUM('PHONE', 'EMAIL', 'GOOGLE', 'APPLE'),
          allowNull: false,
        },
        identifier: {
          type: DataTypes.STRING(320),
          allowNull: false,
        },
        passwordHash: {
          type: DataTypes.TEXT,
          allowNull: true,
          field: 'password_hash',
        },
        isPrimary: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
          field: 'is_primary',
        },
        verifiedAt: {
          type: DataTypes.DATE,
          allowNull: true,
          field: 'verified_at',
        },
        lastUsedAt: {
          type: DataTypes.DATE,
          allowNull: true,
          field: 'last_used_at',
        },
        ...timestampAttributes(true),
      },
      modelOptions(sequelize, 'auth_identities', true),
    );
  }
}
