import {
  DataTypes,
  Model,
  type ModelAttributes,
  type Sequelize,
} from 'sequelize';

const id = () => ({
  type: DataTypes.UUID,
  defaultValue: DataTypes.UUIDV4,
  allowNull: false,
  primaryKey: true,
});

const timestamps = (paranoid = false): ModelAttributes => ({
  createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
  updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at' },
  ...(paranoid ? { deletedAt: { type: DataTypes.DATE, allowNull: true, field: 'deleted_at' } } : {}),
});

const options = (sequelize: Sequelize, tableName: string, paranoid = false) => ({
  sequelize,
  tableName,
  modelName: tableName,
  timestamps: true,
  paranoid,
  underscored: true,
});

/** Central authenticated actor owned by the account domain. */
export class Account extends Model {
  declare id: string;
  declare accountType: 'DATING_USER' | 'PARTNER_USER' | 'PLATFORM_USER';
  declare status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'BLOCKED' | 'DEACTIVATED' | 'DELETED';
  declare createdAt: Date;
  declare updatedAt: Date;
  declare deletedAt: Date | null;

  static initialize(sequelize: Sequelize): void {
    Account.init({
      id: id(),
      accountType: { type: DataTypes.ENUM('DATING_USER', 'PARTNER_USER', 'PLATFORM_USER'), allowNull: false, field: 'account_type' },
      status: { type: DataTypes.ENUM('PENDING', 'ACTIVE', 'SUSPENDED', 'BLOCKED', 'DEACTIVATED', 'DELETED'), allowNull: false, defaultValue: 'PENDING' },
      ...timestamps(true),
    }, options(sequelize, 'accounts', true));
  }
}

/** Minimal dating-user extension. Profile, preference, and discovery data do not belong here. */
export class User extends Model {
  declare id: string;
  declare accountId: string;
  declare createdAt: Date;
  declare updatedAt: Date;
  declare deletedAt: Date | null;

  static initialize(sequelize: Sequelize): void {
    User.init({
      id: id(),
      accountId: { type: DataTypes.UUID, allowNull: false, unique: true, field: 'account_id' },
      ...timestamps(true),
    }, options(sequelize, 'users', true));
  }
}

/** Partner-domain business or venue, with one initial address and ordinary coordinates. */
export class Partner extends Model {
  declare id: string;
  declare name: string;
  declare category: 'CAFE' | 'HOTEL' | 'ACTIVITY' | 'OTHER';
  declare description: string | null;
  declare addressLine1: string;
  declare addressLine2: string | null;
  declare city: string;
  declare state: string;
  declare postalCode: string;
  declare countryCode: string;
  declare latitude: string | null;
  declare longitude: string | null;
  declare phone: string | null;
  declare email: string | null;
  declare status: 'ACTIVE' | 'INACTIVE';
  declare createdAt: Date;
  declare updatedAt: Date;
  declare deletedAt: Date | null;

  static initialize(sequelize: Sequelize): void {
    Partner.init({
      id: id(), name: { type: DataTypes.STRING(200), allowNull: false },
      category: { type: DataTypes.ENUM('CAFE', 'HOTEL', 'ACTIVITY', 'OTHER'), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },
      addressLine1: { type: DataTypes.STRING(255), allowNull: false, field: 'address_line_1' },
      addressLine2: { type: DataTypes.STRING(255), allowNull: true, field: 'address_line_2' },
      city: { type: DataTypes.STRING(120), allowNull: false }, state: { type: DataTypes.STRING(120), allowNull: false },
      postalCode: { type: DataTypes.STRING(20), allowNull: false, field: 'postal_code' },
      countryCode: { type: DataTypes.STRING(2), allowNull: false, field: 'country_code', validate: { is: /^[A-Z]{2}$/ } },
      latitude: { type: DataTypes.DECIMAL(9, 6), allowNull: true }, longitude: { type: DataTypes.DECIMAL(9, 6), allowNull: true },
      phone: { type: DataTypes.STRING(32), allowNull: true }, email: { type: DataTypes.STRING(320), allowNull: true },
      status: { type: DataTypes.ENUM('ACTIVE', 'INACTIVE'), allowNull: false, defaultValue: 'ACTIVE' },
      ...timestamps(true),
    }, options(sequelize, 'partners', true));
  }
}

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
    PartnerUser.init({
      id: id(), accountId: { type: DataTypes.UUID, allowNull: false, unique: true, field: 'account_id' },
      partnerId: { type: DataTypes.UUID, allowNull: false, field: 'partner_id' }, name: { type: DataTypes.STRING(200), allowNull: false },
      staffRole: { type: DataTypes.ENUM('OWNER', 'MANAGER', 'STAFF'), allowNull: false, field: 'staff_role' }, ...timestamps(true),
    }, options(sequelize, 'partner_users', true));
  }
}

