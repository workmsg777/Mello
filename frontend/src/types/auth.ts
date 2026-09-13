export type AuthMode = 'signup' | 'login';

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

export interface AccountProfile {
  account: {
    id: string;
    accountType: 'DATING_USER';
    status: string;
  };
  profile: {
    userId?: string;
  };
}

export interface AuthenticationResponse extends AccountProfile {
  tokens: AuthTokens;
}

export interface StoredSession {
  tokens: AuthTokens;
  account: AccountProfile['account'];
  profile: AccountProfile['profile'];
}
