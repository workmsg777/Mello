import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import {
  clearSession,
  getSession,
  saveSession,
} from "../services/session.service";
import type { AuthTokens } from "../types/auth";

const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
export const API_BASE_URL = (
  configuredApiUrl || "http://localhost:4000/api"
).replace(/\/$/, "");
export const API_ORIGIN = API_BASE_URL.replace(/\/api$/, "");

export const api = axios.create({ baseURL: API_BASE_URL, timeout: 20_000 });

let refreshPromise: Promise<AuthTokens> | null = null;
let onSessionExpired: (() => void) | null = null;

export function registerSessionExpiredHandler(handler: () => void) {
  onSessionExpired = handler;
  return () => {
    if (onSessionExpired === handler) onSessionExpired = null;
  };
}

api.interceptors.request.use(async (config) => {
  const session = await getSession();
  if (session?.tokens.accessToken) {
    config.headers.Authorization = `Bearer ${session.tokens.accessToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const request = error.config as
      (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
    const isAuthEndpoint =
      request?.url === "/auth/refresh" ||
      request?.url === "/auth/logout" ||
      request?.url?.includes("/request-otp") ||
      request?.url?.includes("/verify");
    if (
      error.response?.status !== 401 ||
      !request ||
      request._retried ||
      isAuthEndpoint
    ) {
      return Promise.reject(error);
    }

    request._retried = true;
    try {
      refreshPromise ??= (async () => {
        const session = await getSession();
        if (!session) throw new Error("No session to refresh");
        const response = await axios.post<AuthTokens>(
          `${API_BASE_URL}/auth/refresh`,
          {
            refreshToken: session.tokens.refreshToken,
          },
        );
        await saveSession({ ...session, tokens: response.data });
        return response.data;
      })().finally(() => {
        refreshPromise = null;
      });
      const tokens = await refreshPromise;
      request.headers.Authorization = `Bearer ${tokens.accessToken}`;
      return api(request);
    } catch (refreshError) {
      await clearSession();
      onSessionExpired?.();
      return Promise.reject(refreshError);
    }
  },
);

export function absoluteMediaUrl(url: string | null): string | undefined {
  if (!url) return undefined;
  return /^https?:\/\//.test(url)
    ? url
    : `${API_ORIGIN}${url.startsWith("/") ? "" : "/"}${url}`;
}

export function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const body = error.response?.data as
      { msg?: unknown; message?: unknown } | undefined;
    const message = body?.msg ?? body?.message;
    if (typeof message === "string" && message.trim()) return message;
    if (error.code === "ECONNABORTED")
      return "The server took too long to respond. Please try again.";
    if (!error.response)
      return `Cannot reach ${API_BASE_URL}. Check the API URL and your Wi-Fi connection.`;
  }
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}
