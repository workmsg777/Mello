import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { api } from '../config/api';
import type {
  AccountProfile,
  AuthenticationResponse,
  AuthMode,
  OtpRequestResponse,
  PartnerSignupData,
  StoredSession,
} from '../types/auth';

const SESSION_STORAGE_KEY = '@mello-partner/auth-session';

const device = {
  deviceName: Platform.OS === 'android' ? 'Partner Android phone' : 'Partner mobile device',
  platform: Platform.OS === 'android' ? ('ANDROID' as const) : ('UNKNOWN' as const),
};

export async function requestOtp(
  phone: string,
  mode: AuthMode,
): Promise<OtpRequestResponse> {
  const endpoint =
    mode === 'signup'
      ? '/auth/signup/request-otp'
      : '/auth/login/request-otp';
  const body = mode === 'signup' ? { phone, accountType: 'PARTNER_USER' } : { phone };
  const response = await api.post<OtpRequestResponse>(endpoint, body);
  return response.data;
}

async function revokeWrongAppSession(
  response: AuthenticationResponse,
): Promise<never> {
  await api
    .post('/auth/logout', { refreshToken: response.tokens.refreshToken })
    .catch(() => undefined);
  throw new Error('This mobile number is not registered as a partner account.');
}

export async function verifyOtp(
  phone: string,
  otp: string,
  mode: AuthMode,
  partner?: PartnerSignupData,
): Promise<StoredSession> {
  const endpoint = mode === 'signup' ? '/auth/signup/verify' : '/auth/login/verify';
  const partnerPayload = partner
    ? {
        ownerName: partner.ownerName.trim(),
        businessName: partner.businessName.trim(),
        category: partner.category,
        addressLine1: partner.addressLine1.trim(),
        city: partner.city.trim(),
        state: partner.state.trim(),
        postalCode: partner.postalCode.trim(),
        countryCode: partner.countryCode,
        ...(partner.description?.trim()
          ? { description: partner.description.trim() }
          : {}),
        ...(partner.addressLine2?.trim()
          ? { addressLine2: partner.addressLine2.trim() }
          : {}),
        ...(partner.businessEmail?.trim()
          ? { businessEmail: partner.businessEmail.trim().toLowerCase() }
          : {}),
      }
    : undefined;
  const body =
    mode === 'signup'
      ? { phone, otp, accountType: 'PARTNER_USER', partner: partnerPayload, device }
      : { phone, otp, device };

  const response = await api.post<AuthenticationResponse>(endpoint, body);
  if (response.data.account.accountType !== 'PARTNER_USER') {
    return revokeWrongAppSession(response.data);
  }

  const session = response.data as StoredSession;
  await AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  return session;
}

export async function restoreSession(): Promise<StoredSession | null> {
  const stored = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
  if (!stored) return null;

  try {
    const session = JSON.parse(stored) as StoredSession;
    if (session.account.accountType !== 'PARTNER_USER') {
      await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }
    const response = await api.get<AccountProfile>('/auth/me', {
      headers: { Authorization: `Bearer ${session.tokens.accessToken}` },
    });
    if (response.data.account.accountType !== 'PARTNER_USER') {
      await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }
    return {
      tokens: session.tokens,
      account: response.data.account as StoredSession['account'],
      profile: response.data.profile,
    };
  } catch {
    await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
    return null;
  }
}

export async function logout(session: StoredSession): Promise<void> {
  try {
    await api.post('/auth/logout', { refreshToken: session.tokens.refreshToken });
  } finally {
    await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
  }
}
