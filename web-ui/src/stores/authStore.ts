import { create } from 'zustand';
import { apiClient, ApiClientError } from '../api/client';
import { translate } from '../i18n';

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

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  loading: false,
  error: null,

  login: async (username: string, password: string) => {
    set({ loading: true, error: null });
    try {
      const res = await apiClient.login({ username, password });
      // Token kept in memory for WS auth; server also sets HttpOnly cookie for REST API
      set({
        token: res.token,
        user: { user_id: res.user_id, username: res.username, role: res.role },
        loading: false,
      });
    } catch (e) {
      const msg = e instanceof ApiClientError ? e.message : translate('loginFailed');
      set({ error: msg, loading: false });
      throw e;
    }
  },

  logout: () => {
    set({ token: null, user: null });
    apiClient.logout().catch(() => {});
  },

  checkAuth: async () => {
    try {
      const res = await apiClient.verify();
      // verify returns the JWT token as well (for WebSocket auth on page reload)
      set({
        token: res.token,
        user: { user_id: res.user_id, username: res.username, role: res.role },
      });
      return true;
    } catch {
      set({ token: null, user: null });
      return false;
    }
  },
}));
