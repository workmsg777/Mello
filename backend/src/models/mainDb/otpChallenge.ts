import { DataTypes, Model, type Sequelize } from 'sequelize';
import {
  modelOptions,
  timestampAttributes,
  uuidPrimaryKey,
} from '../modelHelpers';

/** OTP challenge. codeHash contains only the hashed OTP value. */
export class OtpChallenge extends Model {
  declare id: string;
  declare accountId: string | null;
  declare identifier: string;
  declare channel: 'PHONE' | 'EMAIL';
  declare purpose:
    | 'SIGNUP'
    | 'LOGIN'
    | 'VERIFY_PHONE'
    | 'VERIFY_EMAIL'
    | 'CHANGE_PHONE'
    | 'CHANGE_EMAIL'
    | 'ACCOUNT_RECOVERY'
    | 'PASSWORD_RESET';
  declare codeHash: string;
  declare attemptCount: number;
  declare maxAttempts: number;
  declare expiresAt: Date;
  declare consumedAt: Date | null;
  declare requestIp: string | null;
  declare userAgent: string | null;
  declare createdAt: Date;
  declare updatedAt: Date;

  static initialize(sequelize: Sequelize): void {
    OtpChallenge.init(
      {
        id: uuidPrimaryKey(),
        accountId: {
          type: DataTypes.UUID,
          allowNull: true,
          field: 'account_id',
        },
        identifier: {
          type: DataTypes.STRING(320),
          allowNull: false,
        },
        channel: {
          type: DataTypes.ENUM('PHONE', 'EMAIL'),
          allowNull: false,
        },
        purpose: {
          type: DataTypes.ENUM(
            'SIGNUP',
            'LOGIN',
            'VERIFY_PHONE',
            'VERIFY_EMAIL',
            'CHANGE_PHONE',
            'CHANGE_EMAIL',
            'ACCOUNT_RECOVERY',
            'PASSWORD_RESET',
          ),
          allowNull: false,
        },
        codeHash: {
          type: DataTypes.TEXT,
          allowNull: false,
          field: 'code_hash',
        },
        attemptCount: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
          field: 'attempt_count',
        },
        maxAttempts: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 5,
          field: 'max_attempts',
        },
        expiresAt: {
          type: DataTypes.DATE,
          allowNull: false,
          field: 'expires_at',
        },
        consumedAt: {
          type: DataTypes.DATE,
          allowNull: true,
          field: 'consumed_at',
        },
        requestIp: {
          type: DataTypes.INET,
          allowNull: true,
          field: 'request_ip',
        },
        userAgent: {
          type: DataTypes.TEXT,
          allowNull: true,
          field: 'user_agent',
        },
        ...timestampAttributes(),
      },
      modelOptions(sequelize, 'otp_challenges'),
    );
  }
}
