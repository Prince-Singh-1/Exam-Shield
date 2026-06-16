import axios from 'axios';

// In production set VITE_API_URL to the deployed backend, e.g.
//   https://exam-shield-api.onrender.com/api
// In local dev it falls back to the Vite proxy at /api.
export const API_BASE = import.meta.env.VITE_API_URL || '/api';
// Origin of the backend (without the /api suffix) — used for static capture images.
export const API_ORIGIN = API_BASE.replace(/\/api\/?$/, '');

export const api = axios.create({ baseURL: API_BASE });

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
