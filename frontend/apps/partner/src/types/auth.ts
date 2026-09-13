export type AuthMode = 'signup' | 'login';

export type PartnerCategory = 'CAFE' | 'HOTEL' | 'ACTIVITY' | 'OTHER';

export interface PartnerSignupData {
  ownerName: string;
  businessName: string;
  category: PartnerCategory;
  description?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  countryCode: string;
  businessEmail?: string;
}

export interface OtpRequestResponse {
  message: string;
  expiresIn: number;
  retryAfter: number;
  developmentOtp?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  accessTokenExpiresIn: number;
  refreshTokenExpiresIn: number;
}

export interface PartnerProfile {
  partnerUserId?: string;
  name?: string;
  staffRole?: string;
  partner?: {
    id?: string;
    name?: string;
    category?: PartnerCategory;
    city?: string;
    state?: string;
    status?: string;
  };
}

export interface AccountProfile {
  account: {
    id: string;
    accountType: 'DATING_USER' | 'PARTNER_USER' | 'PLATFORM_USER';
    status: string;
  };
  profile: PartnerProfile;
}

export interface AuthenticationResponse extends AccountProfile {
  tokens: AuthTokens;
}

export interface StoredSession {
  tokens: AuthTokens;
  account: AccountProfile['account'] & { accountType: 'PARTNER_USER' };
  profile: PartnerProfile;
}
