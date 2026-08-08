import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { createApiClient, type StoredSession } from '@carpool/api-client';

/**
 * Same API client as the web applications. All business rules stay on the
 * server; this file only deals with the base URL and token storage.
 *
 * Android emulator reaches the host machine on 10.0.2.2; on a physical device
 * set apiUrl in app.json to your machine's LAN address.
 */
const extra = (Constants.expoConfig?.extra ?? {}) as { apiUrl?: string };
export const API_URL = extra.apiUrl ?? 'http://10.0.2.2:4000';

const STORAGE_KEY = 'ridesync.mobile.session';

let cached: StoredSession | null = null;
let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

export const sessionStore = {
  async read(): Promise<StoredSession | null> {
    if (cached) return cached;
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as StoredSession;
      if (parsed.expiresAt && new Date(parsed.expiresAt).getTime() < Date.now()) {
        await AsyncStorage.removeItem(STORAGE_KEY);
        return null;
      }
      cached = parsed;
      return parsed;
    } catch {
      return null;
    }
  },
  async write(session: StoredSession) {
    cached = session;
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  },
  async clear() {
    cached = null;
    await AsyncStorage.removeItem(STORAGE_KEY);
  },
};

export const api = createApiClient({
  baseUrl: API_URL,
  getToken: async () => (await sessionStore.read())?.token ?? null,
  onUnauthorized: () => {
    void sessionStore.clear();
    onUnauthorized?.();
  },
});
