import { Platform } from "react-native";
import { api } from "../config/api";
import type {
  AccountProfile,
  AuthenticationResponse,
  AuthMode,
  OtpRequestResponse,
  StoredSession,
} from "../types/auth";
import { clearSession, getSession, saveSession } from "./session.service";

const device = {
  deviceName:
    Platform.OS === "android"
      ? "Android phone"
      : Platform.OS === "ios"
        ? "iPhone"
        : "Web browser",
  platform:
    Platform.OS === "android"
      ? ("ANDROID" as const)
      : Platform.OS === "ios"
        ? ("IOS" as const)
        : Platform.OS === "web"
          ? ("WEB" as const)
          : ("UNKNOWN" as const),
};

export async function requestOtp(
  phone: string,
  mode: AuthMode,
): Promise<OtpRequestResponse> {
  const endpoint =
    mode === "signup" ? "/auth/signup/request-otp" : "/auth/login/request-otp";
  const response = await api.post<OtpRequestResponse>(
    endpoint,
    mode === "signup" ? { phone, accountType: "DATING_USER" } : { phone },
  );
  return response.data;
}

export async function verifyOtp(
  phone: string,
  otp: string,
  mode: AuthMode,
): Promise<StoredSession> {
  const endpoint =
    mode === "signup" ? "/auth/signup/verify" : "/auth/login/verify";
  const body =
    mode === "signup"
      ? { phone, otp, accountType: "DATING_USER", device }
      : { phone, otp, device };
  const { data } = await api.post<AuthenticationResponse>(endpoint, body);
  const session = {
    tokens: data.tokens,
    account: data.account,
    profile: data.profile,
  };
  await saveSession(session);
  return session;
}

export async function restoreSession(): Promise<StoredSession | null> {
  const session = await getSession();
  if (!session) return null;
  try {
    const { data } = await api.get<AccountProfile>("/auth/me");
    const restored = {
      ...session,
      account: data.account,
      profile: data.profile,
    };
    await saveSession(restored);
    return restored;
  } catch {
    await clearSession();
    return null;
  }
}

export async function logout(): Promise<void> {
  const session = await getSession();
  try {
    if (session)
      await api.post("/auth/logout", {
        refreshToken: session.tokens.refreshToken,
      });
  } catch {
    // Local sign-out must still succeed when the API is offline.
  } finally {
    await clearSession();
  }
}
