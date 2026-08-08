import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { USER_ROLE, type AuthSession, type AuthUser } from '@carpool/shared';
import { ApiError } from '@carpool/api-client';
import { api, sessionStore, setUnauthorizedHandler } from '../services/api';

interface AuthValue {
  user: AuthUser | null;
  ready: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
  }, []);

  // Re-verify the stored session with the server: status and role may have
  // changed while the app was closed.
  useEffect(() => {
    let alive = true;
    (async () => {
      const stored = await sessionStore.read();
      if (!stored) {
        if (alive) setReady(true);
        return;
      }
      try {
        const fresh = await api.auth.me();
        if (!alive) return;
        if (fresh.role !== USER_ROLE.EMPLOYEE) {
          await sessionStore.clear();
          setUser(null);
        } else {
          await sessionStore.write({ ...stored, user: fresh });
          setUser(fresh);
        }
      } catch {
        if (!alive) return;
        await sessionStore.clear();
        setUser(null);
      } finally {
        if (alive) setReady(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const adopt = useCallback(async (result: AuthSession) => {
    await sessionStore.write(result);
    setUser(result.user);
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const result = await api.auth.login({ email, password });
      if (result.user.role === USER_ROLE.ADMIN) {
        throw new ApiError(403, 'FORBIDDEN', 'Administrators use the web admin panel, not the mobile app.');
      }
      await adopt(result);
    },
    [adopt],
  );

  const refresh = useCallback(async () => {
    const stored = await sessionStore.read();
    if (!stored) return;
    const fresh = await api.auth.me();
    await sessionStore.write({ ...stored, user: fresh });
    setUser(fresh);
  }, []);

  const signOut = useCallback(async () => {
    await sessionStore.clear();
    setUser(null);
  }, []);

  const value = useMemo<AuthValue>(() => ({ user, ready, signIn, refresh, signOut }), [user, ready, signIn, refresh, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside an AuthProvider');
  return context;
}
