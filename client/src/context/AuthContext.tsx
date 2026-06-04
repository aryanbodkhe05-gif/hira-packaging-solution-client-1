import { createContext, useContext, ReactNode } from 'react';
import type { User } from '../types';

interface AuthContextValue {
  user: User;
  token: null;
  login: () => void;
  logout: () => void;
  loading: false;
}

const OWNER: User = {
  id: '1',
  name: 'Owner',
  email: 'owner@packflow.in',
  role: 'OWNER',
};

const AuthContext = createContext<AuthContextValue>({
  user: OWNER,
  token: null,
  login: () => {},
  logout: () => {},
  loading: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <AuthContext.Provider value={{ user: OWNER, token: null, login: () => {}, logout: () => {}, loading: false }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
