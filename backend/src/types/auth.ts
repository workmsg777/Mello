export const accountTypes = [
  'DATING_USER',
  'PARTNER_USER',
  'PLATFORM_USER',
] as const;

export type AccountType = (typeof accountTypes)[number];
export type ClientPlatform = 'ANDROID' | 'IOS' | 'WEB' | 'UNKNOWN';
export type OtpPurpose = 'SIGNUP' | 'LOGIN';

export interface DeviceInfo {
  deviceId?: string | undefined;
  deviceName?: string | undefined;
  platform?: ClientPlatform | undefined;
}

export interface PartnerSignupData {
  ownerName: string;
  businessName: string;
  category: 'CAFE' | 'HOTEL' | 'ACTIVITY' | 'OTHER';
  description?: string | undefined;
  addressLine1: string;
  addressLine2?: string | undefined;
  city: string;
  state: string;
  postalCode: string;
  countryCode: string;
  latitude?: number | undefined;
  longitude?: number | undefined;
  businessPhone?: string | undefined;
  businessEmail?: string | undefined;
}

export interface PlatformSignupData {
  name: string;
  registrationKey: string;
}

export interface AuthContext {
  accountId: string;
  accountType: AccountType;
  sessionId: string;
}

export interface RequestMetadata {
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  accessTokenExpiresIn: number;
  refreshTokenExpiresIn: number;
}
