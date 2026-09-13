import { createHash, timingSafeEqual } from 'node:crypto';
import { authConfig, requireJwtSecret } from '../../config/auth';
import { sequelize } from '../../config/database';
import Errors from '../../errors';
import {
  AuthenticationRepository,
  type AccountProfile,
  type CreateAccountInput,
} from '../../repositories/authentication.repository';
import type {
  AccountType,
  AuthContext,
  AuthTokens,
  DeviceInfo,
  RequestMetadata,
} from '../../types/auth';
import { normalizePhoneNumber } from '../../utils/phone';
import type {
  LoginVerifyInput,
  SignupVerifyInput,
} from '../../utils/queryValidators/authQueryValidator';
import { OtpService, type OtpIssueResult } from './otp.service';
import { TokenService } from './token.service';

export interface AuthResponse extends AccountProfile {
  tokens: AuthTokens;
}

export interface OtpRequestResponse extends OtpIssueResult {
  message: string;
}

export class AuthenticationService {
  constructor(
    private readonly repository = new AuthenticationRepository(),
    private readonly otpService = new OtpService(),
    private readonly tokenService = new TokenService(),
  ) {}

  async requestSignupOtp(
    phoneInput: string,
    accountType: AccountType,
  ): Promise<OtpRequestResponse> {
    if (accountType === 'PLATFORM_USER') {
      this.ensurePlatformRegistrationEnabled();
    }

    const phone = normalizePhoneNumber(phoneInput);
    const existingIdentity = await this.repository.findPhoneIdentity(phone);
    if (existingIdentity) {
      throw new Errors.ConflictError(
        'An account already exists for this mobile number',
      );
    }

    const result = await this.otpService.issue('SIGNUP', phone, accountType);
    return { message: 'OTP sent successfully', ...result };
  }

  async verifySignup(
    input: SignupVerifyInput,
    metadata: RequestMetadata,
  ): Promise<AuthResponse> {
    requireJwtSecret();
    const phone = normalizePhoneNumber(input.phone);

    if (input.accountType === 'PLATFORM_USER') {
      this.assertPlatformRegistrationKey(input.platformUser.registrationKey);
    }

    const lease = await this.otpService.beginVerification(
      'SIGNUP',
      phone,
      input.otp,
      input.accountType,
    );

    try {
      const existingIdentity = await this.repository.findPhoneIdentity(phone);
      if (existingIdentity) {
        await this.otpService.consume(lease);
        throw new Errors.ConflictError(
          'An account already exists for this mobile number',
        );
      }

      const refreshToken = this.tokenService.createRefreshToken();
      const refreshTokenHash = this.tokenService.hashRefreshToken(refreshToken);
      const expiresAt = new Date(
        Date.now() + authConfig.refreshTokenTtlSeconds * 1_000,
      );

      const result = await sequelize.transaction(async (transaction) => {
        const createInput = this.toCreateAccountInput(input, phone);
        const accountProfile = await this.repository.createAccount(
          createInput,
          transaction,
        );
        const session = await this.repository.createSession(
          accountProfile.account.id,
          refreshTokenHash,
          expiresAt,
          input.device ?? {},
          metadata,
          transaction,
        );

        return { accountProfile, sessionId: session.id };
      });

      await this.otpService.consume(lease);
      return this.authResponse(
        result.accountProfile,
        result.sessionId,
        refreshToken,
      );
    } catch (error) {
      await this.otpService.release(lease).catch(() => undefined);
      throw error;
    }
  }

  async requestLoginOtp(phoneInput: string): Promise<OtpRequestResponse> {
    const phone = normalizePhoneNumber(phoneInput);
    const identity = await this.repository.findPhoneIdentity(phone);
    const account = identity
      ? await this.repository.findAccount(identity.accountId)
      : null;

    // Keep the outward response identical without sending SMS messages to
    // arbitrary unregistered numbers.
    if (!identity?.verifiedAt || account?.status !== 'ACTIVE') {
      return {
        message: 'If the account exists, an OTP has been sent',
        expiresIn: authConfig.otpTtlSeconds,
        retryAfter: authConfig.otpCooldownSeconds,
      };
    }

    const result = await this.otpService.issue('LOGIN', phone);
    return {
      message: 'If the account exists, an OTP has been sent',
      ...result,
    };
  }

