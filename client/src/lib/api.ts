import axios from 'axios';

export const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem('es_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

export type Role = 'ADMIN' | 'EXAMINER' | 'PROCTOR' | 'STUDENT';
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}