/** Internal Mello staff profile. All authorization is supplied by AccountRole. */
export class PlatformUser extends Model {
  declare id: string;
  declare accountId: string;
  declare name: string;
  declare createdAt: Date;
  declare updatedAt: Date;
  declare deletedAt: Date | null;

  static initialize(sequelize: Sequelize): void {
    PlatformUser.init({
      id: id(), accountId: { type: DataTypes.UUID, allowNull: false, unique: true, field: 'account_id' },
      name: { type: DataTypes.STRING(200), allowNull: false }, ...timestamps(true),
    }, options(sequelize, 'platform_users', true));
  }
}

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
    Role.init({
      id: id(), code: { type: DataTypes.STRING(64), allowNull: false, unique: true }, name: { type: DataTypes.STRING(120), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true }, isSystem: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_system' },
      ...timestamps(),
    }, options(sequelize, 'roles'));
  }
}

/** Join entity recording an account-to-role authorization assignment. */
export class AccountRole extends Model {
  declare id: string;
  declare accountId: string;
  declare roleId: string;
  declare createdAt: Date;
  declare updatedAt: Date;

  static initialize(sequelize: Sequelize): void {
    AccountRole.init({
      id: id(), accountId: { type: DataTypes.UUID, allowNull: false, field: 'account_id' },
      roleId: { type: DataTypes.UUID, allowNull: false, field: 'role_id' }, ...timestamps(),
    }, { ...options(sequelize, 'account_roles'), indexes: [{ unique: true, fields: ['account_id', 'role_id'] }] });
  }
}

/** Authentication identity. passwordHash is nullable for passwordless providers and must never contain plaintext. */
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
    AuthIdentity.init({
      id: id(), accountId: { type: DataTypes.UUID, allowNull: false, field: 'account_id' },
      provider: { type: DataTypes.ENUM('PHONE', 'EMAIL', 'GOOGLE', 'APPLE'), allowNull: false }, identifier: { type: DataTypes.STRING(320), allowNull: false },
      passwordHash: { type: DataTypes.TEXT, allowNull: true, field: 'password_hash' }, isPrimary: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_primary' },
      verifiedAt: { type: DataTypes.DATE, allowNull: true, field: 'verified_at' }, lastUsedAt: { type: DataTypes.DATE, allowNull: true, field: 'last_used_at' }, ...timestamps(true),
    }, options(sequelize, 'auth_identities', true));
  }
}

/** OTP challenge. accountId is nullable because signup verification can precede account creation; codeHash never stores the OTP. */
export class OtpChallenge extends Model {
  declare id: string;
  declare accountId: string | null;
  declare identifier: string;
  declare channel: 'PHONE' | 'EMAIL';
  declare purpose: 'SIGNUP' | 'LOGIN' | 'VERIFY_PHONE' | 'VERIFY_EMAIL' | 'CHANGE_PHONE' | 'CHANGE_EMAIL' | 'ACCOUNT_RECOVERY' | 'PASSWORD_RESET';
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
    OtpChallenge.init({
      id: id(), accountId: { type: DataTypes.UUID, allowNull: true, field: 'account_id' }, identifier: { type: DataTypes.STRING(320), allowNull: false },
      channel: { type: DataTypes.ENUM('PHONE', 'EMAIL'), allowNull: false }, purpose: { type: DataTypes.ENUM('SIGNUP', 'LOGIN', 'VERIFY_PHONE', 'VERIFY_EMAIL', 'CHANGE_PHONE', 'CHANGE_EMAIL', 'ACCOUNT_RECOVERY', 'PASSWORD_RESET'), allowNull: false },
      codeHash: { type: DataTypes.TEXT, allowNull: false, field: 'code_hash' }, attemptCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'attempt_count' },
      maxAttempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 5, field: 'max_attempts' }, expiresAt: { type: DataTypes.DATE, allowNull: false, field: 'expires_at' },
      consumedAt: { type: DataTypes.DATE, allowNull: true, field: 'consumed_at' }, requestIp: { type: DataTypes.INET, allowNull: true, field: 'request_ip' },
      userAgent: { type: DataTypes.TEXT, allowNull: true, field: 'user_agent' }, ...timestamps(),
    }, options(sequelize, 'otp_challenges'));
  }
}

