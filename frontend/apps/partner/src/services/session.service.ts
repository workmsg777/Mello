import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import type { StoredSession } from "../types/auth";
const KEY = "mello.partner.session.v2";
let cached: StoredSession | null | undefined;
export async function getPartnerSession(): Promise<StoredSession | null> {
  if (cached !== undefined) return cached;
  const value =
    Platform.OS === "web"
      ? await AsyncStorage.getItem(KEY)
      : await SecureStore.getItemAsync(KEY);
  if (!value) return (cached = null);
  try {
    return (cached = JSON.parse(value) as StoredSession);
  } catch {
    await clearPartnerSession();
    return null;
  }
}
export async function savePartnerSession(session: StoredSession) {
  if (Platform.OS === "web")
    await AsyncStorage.setItem(KEY, JSON.stringify(session));
  else await SecureStore.setItemAsync(KEY, JSON.stringify(session));
  cached = session;
}
export async function clearPartnerSession() {
  cached = null;
  if (Platform.OS === "web") await AsyncStorage.removeItem(KEY);
  else await SecureStore.deleteItemAsync(KEY);
  await AsyncStorage.removeItem("@mello-partner/auth-session");
}
