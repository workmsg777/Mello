import { createHash, createHmac, randomBytes, randomInt } from 'node:crypto';
import { authConfig, requireOtpHashSecret } from '../../config/auth';
import { redis } from '../../config/redis';
import Errors from '../../errors';
import type { AccountType, OtpPurpose } from '../../types/auth';
import { OtpDeliveryService } from './otpDelivery.service';

const VERIFY_OTP_SCRIPT = `
local storedHash = redis.call('HGET', KEYS[1], 'hash')
if not storedHash then
  return 0
end

local storedAccountType = redis.call('HGET', KEYS[1], 'accountType') or ''
if ARGV[2] ~= '' and storedAccountType ~= ARGV[2] then
  return -2
end

if storedHash ~= ARGV[1] then
  local attempts = redis.call('HINCRBY', KEYS[1], 'attempts', 1)
  if attempts >= tonumber(ARGV[3]) then
    redis.call('DEL', KEYS[1])
  end
  return -1
end

return 1
`;

export interface OtpIssueResult {
  expiresIn: number;
  retryAfter: number;
  developmentOtp?: string;
}

export interface OtpVerificationLease {
  otpKey: string;
  lockKey: string;
  lockValue: string;
}

export class OtpService {
  constructor(private readonly deliveryService = new OtpDeliveryService()) {}

  async issue(
    purpose: OtpPurpose,
    phone: string,
    accountType?: AccountType,
  ): Promise<OtpIssueResult> {
    const otpKey = this.otpKey(purpose, phone);
    const cooldownKey = `${otpKey}:cooldown`;
    const cooldownCreated = await redis.set(
      cooldownKey,
      '1',
      'EX',
      authConfig.otpCooldownSeconds,
      'NX',
    );

    if (cooldownCreated !== 'OK') {
      const retryAfter = Math.max(await redis.ttl(cooldownKey), 1);
      throw new Errors.TooManyRequestsError(
        `Please wait ${retryAfter} seconds before requesting another OTP`,
      );
    }

    const otp = randomInt(100_000, 1_000_000).toString();
    const hash = this.hashOtp(purpose, phone, otp);

    await redis
      .multi()
      .hset(
        otpKey,
        'hash',
        hash,
        'accountType',
        accountType ?? '',
        'attempts',
        '0',
      )
      .expire(otpKey, authConfig.otpTtlSeconds)
      .exec();

    try {
      await this.deliveryService.send(phone, otp, purpose);
    } catch (error) {
      await redis.del(otpKey, cooldownKey);
      throw error;
    }

    return {
      expiresIn: authConfig.otpTtlSeconds,
      retryAfter: authConfig.otpCooldownSeconds,
      ...(authConfig.exposeOtpInResponse ? { developmentOtp: otp } : {}),
    };
  }

  async beginVerification(
    purpose: OtpPurpose,
    phone: string,
    otp: string,
    accountType?: AccountType,
  ): Promise<OtpVerificationLease> {
    const otpKey = this.otpKey(purpose, phone);
    const providedHash = this.hashOtp(purpose, phone, otp);
    const result = Number(
      await redis.eval(
        VERIFY_OTP_SCRIPT,
        1,
        otpKey,
        providedHash,
        accountType ?? '',
        authConfig.otpMaxAttempts.toString(),
      ),
    );

    if (result === 0) {
      throw new Errors.UnauthorizedError('OTP is expired or was not requested');
    }
    if (result === -2) {
      throw new Errors.UnauthorizedError(
        'OTP was requested for a different account type',
      );
    }
    if (result !== 1) {
      throw new Errors.UnauthorizedError('OTP is invalid');
    }

    const lockKey = `${otpKey}:verification-lock`;
    const lockValue = randomBytes(24).toString('base64url');
    const locked = await redis.set(
      lockKey,
      lockValue,
      'EX',
      Math.min(authConfig.otpTtlSeconds, 120),
      'NX',
    );

    if (locked !== 'OK') {
      throw new Errors.TooManyRequestsError(
        'This OTP verification is already in progress',
      );
    }

    return { otpKey, lockKey, lockValue };
  }

  async consume(lease: OtpVerificationLease): Promise<void> {
    const consumed = Number(
      await redis.eval(
        `
      if redis.call('GET', KEYS[2]) == ARGV[1] then
        redis.call('DEL', KEYS[1])
        redis.call('DEL', KEYS[2])
        redis.call('DEL', KEYS[1] .. ':cooldown')
        return 1
      end
      return 0
      `,
        2,
        lease.otpKey,
        lease.lockKey,
        lease.lockValue,
      ),
    );
    if (consumed !== 1) {
      throw new Errors.SystemError('Unable to finalize OTP verification');
    }
  }

  async release(lease: OtpVerificationLease): Promise<void> {
    await redis.eval(
      `
      if redis.call('GET', KEYS[1]) == ARGV[1] then
        return redis.call('DEL', KEYS[1])
      end
      return 0
      `,
      1,
      lease.lockKey,
      lease.lockValue,
    );
  }

  private otpKey(purpose: OtpPurpose, phone: string): string {
    const phoneKey = createHash('sha256').update(phone).digest('hex');
    return `mello:auth:otp:${purpose.toLowerCase()}:${phoneKey}`;
  }

  private hashOtp(purpose: OtpPurpose, phone: string, otp: string): string {
    return createHmac('sha256', requireOtpHashSecret())
      .update(`${purpose}:${phone}:${otp}`)
      .digest('hex');
  }
}