/** Refresh/device session. refreshTokenHash is security-sensitive and raw refresh tokens must never be stored. */
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
    UserSession.init({
      id: id(), accountId: { type: DataTypes.UUID, allowNull: false, field: 'account_id' }, refreshTokenHash: { type: DataTypes.TEXT, allowNull: false, unique: true, field: 'refresh_token_hash' },
      deviceId: { type: DataTypes.STRING(255), allowNull: true, field: 'device_id' }, deviceName: { type: DataTypes.STRING(255), allowNull: true, field: 'device_name' },
      platform: { type: DataTypes.ENUM('ANDROID', 'IOS', 'WEB', 'UNKNOWN'), allowNull: false, defaultValue: 'UNKNOWN' }, ipAddress: { type: DataTypes.INET, allowNull: true, field: 'ip_address' },
      userAgent: { type: DataTypes.TEXT, allowNull: true, field: 'user_agent' }, lastSeenAt: { type: DataTypes.DATE, allowNull: true, field: 'last_seen_at' },
      expiresAt: { type: DataTypes.DATE, allowNull: false, field: 'expires_at' }, revokedAt: { type: DataTypes.DATE, allowNull: true, field: 'revoked_at' }, ...timestamps(),
    }, options(sequelize, 'user_sessions'));
  }
}

/** Reusable object-storage metadata. File bytes remain outside PostgreSQL. */
export class Media extends Model {
  declare id: string;
  declare uploadedByAccountId: string | null;
  declare storageProvider: string;
  declare storageKey: string;
  declare url: string | null;
  declare mediaType: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'OTHER';
  declare mimeType: string;
  declare sizeBytes: string;
  declare width: number | null;
  declare height: number | null;
  declare checksum: string | null;
  declare createdAt: Date;
  declare updatedAt: Date;
  declare deletedAt: Date | null;

  static initialize(sequelize: Sequelize): void {
    Media.init({
      id: id(), uploadedByAccountId: { type: DataTypes.UUID, allowNull: true, field: 'uploaded_by_account_id' }, storageProvider: { type: DataTypes.STRING(50), allowNull: false, field: 'storage_provider' },
      storageKey: { type: DataTypes.STRING(1024), allowNull: false, field: 'storage_key' }, url: { type: DataTypes.TEXT, allowNull: true }, mediaType: { type: DataTypes.ENUM('IMAGE', 'VIDEO', 'AUDIO', 'OTHER'), allowNull: false, field: 'media_type' },
      mimeType: { type: DataTypes.STRING(255), allowNull: false, field: 'mime_type' }, sizeBytes: { type: DataTypes.BIGINT, allowNull: false, field: 'size_bytes' },
      width: { type: DataTypes.INTEGER, allowNull: true }, height: { type: DataTypes.INTEGER, allowNull: true }, checksum: { type: DataTypes.STRING(255), allowNull: true }, ...timestamps(true),
    }, options(sequelize, 'media', true));
  }
}

/** Dating-photo mapping with profile ordering, primary selection, and moderation state. */
export class UserPhoto extends Model {
  declare id: string;
  declare userId: string;
  declare mediaId: string;
  declare displayOrder: number;
  declare isPrimary: boolean;
  declare moderationStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  declare createdAt: Date;
  declare updatedAt: Date;
  declare deletedAt: Date | null;

  static initialize(sequelize: Sequelize): void {
    UserPhoto.init({
      id: id(), userId: { type: DataTypes.UUID, allowNull: false, field: 'user_id' }, mediaId: { type: DataTypes.UUID, allowNull: false, field: 'media_id' },
      displayOrder: { type: DataTypes.INTEGER, allowNull: false, field: 'display_order' }, isPrimary: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_primary' },
      moderationStatus: { type: DataTypes.ENUM('PENDING', 'APPROVED', 'REJECTED'), allowNull: false, defaultValue: 'PENDING', field: 'moderation_status' }, ...timestamps(true),
    }, options(sequelize, 'user_photos', true));
  }
}

/** Partner-photo mapping with presentation category and gallery ordering. */
export class PartnerPhoto extends Model {
  declare id: string;
  declare partnerId: string;
  declare mediaId: string;
  declare category: 'COVER' | 'GALLERY' | 'MENU' | 'VENUE' | 'OTHER';
  declare displayOrder: number;
  declare isPrimary: boolean;
  declare createdAt: Date;
  declare updatedAt: Date;
  declare deletedAt: Date | null;

  static initialize(sequelize: Sequelize): void {
    PartnerPhoto.init({
      id: id(), partnerId: { type: DataTypes.UUID, allowNull: false, field: 'partner_id' }, mediaId: { type: DataTypes.UUID, allowNull: false, field: 'media_id' },
      category: { type: DataTypes.ENUM('COVER', 'GALLERY', 'MENU', 'VENUE', 'OTHER'), allowNull: false }, displayOrder: { type: DataTypes.INTEGER, allowNull: false, field: 'display_order' },
      isPrimary: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_primary' }, ...timestamps(true),
    }, options(sequelize, 'partner_photos', true));
  }
}

export const persistedModels = [Account, User, Partner, PartnerUser, PlatformUser, Role, AccountRole, AuthIdentity, OtpChallenge, UserSession, Media, UserPhoto, PartnerPhoto] as const;
