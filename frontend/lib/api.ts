import axios, { AxiosError } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || (typeof window !== 'undefined' ? window.location.origin : '');

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err: AxiosError) => {
    const original = err.config as typeof err.config & { _retry?: boolean };

    if (err.response?.status === 401 && !original._retry && typeof window !== 'undefined') {
      original._retry = true;
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          const { data } = await axios.post(`${API_URL}/api/auth/refresh`, {
            refreshToken,
          });
          localStorage.setItem('accessToken', data.accessToken);
          if (data.refreshToken) {
            localStorage.setItem('refreshToken', data.refreshToken);
          }
          if (original.headers) {
            original.headers.Authorization = `Bearer ${data.accessToken}`;
          }
          return api(original);
        } catch {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          window.location.href = '/login';
        }
      }
    }

    return Promise.reject(err);
  }
);

export interface User {
  id: string;
  email: string;
  isAdmin?: boolean;
}

export interface AuthResponse {
  user: User;
  encryptedMasterKey?: string;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}
