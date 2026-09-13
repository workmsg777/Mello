import { DataTypes, Model, type Sequelize } from 'sequelize';
import {
  modelOptions,
  timestampAttributes,
  uuidPrimaryKey,
} from '../modelHelpers';

/** Refresh/device session. Only a refresh-token hash is persisted. */
export class UserSession extends Model {
  declare id: string;
  declare accountId: string;
  declare refreshTokenHash: string;
  declare deviceId: string | null;
  declare deviceName: string | null;
  declare platform: 'ANDROID' | 'IOS' | 'WEB' | 'UNKNOWN';
  declare ipAddress: string | null;
  declare userAgent: string | null;
  declare lastSeenAt: Date | null;
  declare expiresAt: Date;
  declare revokedAt: Date | null;
  declare createdAt: Date;
  declare updatedAt: Date;

  static initialize(sequelize: Sequelize): void {
    UserSession.init(
      {
        id: uuidPrimaryKey(),
        accountId: {
          type: DataTypes.UUID,
          allowNull: false,
          field: 'account_id',
        },
        refreshTokenHash: {
          type: DataTypes.TEXT,
          allowNull: false,
          unique: true,
          field: 'refresh_token_hash',
        },
        deviceId: {
          type: DataTypes.STRING(255),
          allowNull: true,
          field: 'device_id',
        },
        deviceName: {
          type: DataTypes.STRING(255),
          allowNull: true,
          field: 'device_name',
        },
        platform: {
          type: DataTypes.ENUM('ANDROID', 'IOS', 'WEB', 'UNKNOWN'),
          allowNull: false,
          defaultValue: 'UNKNOWN',
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
        lastSeenAt: {
          type: DataTypes.DATE,
          allowNull: true,
          field: 'last_seen_at',
        },
        expiresAt: {
          type: DataTypes.DATE,
          allowNull: false,
          field: 'expires_at',
        },
        revokedAt: {
          type: DataTypes.DATE,
          allowNull: true,
          field: 'revoked_at',
        },
        ...timestampAttributes(),
      },
      modelOptions(sequelize, 'user_sessions'),
    );
  }
}
