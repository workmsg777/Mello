const positiveInteger = (
  value: string | undefined,
  fallback: number,
): number => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export const authConfig = {
  accessTokenTtlSeconds: positiveInteger(
    process.env.ACCESS_TOKEN_TTL_SECONDS,
    15 * 60,
  ),
  refreshTokenTtlSeconds: positiveInteger(
    process.env.REFRESH_TOKEN_TTL_SECONDS,
    30 * 24 * 60 * 60,
  ),
  otpTtlSeconds: positiveInteger(process.env.OTP_TTL_SECONDS, 5 * 60),
  otpCooldownSeconds: positiveInteger(process.env.OTP_COOLDOWN_SECONDS, 60),
  otpMaxAttempts: positiveInteger(process.env.OTP_MAX_ATTEMPTS, 5),
  defaultPhoneCountryCode:
    process.env.DEFAULT_PHONE_COUNTRY_CODE?.trim() || '+91',
  jwtIssuer: process.env.JWT_ISSUER?.trim() || 'mello-api',
  jwtAudience: process.env.JWT_AUDIENCE?.trim() || 'mello-clients',
  exposeOtpInResponse:
    process.env.NODE_ENV !== 'production' &&
    process.env.OTP_EXPOSE_IN_RESPONSE === 'true',
};

export function requireJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET must be configured');
  }
  if (process.env.NODE_ENV === 'production' && secret.length < 32) {
    throw new Error(
      'JWT_SECRET must contain at least 32 characters in production',
    );
  }
  return secret;
}

export function requireOtpHashSecret(): string {
  const secret = process.env.OTP_HASH_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('OTP_HASH_SECRET or JWT_SECRET must be configured');
  }
  if (process.env.NODE_ENV === 'production' && secret.length < 32) {
    throw new Error(
      'OTP_HASH_SECRET or JWT_SECRET must contain at least 32 characters in production',
    );
  }
  return secret;
}
