import { create } from 'zustand';
import { apiClient, ApiClientError } from '../api/client';

interface User {
  user_id: string;
  username: string;
  role: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<boolean>;
}

const storedToken = localStorage.getItem('token');
if (storedToken) {
  apiClient.setToken(storedToken);
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: storedToken,
  user: null,
  loading: false,
  error: null,

  login: async (username: string, password: string) => {
    set({ loading: true, error: null });
    try {
      const res = await apiClient.login({ username, password });
      apiClient.setToken(res.token);
      localStorage.setItem('token', res.token);
      set({
        token: res.token,
        user: { user_id: res.user_id, username: res.username, role: res.role },
        loading: false,
      });
    } catch (e) {
      const msg = e instanceof ApiClientError ? e.message : 'login failed';
      set({ error: msg, loading: false });
      throw e;
    }
  },

  logout: () => {
    apiClient.setToken(null);
    localStorage.removeItem('token');
    apiClient.logout().catch(() => {});
    set({ token: null, user: null });
  },

  checkAuth: async () => {
    const token = get().token;
    if (!token) return false;
    apiClient.setToken(token);
    try {
      const res = await apiClient.verify();
      set({ user: { user_id: res.user_id, username: res.username, role: res.role } });
      return true;
    } catch {
      get().logout();
      return false;
    }
  },
}));
