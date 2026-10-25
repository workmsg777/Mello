import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import type { StoredSession } from "../types/auth";

const SESSION_KEY = "mello.auth.session.v1";
let cachedSession: StoredSession | null | undefined;

async function readValue(): Promise<string | null> {
  return Platform.OS === "web"
    ? AsyncStorage.getItem(SESSION_KEY)
    : SecureStore.getItemAsync(SESSION_KEY);
}

async function writeValue(value: string): Promise<void> {
  if (Platform.OS === "web") await AsyncStorage.setItem(SESSION_KEY, value);
  else await SecureStore.setItemAsync(SESSION_KEY, value);
}

async function deleteValue(): Promise<void> {
  if (Platform.OS === "web") await AsyncStorage.removeItem(SESSION_KEY);
  else await SecureStore.deleteItemAsync(SESSION_KEY);
}

export async function getSession(): Promise<StoredSession | null> {
  if (cachedSession !== undefined) return cachedSession;
  const value = await readValue();
  if (!value) return (cachedSession = null);
  try {
    return (cachedSession = JSON.parse(value) as StoredSession);
  } catch {
    await deleteValue();
    return (cachedSession = null);
  }
}

export async function saveSession(session: StoredSession): Promise<void> {
  cachedSession = session;
  await writeValue(JSON.stringify(session));
}

export async function clearSession(): Promise<void> {
  cachedSession = null;
  await deleteValue();
}
