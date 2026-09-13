import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { api } from '../config/api';
import type {
  AccountProfile,
  AuthenticationResponse,
  AuthMode,
  OtpRequestResponse,
  StoredSession,
} from '../types/auth';

const SESSION_STORAGE_KEY = '@mello/auth-session';

const device = {
  deviceName: Platform.OS === 'android' ? 'Android phone' : 'Mobile device',
  platform:
    Platform.OS === 'android' ? ('ANDROID' as const) : ('UNKNOWN' as const),
};

export async function requestOtp(
  phone: string,
  mode: AuthMode,
): Promise<OtpRequestResponse> {
  const endpoint =
    mode === 'signup'
      ? '/auth/signup/request-otp'
      : '/auth/login/request-otp';
  const body =
    mode === 'signup'
      ? { phone, accountType: 'DATING_USER' as const }
      : { phone };

  const response = await api.post<OtpRequestResponse>(endpoint, body);
  return response.data;
}

export async function verifyOtp(
  phone: string,
  otp: string,
  mode: AuthMode,
): Promise<StoredSession> {
  const endpoint =
    mode === 'signup' ? '/auth/signup/verify' : '/auth/login/verify';
  const body =
    mode === 'signup'
      ? {
          phone,
          otp,
          accountType: 'DATING_USER' as const,
          device,
        }
      : { phone, otp, device };

  const response = await api.post<AuthenticationResponse>(endpoint, body);
  const session: StoredSession = {
    tokens: response.data.tokens,
    account: response.data.account,
    profile: response.data.profile,
  };
  await AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  return session;
}

export async function restoreSession(): Promise<StoredSession | null> {
  const stored = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
  if (!stored) return null;

  try {
    const session = JSON.parse(stored) as StoredSession;
    const response = await api.get<AccountProfile>('/auth/me', {
      headers: {
        Authorization: `Bearer ${session.tokens.accessToken}`,
      },
    });
    return {
      ...session,
      account: response.data.account,
      profile: response.data.profile,
    };
  } catch {
    await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
    return null;
  }
}

export async function logout(session: StoredSession): Promise<void> {
  try {
    await api.post('/auth/logout', {
      refreshToken: session.tokens.refreshToken,
    });
  } finally {
    await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
  }
}
