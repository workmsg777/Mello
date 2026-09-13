import { Op, type Transaction } from 'sequelize';
import Errors from '../errors';
import {
  Account,
  AccountRole,
  AuthIdentity,
  Partner,
  PartnerUser,
  PlatformUser,
  Role,
  User,
  UserSession,
} from '../models';
import type {
  AccountType,
  DeviceInfo,
  PartnerSignupData,
  PlatformSignupData,
  RequestMetadata,
} from '../types/auth';

export interface CreateAccountInput {
  phone: string;
  accountType: AccountType;
  partner?: PartnerSignupData;
  platformUser?: PlatformSignupData;
}

export interface AccountProfile {
  account: {
    id: string;
    accountType: AccountType;
    status: string;
  };
  profile: Record<string, unknown>;
}

export class AuthenticationRepository {
  findPhoneIdentity(
    phone: string,
    transaction?: Transaction,
  ): Promise<AuthIdentity | null> {
    return AuthIdentity.findOne({
      where: { provider: 'PHONE', identifier: phone },
      ...(transaction ? { transaction } : {}),
    });
  }

  findAccount(
    accountId: string,
    transaction?: Transaction,
  ): Promise<Account | null> {
    return Account.findByPk(accountId, {
      ...(transaction ? { transaction } : {}),
    });
  }

  async createAccount(
    input: CreateAccountInput,
    transaction: Transaction,
  ): Promise<AccountProfile> {
    const account = await Account.create(
      {
        accountType: input.accountType,
        status: 'ACTIVE',
      },
      { transaction },
    );

    await AuthIdentity.create(
      {
        accountId: account.id,
        provider: 'PHONE',
        identifier: input.phone,
        passwordHash: null,
        isPrimary: true,
        verifiedAt: new Date(),
        lastUsedAt: new Date(),
      },
      { transaction },
    );

    const profile = await this.createProfile(input, account.id, transaction);
    await this.assignInitialRole(input.accountType, account.id, transaction);

    return {
      account: {
        id: account.id,
        accountType: account.accountType,
        status: account.status,
      },
      profile,
    };
  }

  async getAccountProfile(
    accountId: string,
    transaction?: Transaction,
  ): Promise<AccountProfile | null> {
    const account = await this.findAccount(accountId, transaction);
    if (!account) return null;

    const profile = await this.findProfile(
      account.accountType,
      account.id,
      transaction,
    );

    return {
      account: {
        id: account.id,
        accountType: account.accountType,
        status: account.status,
      },
      profile,
    };
  }

  createSession(
    accountId: string,
    refreshTokenHash: string,
    expiresAt: Date,
    device: DeviceInfo,
    metadata: RequestMetadata,
    transaction: Transaction,
  ): Promise<UserSession> {
    return UserSession.create(
      {
        accountId,
        refreshTokenHash,
        deviceId: device.deviceId ?? null,
        deviceName: device.deviceName ?? null,
        platform: device.platform ?? 'UNKNOWN',
        ipAddress: metadata.ipAddress ?? null,
        userAgent: metadata.userAgent ?? null,
        lastSeenAt: new Date(),
        expiresAt,
        revokedAt: null,
      },
      { transaction },
    );
  }

  findActiveSession(refreshTokenHash: string): Promise<UserSession | null> {
    return UserSession.findOne({
      where: {
        refreshTokenHash,
        revokedAt: null,
        expiresAt: { [Op.gt]: new Date() },
      },
    });
  }

  async rotateSession(
    session: UserSession,
    currentHash: string,
    nextHash: string,
    metadata: RequestMetadata,
  ): Promise<boolean> {
    const [updated] = await UserSession.update(
      {
        refreshTokenHash: nextHash,
        lastSeenAt: new Date(),
        ...(metadata.ipAddress ? { ipAddress: metadata.ipAddress } : {}),
        ...(metadata.userAgent ? { userAgent: metadata.userAgent } : {}),
      },
      {
        where: {
          id: session.id,
          refreshTokenHash: currentHash,
          revokedAt: null,
        },
      },
    );
    return updated === 1;
  }

  async revokeSession(refreshTokenHash: string): Promise<void> {
    await UserSession.update(
      { revokedAt: new Date() },
      { where: { refreshTokenHash, revokedAt: null } },
    );
  }

