import type {
  ApiResponse,
  AuditLogEntry,
  AuthSession,
  AuthUser,
  CostConfiguration,
  DashboardSummary,
  DriverRow,
  EmployeeDetail,
  EmployeeHomeData,
  EmployeeProfile,
  EmployeeSummary,
  Invitation,
  Organization,
  OrganizationSettings,
  Paginated,
  ParticipationReport,
  Payment,
  ReportsResponse,
  Ride,
  RideRequest,
  TrendPoint,
  Trip,
  Vehicle,
  VehicleDetail,
  WalletSummary,
} from '@carpool/shared';

/**
 * One API client for the admin panel, the employee web app and the mobile app.
 * Nothing in the platform talks to the backend any other way, so auth headers,
 * error shapes and session expiry are handled in exactly one place.
 */

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: Record<string, string> | unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /** Field-level errors from the server, keyed by field name. */
  get fieldErrors(): Record<string, string> {
    return (this.details && typeof this.details === 'object' ? this.details : {}) as Record<string, string>;
  }

  get isNetworkError(): boolean {
    return this.code === 'NETWORK_ERROR';
  }

  get isAuthError(): boolean {
    return this.status === 401;
  }
}

export interface ApiClientOptions {
  baseUrl: string;
  getToken?: () => string | null | Promise<string | null>;
  /** Called once when the server reports the session is no longer valid. */
  onUnauthorized?: () => void;
}

type Query = Record<string, string | number | boolean | null | undefined>;

function buildQuery(query?: Query): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }
  const serialised = params.toString();
  return serialised ? `?${serialised}` : '';
}

