import axios from 'axios';

const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

export const API_BASE_URL = (
  configuredApiUrl || 'http://localhost:4000/api'
).replace(/\/$/, '');

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15_000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.msg;
    if (typeof message === 'string' && message.trim()) return message;

    if (error.code === 'ECONNABORTED') {
      return 'The server took too long to respond. Please try again.';
    }

    if (!error.response) {
      return `Cannot reach ${API_BASE_URL}. Check your Wi-Fi and backend.`;
    }
  }

  return error instanceof Error
    ? error.message
    : 'Something went wrong. Please try again.';
}
