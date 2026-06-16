import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api, AuthUser } from '../lib/api';

interface AuthCtx {
  user: AuthUser | null;
  login: (email: string, password: string, mode?: 'ONLINE' | 'OFFLINE') => Promise<AuthUser>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem('es_user');
    if (raw) setUser(JSON.parse(raw));
  }, []);

  async function login(email: string, password: string, mode?: 'ONLINE' | 'OFFLINE') {
    const { data } = await api.post('/auth/login', { email, password, mode });
    localStorage.setItem('es_token', data.token);
    localStorage.setItem('es_user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user as AuthUser;
  }

  function logout() {
    localStorage.removeItem('es_token');
    localStorage.removeItem('es_user');
    setUser(null);
  }

  return <Ctx.Provider value={{ user, login, logout }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