export function createApiClient(options: ApiClientOptions) {
  const baseUrl = options.baseUrl.replace(/\/$/, '');

  async function request<T>(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    path: string,
    init: { body?: unknown; query?: Query; skipAuth?: boolean } = {},
  ): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (init.body !== undefined) headers['Content-Type'] = 'application/json';

    if (!init.skipAuth && options.getToken) {
      const token = await options.getToken();
      if (token) headers.Authorization = `Bearer ${token}`;
    }

    let response: Response;
    try {
      response = await fetch(`${baseUrl}${path}${buildQuery(init.query)}`, {
        method,
        headers,
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      });
    } catch {
      throw new ApiError(0, 'NETWORK_ERROR', 'Connection unavailable. Check your internet connection and try again.');
    }

    let payload: ApiResponse<T> | null = null;
    try {
      payload = (await response.json()) as ApiResponse<T>;
    } catch {
      payload = null;
    }

    if (!response.ok || !payload || payload.success === false) {
      const error = payload && payload.success === false ? payload.error : null;
      if (response.status === 401) options.onUnauthorized?.();
      throw new ApiError(
        response.status,
        error?.code ?? 'INTERNAL_ERROR',
        error?.message ?? `Request failed with status ${response.status}`,
        error?.details,
      );
    }

    return payload.data;
  }

  return {
    request,

    /* ------------------------------------------------------------- auth */
    auth: {
      login: (body: { email: string; password: string }) =>
        request<AuthSession>('POST', '/api/auth/login', { body, skipAuth: true }),
      register: (body: {
        organizationSlug: string;
        name: string;
        email: string;
        password: string;
        phone?: string;
        employeeCode?: string;
        department?: string;
      }) => request<AuthSession>('POST', '/api/auth/register', { body, skipAuth: true }),
      previewInvitation: (token: string) =>
        request<{ email: string; name: string; department: string | null; organizationName: string; expiresAt: string }>(
          'GET',
          `/api/auth/invitations/${encodeURIComponent(token)}`,
          { skipAuth: true },
        ),
      acceptInvitation: (body: { token: string; password: string; name?: string; phone?: string }) =>
        request<AuthSession>('POST', '/api/auth/invitations/accept', { body, skipAuth: true }),
      me: () => request<AuthUser>('GET', '/api/auth/me'),
      changePassword: (body: { currentPassword: string; newPassword: string }) =>
        request<{ changed: boolean }>('POST', '/api/auth/change-password', { body }),
    },

    /* --------------------------------------------------------- employee */
    employee: {
      home: () => request<EmployeeHomeData>('GET', '/api/employee/home'),

      profile: {
        get: () => request<EmployeeProfile>('GET', '/api/employee/profile'),
        update: (body: Record<string, unknown>) =>
          request<EmployeeProfile>('PATCH', '/api/employee/profile', { body }),
      },

      vehicles: {
        list: () => request<Vehicle[]>('GET', '/api/employee/vehicles'),
        create: (body: Record<string, unknown>) => request<Vehicle>('POST', '/api/employee/vehicles', { body }),
        update: (id: string, body: Record<string, unknown>) =>
          request<Vehicle>('PATCH', `/api/employee/vehicles/${id}`, { body }),
        setStatus: (id: string, body: { status: string; reason?: string }) =>
          request<Vehicle>('POST', `/api/employee/vehicles/${id}/status`, { body }),
      },

      rides: {
        search: (query?: Query) => request<Paginated<Ride>>('GET', '/api/employee/rides', { query }),
        mine: () =>
          request<{ driving: Ride[]; riding: Ride[]; pendingIncomingRequests: number }>(
            'GET',
            '/api/employee/rides/mine',
          ),
        get: (id: string) => request<Ride>('GET', `/api/employee/rides/${id}`),
        publish: (body: Record<string, unknown>) => request<Ride>('POST', '/api/employee/rides', { body }),
        cancel: (id: string) => request<Ride>('POST', `/api/employee/rides/${id}/cancel`, { body: {} }),
        incomingRequests: () => request<RideRequest[]>('GET', '/api/employee/rides/requests/incoming'),
        requestSeat: (rideId: string, body: { seats: number; note?: string }) =>
          request<RideRequest>('POST', `/api/employee/rides/${rideId}/requests`, { body }),
        respond: (rideId: string, requestId: string, action: 'accept' | 'reject') =>
          request<Ride>('POST', `/api/employee/rides/${rideId}/requests/${requestId}/respond`, {
            body: { action },
          }),
        withdraw: (rideId: string, requestId: string) =>
          request<Ride>('POST', `/api/employee/rides/${rideId}/requests/${requestId}/cancel`, { body: {} }),
      },

      trips: {
        list: () => request<Trip[]>('GET', '/api/employee/trips'),
        active: () => request<Trip | null>('GET', '/api/employee/trips/active'),
        get: (id: string) => request<Trip>('GET', `/api/employee/trips/${id}`),
        start: (rideId: string) => request<Trip>('POST', '/api/employee/trips', { body: { rideId } }),
        complete: (id: string, distanceKm?: number) =>
          request<Trip>('POST', `/api/employee/trips/${id}/complete`, {
            body: distanceKm === undefined ? {} : { distanceKm },
          }),
        cancel: (id: string) => request<Trip>('POST', `/api/employee/trips/${id}/cancel`, { body: {} }),
      },

      payments: {
        wallet: () => request<WalletSummary>('GET', '/api/employee/payments'),
        settle: (id: string) => request<Payment>('POST', `/api/employee/payments/${id}/settle`, { body: {} }),
      },
    },

    /* ------------------------------------------------------------ admin */
    admin: {
      dashboard: {
        summary: () => request<DashboardSummary>('GET', '/api/admin/dashboard'),
        trend: () => request<TrendPoint[]>('GET', '/api/admin/dashboard/trend'),
        activity: () => request<AuditLogEntry[]>('GET', '/api/admin/dashboard/activity'),
      },

      employees: {
        list: (query?: Query) => request<Paginated<EmployeeSummary>>('GET', '/api/admin/employees', { query }),
        departments: () => request<string[]>('GET', '/api/admin/employees/departments'),
        get: (id: string) => request<EmployeeDetail>('GET', `/api/admin/employees/${id}`),
        auditLogs: (id: string) => request<AuditLogEntry[]>('GET', `/api/admin/employees/${id}/audit-logs`),
        setStatus: (id: string, body: { status: string; reason?: string }) =>
          request<EmployeeSummary>('POST', `/api/admin/employees/${id}/status`, { body }),
        update: (id: string, body: Record<string, unknown>) =>
          request<EmployeeSummary>('PATCH', `/api/admin/employees/${id}`, { body }),
      },

      invitations: {
        list: (query?: Query) =>
          request<Paginated<Invitation & { link: string }>>('GET', '/api/admin/invitations', { query }),
        create: (body: { email: string; name: string; employeeCode?: string; department?: string }) =>
          request<Invitation & { link: string }>('POST', '/api/admin/invitations', { body }),
        bulk: (invitations: Array<{ email: string; name: string; department?: string; employeeCode?: string }>) =>
          request<{ invited: number; failed: number; results: Array<{ email: string; ok: boolean; message?: string }> }>(
            'POST',
            '/api/admin/invitations/bulk',
            { body: { invitations } },
          ),
        resend: (id: string) =>
          request<Invitation & { link: string }>('POST', `/api/admin/invitations/${id}/resend`, { body: {} }),
        cancel: (id: string) => request<Invitation>('POST', `/api/admin/invitations/${id}/cancel`, { body: {} }),
      },

      vehicles: {
        list: (query?: Query) => request<Paginated<Vehicle>>('GET', '/api/admin/vehicles', { query }),
        get: (id: string) => request<VehicleDetail>('GET', `/api/admin/vehicles/${id}`),
        auditLogs: (id: string) => request<AuditLogEntry[]>('GET', `/api/admin/vehicles/${id}/audit-logs`),
        create: (body: Record<string, unknown>) => request<Vehicle>('POST', '/api/admin/vehicles', { body }),
        update: (id: string, body: Record<string, unknown>) =>
          request<Vehicle>('PATCH', `/api/admin/vehicles/${id}`, { body }),
        setStatus: (id: string, body: { status: string; reason?: string }) =>
          request<Vehicle>('POST', `/api/admin/vehicles/${id}/status`, { body }),
      },

      drivers: {
        list: (query?: Query) => request<Paginated<DriverRow>>('GET', '/api/admin/drivers', { query }),
      },

      organization: {
        get: () => request<{ organization: Organization; settings: OrganizationSettings }>('GET', '/api/admin/organization'),
        updateSettings: (body: Record<string, unknown>) =>
          request<{ organization: Organization; settings: OrganizationSettings }>(
            'PATCH',
            '/api/admin/organization/settings',
            { body },
          ),
      },

      costs: {
        list: () =>
          request<{
            configurations: CostConfiguration[];
            current: {
              fuelCostPerLitre: number;
              travelCostPerKm: number;
              mileageKmpl: number;
              currency: string;
              costConfigurationId: string | null;
            };
          }>('GET', '/api/admin/costs'),
        create: (body: Record<string, unknown>) => request<CostConfiguration>('POST', '/api/admin/costs', { body }),
        close: (id: string) => request<CostConfiguration>('POST', `/api/admin/costs/${id}/close`, { body: {} }),
      },

      participation: (query?: Query) => request<ParticipationReport>('GET', '/api/admin/participation', { query }),
      reports: (query?: Query) => request<ReportsResponse>('GET', '/api/admin/reports', { query }),

      auditLogs: {
        list: (query?: Query) => request<Paginated<AuditLogEntry>>('GET', '/api/admin/audit-logs', { query }),
        actions: () => request<string[]>('GET', '/api/admin/audit-logs/actions'),
      },
    },

    /* ----------------------------------------------------------- public */
    public: {
      contact: (body: { name: string; email: string; company: string; employees?: string; message: string }) =>
        request<{ received: boolean }>('POST', '/api/public/contact', { body, skipAuth: true }),
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;

/* -------------------------------------------------------------- session */

export interface StoredSession {
  token: string;
  expiresAt: string;
  user: AuthUser;
}

/**
 * Token storage. Kept here so the admin and employee apps cannot use different
 * storage keys and end up reading each other's sessions on localhost.
 */
export function createSessionStore(storageKey: string) {
  const read = (): StoredSession | null => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as StoredSession;
      if (!parsed?.token || !parsed?.user) return null;
      if (parsed.expiresAt && new Date(parsed.expiresAt).getTime() < Date.now()) {
        window.localStorage.removeItem(storageKey);
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  };

  return {
    read,
    write(session: StoredSession) {
      window.localStorage.setItem(storageKey, JSON.stringify(session));
    },
    clear() {
      window.localStorage.removeItem(storageKey);
    },
    token(): string | null {
      return read()?.token ?? null;
    },
  };
}
