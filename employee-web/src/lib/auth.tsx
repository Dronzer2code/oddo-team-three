import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ACCOUNT_STATUS, USER_ROLE, type AuthSession, type AuthUser } from '@carpool/shared';
import { ApiError } from '@carpool/api-client';
import { Splash } from '@carpool/ui';
import { api, config, session, setSessionExpiredHandler } from './api';

interface AuthContextValue {
  user: AuthUser | null;
  ready: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  adopt: (result: AuthSession) => void;
  refresh: () => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => session.read()?.user ?? null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setSessionExpiredHandler(() => setUser(null));
  }, []);

  useEffect(() => {
    let alive = true;
    const stored = session.read();
    if (!stored) {
      setReady(true);
      return;
    }
    api.auth
      .me()
      .then((fresh) => {
        if (!alive) return;
        if (fresh.role !== USER_ROLE.EMPLOYEE) {
          session.clear();
          setUser(null);
          return;
        }
        session.write({ ...stored, user: fresh });
        setUser(fresh);
      })
      .catch(() => {
        if (!alive) return;
        session.clear();
        setUser(null);
      })
      .finally(() => {
        if (alive) setReady(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const adopt = useCallback((result: AuthSession) => {
    session.write(result);
    setUser(result.user);
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const result = await api.auth.login({ email, password });
      if (result.user.role !== USER_ROLE.ADMIN) {
        adopt(result);
        return;
      }
      throw new ApiError(
        403,
        'FORBIDDEN',
        `This is the employee application. Administrators sign in at ${config.adminUrl}.`,
      );
    },
    [adopt],
  );

  const refresh = useCallback(async () => {
    const stored = session.read();
    if (!stored) return;
    const fresh = await api.auth.me();
    session.write({ ...stored, user: fresh });
    setUser(fresh);
  }, []);

  const signOut = useCallback(() => {
    session.clear();
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, ready, signIn, adopt, refresh, signOut }),
    [user, ready, signIn, adopt, refresh, signOut],
  );

  if (!ready) return <Splash label="RideSync" />;
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside an AuthProvider');
  return context;
}

/**
 * Protects the application shell. A signed-in employee whose profile is not yet
 * complete is sent through onboarding first — the backend also rejects
 * protected actions for pending accounts, so this is convenience, not security.
 */
export function RequireEmployee({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!user.profileComplete && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }
  return <>{children}</>;
}

export function isOperational(user: AuthUser | null): boolean {
  return user?.status === ACCOUNT_STATUS.ACTIVE;
}
