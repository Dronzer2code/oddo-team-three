import { createApiClient } from '@carpool/api-client';

export const config = {
  apiUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:4000',
  adminUrl: import.meta.env.VITE_ADMIN_URL ?? 'http://localhost:5174',
  employeeUrl: import.meta.env.VITE_EMPLOYEE_URL ?? 'http://localhost:5175',
};

/** The public site only ever calls unauthenticated endpoints. */
export const api = createApiClient({ baseUrl: config.apiUrl });
