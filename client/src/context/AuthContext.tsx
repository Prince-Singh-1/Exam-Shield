import { createContext, useContext, useState, ReactNode } from 'react';
import { api, AuthUser, Role } from '../lib/api';

interface AuthCtx {
  user: AuthUser | null;
  login: (email: string, password: string, mode?: 'ONLINE' | 'OFFLINE') => Promise<AuthUser>;
  register: (input: { name: string; email: string; password: string; role: Role }) => Promise<AuthUser>;
  googleLogin: (credential: string, role: Role) => Promise<AuthUser>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const raw = localStorage.getItem('es_user');
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AuthUser;
    } catch {
      localStorage.removeItem('es_user');
      localStorage.removeItem('es_token');
      return null;
    }
  });

  async function login(email: string, password: string, mode?: 'ONLINE' | 'OFFLINE') {
    const { data } = await api.post('/auth/login', { email, password, mode });
    localStorage.setItem('es_token', data.token);
    localStorage.setItem('es_user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user as AuthUser;
  }

  // Register a new account, then immediately sign in so the user lands authenticated.
  async function register(input: { name: string; email: string; password: string; role: Role }) {
    await api.post('/auth/register', input);
    return login(input.email, input.password);
  }

  async function googleLogin(credential: string, role: Role) {
    const { data } = await api.post('/auth/google', { credential, role });
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

  return <Ctx.Provider value={{ user, login, register, googleLogin, logout }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