  async verifyLogin(
    input: LoginVerifyInput,
    metadata: RequestMetadata,
  ): Promise<AuthResponse> {
    requireJwtSecret();
    const phone = normalizePhoneNumber(input.phone);
    const lease = await this.otpService.beginVerification(
      'LOGIN',
      phone,
      input.otp,
    );

    try {
      const identity = await this.repository.findPhoneIdentity(phone);
      if (!identity || !identity.verifiedAt) {
        await this.otpService.consume(lease);
        throw new Errors.UnauthorizedError('Account or OTP is invalid');
      }

      const account = await this.repository.findAccount(identity.accountId);
      if (!account) {
        await this.otpService.consume(lease);
        throw new Errors.UnauthorizedError('Account or OTP is invalid');
      }
      this.assertActiveAccount(account.status);

      const refreshToken = this.tokenService.createRefreshToken();
      const refreshTokenHash = this.tokenService.hashRefreshToken(refreshToken);
      const expiresAt = new Date(
        Date.now() + authConfig.refreshTokenTtlSeconds * 1_000,
      );

      const result = await sequelize.transaction(async (transaction) => {
        await this.repository.touchIdentity(identity.id, transaction);
        const session = await this.repository.createSession(
          account.id,
          refreshTokenHash,
          expiresAt,
          input.device ?? {},
          metadata,
          transaction,
        );
        const accountProfile = await this.repository.getAccountProfile(
          account.id,
          transaction,
        );
        if (!accountProfile) {
          throw new Errors.UnauthorizedError('Account is unavailable');
        }

        return { accountProfile, sessionId: session.id };
      });

      await this.otpService.consume(lease);
      return this.authResponse(
        result.accountProfile,
        result.sessionId,
        refreshToken,
      );
    } catch (error) {
      await this.otpService.release(lease).catch(() => undefined);
      throw error;
    }
  }

  async refresh(
    refreshToken: string,
    metadata: RequestMetadata,
  ): Promise<AuthTokens> {
    requireJwtSecret();
    const currentHash = this.tokenService.hashRefreshToken(refreshToken);
    const session = await this.repository.findActiveSession(currentHash);
    if (!session) {
      throw new Errors.UnauthorizedError('Refresh token is invalid or expired');
    }

    const account = await this.repository.findAccount(session.accountId);
    if (!account) {
      throw new Errors.UnauthorizedError('Account is unavailable');
    }
    this.assertActiveAccount(account.status);

    const nextRefreshToken = this.tokenService.createRefreshToken();
    const nextHash = this.tokenService.hashRefreshToken(nextRefreshToken);
    const rotated = await this.repository.rotateSession(
      session,
      currentHash,
      nextHash,
      metadata,
    );
    if (!rotated) {
      throw new Errors.UnauthorizedError('Refresh token was already used');
    }

    return this.tokens(
      account.id,
      account.accountType,
      session.id,
      nextRefreshToken,
    );
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = this.tokenService.hashRefreshToken(refreshToken);
    await this.repository.revokeSession(tokenHash);
  }

  async me(context: AuthContext): Promise<AccountProfile> {
    const profile = await this.repository.getAccountProfile(context.accountId);
    if (!profile) {
      throw new Errors.UnauthorizedError('Account is unavailable');
    }
    this.assertActiveAccount(profile.account.status);
    return profile;
  }

  private authResponse(
    accountProfile: AccountProfile,
    sessionId: string,
    refreshToken: string,
  ): AuthResponse {
    return {
      ...accountProfile,
      tokens: this.tokens(
        accountProfile.account.id,
        accountProfile.account.accountType,
        sessionId,
        refreshToken,
      ),
    };
  }

  private tokens(
    accountId: string,
    accountType: AccountType,
    sessionId: string,
    refreshToken: string,
  ): AuthTokens {
    return {
      accessToken: this.tokenService.createAccessToken({
        accountId,
        accountType,
        sessionId,
      }),
      refreshToken,
      tokenType: 'Bearer',
      accessTokenExpiresIn: authConfig.accessTokenTtlSeconds,
      refreshTokenExpiresIn: authConfig.refreshTokenTtlSeconds,
    };
  }

  private toCreateAccountInput(
    input: SignupVerifyInput,
    phone: string,
  ): CreateAccountInput {
    if (input.accountType === 'PARTNER_USER') {
      return {
        phone,
        accountType: input.accountType,
        partner: {
          ...input.partner,
          ...(input.partner.businessPhone
            ? {
                businessPhone: normalizePhoneNumber(
                  input.partner.businessPhone,
                ),
              }
            : {}),
        },
      };
    }
    if (input.accountType === 'PLATFORM_USER') {
      return {
        phone,
        accountType: input.accountType,
        platformUser: input.platformUser,
      };
    }
    return { phone, accountType: input.accountType };
  }

  private assertActiveAccount(status: string): void {
    if (status === 'ACTIVE') return;
    if (status === 'SUSPENDED' || status === 'BLOCKED') {
      throw new Errors.ForbiddenError(
        'This account is not permitted to log in',
      );
    }
    throw new Errors.UnauthorizedError('This account is not active');
  }

  private ensurePlatformRegistrationEnabled(): void {
    const secret = process.env.PLATFORM_SIGNUP_SECRET;
    if (!secret || secret.length < 32) {
      throw new Errors.ForbiddenError('Platform-user registration is disabled');
    }
  }

  private assertPlatformRegistrationKey(provided: string): void {
    this.ensurePlatformRegistrationEnabled();
    const expected = createHash('sha256')
      .update(process.env.PLATFORM_SIGNUP_SECRET as string)
      .digest();
    const received = createHash('sha256').update(provided).digest();
    if (!timingSafeEqual(expected, received)) {
      throw new Errors.ForbiddenError('Platform registration key is invalid');
    }
  }
}
