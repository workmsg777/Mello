import axios from "axios";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { resolveApiBaseUrl } from "./api-url";
import {
  getPartnerSession,
  savePartnerSession,
  clearPartnerSession,
} from "../services/session.service";
import type { AuthTokens } from "../types/auth";

export const API_BASE_URL = resolveApiBaseUrl({
  configuredUrl: process.env.EXPO_PUBLIC_API_URL,
  platform: Platform.OS,
  isDevelopment: __DEV__,
  expoHostUri: Constants.expoConfig?.hostUri,
  browserHostname:
    typeof window !== "undefined" ? window.location?.hostname : undefined,
});

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15_000,
  headers: {
    "Content-Type": "application/json",
  },
});

let refresh: Promise<AuthTokens> | null = null;
let expired: (() => void) | undefined;
export function registerPartnerExpiryHandler(handler: () => void) {
  expired = handler;
  return () => {
    if (expired === handler) expired = undefined;
  };
}
api.interceptors.request.use(async (config) => {
  const session = await getPartnerSession();
  if (session)
    config.headers.Authorization = `Bearer ${session.tokens.accessToken}`;
  return config;
});
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const request = error.config;
    if (
      error.response?.status !== 401 ||
      !request ||
      request._retried ||
      (request.url?.startsWith("/auth/") && request.url !== "/auth/me")
    )
      throw error;
    request._retried = true;
    try {
      refresh ??= (async () => {
        const session = await getPartnerSession();
        if (!session) throw new Error("Please log in again");
        const response = await axios.post<AuthTokens>(
          `${API_BASE_URL}/auth/refresh`,
          { refreshToken: session.tokens.refreshToken },
          { timeout: 15000 },
        );
        await savePartnerSession({ ...session, tokens: response.data });
        return response.data;
      })().finally(() => {
        refresh = null;
      });
      const tokens = await refresh;
      request.headers.Authorization = `Bearer ${tokens.accessToken}`;
      return api(request);
    } catch (caught) {
      await clearPartnerSession();
      expired?.();
      throw caught;
    }
  },
);

export function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.msg;
    if (typeof message === "string" && message.trim()) return message;

    if (error.code === "ECONNABORTED") {
      return "The server took too long to respond. Please try again.";
    }

    if (!error.response) {
      return `Cannot reach ${API_BASE_URL}. Check your Wi-Fi and backend.`;
    }
  }

  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}