  async touchIdentity(
    identityId: string,
    transaction: Transaction,
  ): Promise<void> {
    await AuthIdentity.update(
      { lastUsedAt: new Date() },
      { where: { id: identityId }, transaction },
    );
  }

  private async createProfile(
    input: CreateAccountInput,
    accountId: string,
    transaction: Transaction,
  ): Promise<Record<string, unknown>> {
    if (input.accountType === 'DATING_USER') {
      const user = await User.create({ accountId }, { transaction });
      return { userId: user.id };
    }

    if (input.accountType === 'PARTNER_USER') {
      if (!input.partner) {
        throw new Errors.BadRequestError('Partner signup data is required');
      }
      const data = input.partner;
      const partner = await Partner.create(
        {
          name: data.businessName,
          category: data.category,
          description: data.description ?? null,
          addressLine1: data.addressLine1,
          addressLine2: data.addressLine2 ?? null,
          city: data.city,
          state: data.state,
          postalCode: data.postalCode,
          countryCode: data.countryCode,
          latitude: data.latitude ?? null,
          longitude: data.longitude ?? null,
          phone: data.businessPhone ?? input.phone,
          email: data.businessEmail ?? null,
          status: 'ACTIVE',
        },
        { transaction },
      );
      const partnerUser = await PartnerUser.create(
        {
          accountId,
          partnerId: partner.id,
          name: data.ownerName,
          staffRole: 'OWNER',
        },
        { transaction },
      );
      return {
        partnerUserId: partnerUser.id,
        name: partnerUser.name,
        staffRole: partnerUser.staffRole,
        partner: this.partnerJson(partner),
      };
    }

    if (!input.platformUser) {
      throw new Errors.BadRequestError('Platform-user signup data is required');
    }
    const platformUser = await PlatformUser.create(
      { accountId, name: input.platformUser.name },
      { transaction },
    );
    return { platformUserId: platformUser.id, name: platformUser.name };
  }

  private async assignInitialRole(
    accountType: AccountType,
    accountId: string,
    transaction: Transaction,
  ): Promise<void> {
    const roleCode =
      accountType === 'DATING_USER'
        ? 'CUSTOMER'
        : accountType === 'PLATFORM_USER'
          ? 'ADMIN'
          : null;
    if (!roleCode) return;

    const role = await Role.findOne({ where: { code: roleCode }, transaction });
    if (!role) {
      throw new Errors.SystemError(
        `Required system role ${roleCode} has not been seeded`,
      );
    }
    await AccountRole.create({ accountId, roleId: role.id }, { transaction });
  }

  private async findProfile(
    accountType: AccountType,
    accountId: string,
    transaction?: Transaction,
  ): Promise<Record<string, unknown>> {
    const transactionOption = transaction ? { transaction } : {};

    if (accountType === 'DATING_USER') {
      const user = await User.findOne({
        where: { accountId },
        ...transactionOption,
      });
      return user ? { userId: user.id } : {};
    }

    if (accountType === 'PARTNER_USER') {
      const partnerUser = await PartnerUser.findOne({
        where: { accountId },
        ...transactionOption,
      });
      if (!partnerUser) return {};
      const partner = await Partner.findByPk(partnerUser.partnerId, {
        ...transactionOption,
      });
      return {
        partnerUserId: partnerUser.id,
        name: partnerUser.name,
        staffRole: partnerUser.staffRole,
        ...(partner ? { partner: this.partnerJson(partner) } : {}),
      };
    }

    const platformUser = await PlatformUser.findOne({
      where: { accountId },
      ...transactionOption,
    });
    return platformUser
      ? { platformUserId: platformUser.id, name: platformUser.name }
      : {};
  }

  private partnerJson(partner: Partner): Record<string, unknown> {
    return {
      id: partner.id,
      name: partner.name,
      category: partner.category,
      description: partner.description,
      addressLine1: partner.addressLine1,
      addressLine2: partner.addressLine2,
      city: partner.city,
      state: partner.state,
      postalCode: partner.postalCode,
      countryCode: partner.countryCode,
      latitude: partner.latitude,
      longitude: partner.longitude,
      phone: partner.phone,
      email: partner.email,
      status: partner.status,
    };
  }
}
