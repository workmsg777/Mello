import Errors from '../errors';
import { authConfig } from '../config/auth';

const E164_PATTERN = /^\+[1-9]\d{7,14}$/;

/** Normalizes local mobile numbers with the configured default country code. */
export function normalizePhoneNumber(value: string): string {
  const compact = value.trim().replace(/[\s().-]/g, '');
  const normalized = compact.startsWith('+')
    ? compact
    : `${authConfig.defaultPhoneCountryCode}${compact.replace(/^0+/, '')}`;

  if (!E164_PATTERN.test(normalized)) {
    throw new Errors.BadRequestError(
      'phone must be a valid mobile number in E.164 format',
    );
  }

  return normalized;
}
