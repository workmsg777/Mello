import { DataTypes, Model, type Sequelize } from 'sequelize';
import {
  modelOptions,
  timestampAttributes,
  uuidPrimaryKey,
} from '../../modelHelpers';

export class UserConsent extends Model {
  declare id: string;
  declare userId: string;
  declare consentCode: string;
  declare policyVersion: string;
  declare status: 'GRANTED' | 'REVOKED';
  declare grantedAt: Date | null;
  declare revokedAt: Date | null;
  declare ipAddress: string | null;
  declare userAgent: string | null;
  declare createdAt: Date;
  declare updatedAt: Date;

  static initialize(sequelize: Sequelize): void {
    UserConsent.init(
      {
        id: uuidPrimaryKey(),
        userId: { type: DataTypes.UUID, allowNull: false, field: 'user_id' },
        consentCode: {
          type: DataTypes.STRING(100),
          allowNull: false,
          field: 'consent_code',
        },
        policyVersion: {
          type: DataTypes.STRING(50),
          allowNull: false,
          field: 'policy_version',
        },
        status: {
          type: DataTypes.ENUM('GRANTED', 'REVOKED'),
          allowNull: false,
        },
        grantedAt: {
          type: DataTypes.DATE,
          allowNull: true,
          field: 'granted_at',
        },
        revokedAt: {
          type: DataTypes.DATE,
          allowNull: true,
          field: 'revoked_at',
        },
        ipAddress: {
          type: DataTypes.INET,
          allowNull: true,
          field: 'ip_address',
        },
        userAgent: {
          type: DataTypes.TEXT,
          allowNull: true,
          field: 'user_agent',
        },
        ...timestampAttributes(),
      },
      modelOptions(sequelize, 'user_consents'),
    );
  }
}
