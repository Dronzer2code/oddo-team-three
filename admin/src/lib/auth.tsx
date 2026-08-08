import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { USER_ROLE, type AuthUser } from '@carpool/shared';
import { ApiError } from '@carpool/api-client';
import { Splash } from '@carpool/ui';
import { api, session, setSessionExpiredHandler } from './api';

interface AuthContextValue {
  user: AuthUser | null;
  ready: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => session.read()?.user ?? null);
  const [ready, setReady] = useState(false);

  const signOut = useCallback(() => {
    session.clear();
    setUser(null);
  }, []);

  useEffect(() => {
    setSessionExpiredHandler(() => setUser(null));
  }, []);

  // Re-verify the stored session against the server on boot: role, status and
  // organization can all have changed since the token was issued.
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
        if (fresh.role !== USER_ROLE.ADMIN) {
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

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await api.auth.login({ email, password });
    if (result.user.role !== USER_ROLE.ADMIN) {
      // Employees have their own application; do not silently sign them in here.
      throw new ApiError(
        403,
        'FORBIDDEN',
        'This is the administrator panel. Use the employee application to sign in as an employee.',
      );
    }
    session.write(result);
    setUser(result.user);
  }, []);

  const value = useMemo<AuthContextValue>(() => ({ user, ready, signIn, signOut }), [user, ready, signIn, signOut]);

  if (!ready) return <Splash label="RideSync Admin" />;
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside an AuthProvider');
  return context;
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}
