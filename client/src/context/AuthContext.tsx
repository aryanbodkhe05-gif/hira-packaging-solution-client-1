import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import * as auth from '../lib/auth';
import { setCurrentRole } from '../lib/roles';
import type { AuthUser } from '../types';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: false,
  login: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  // Auth lives in localStorage — resolve the session synchronously on first render.
  const [user, setUser] = useState<AuthUser | null>(() => {
    const u = auth.currentUser();
    setCurrentRole(u?.role ?? null);
    return u;
  });

  const apply = useCallback((u: AuthUser | null) => {
    setUser(u);
    setCurrentRole(u?.role ?? null);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    apply(auth.login(username, password));
  }, [apply]);

  const logout = useCallback(async () => {
    auth.logout();
    apply(null);
  }, [apply]);

  return (
    <AuthContext.Provider value={{ user, loading: false, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
