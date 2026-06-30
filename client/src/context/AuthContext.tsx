import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import api from '../lib/api';
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
  loading: true,
  login: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const apply = useCallback((u: AuthUser | null) => {
    setUser(u);
    setCurrentRole(u?.role ?? null);
  }, []);

  // On load, ask the server who we are (the httpOnly cookie travels automatically).
  useEffect(() => {
    let alive = true;
    api.get('/auth/me')
      .then((res) => { if (alive) apply(res.data.user); })
      .catch(() => { if (alive) apply(null); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [apply]);

  const login = useCallback(async (username: string, password: string) => {
    const res = await api.post('/auth/login', { username, password });
    apply(res.data.user);
  }, [apply]);

  const logout = useCallback(async () => {
    try { await api.post('/auth/logout'); } finally { apply(null); }
  }, [apply]);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
