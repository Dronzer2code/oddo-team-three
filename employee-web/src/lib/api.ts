import { createApiClient, createSessionStore } from '@carpool/api-client';

export const config = {
  apiUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:4000',
  webUrl: import.meta.env.VITE_WEB_URL ?? 'http://localhost:5173',
  adminUrl: import.meta.env.VITE_ADMIN_URL ?? 'http://localhost:5174',
};

/** Separate storage key from the admin panel — they share localhost. */
export const session = createSessionStore('ridesync.employee.session');

let onExpired: (() => void) | null = null;

export function setSessionExpiredHandler(handler: () => void) {
  onExpired = handler;
}

export const api = createApiClient({
  baseUrl: config.apiUrl,
  getToken: () => session.token(),
  onUnauthorized: () => {
    session.clear();
    onExpired?.();
  },
});
