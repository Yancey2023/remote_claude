import { create } from 'zustand';
import { apiClient } from '../api/client';
import type { SessionInfo } from '../types/protocol';
import { translate } from '../i18n';

interface SessionState {
  sessions: SessionInfo[];
  loading: boolean;
  error: string | null;
  fetchSessions: () => Promise<void>;
  createSession: (deviceId: string, cwd?: string) => Promise<SessionInfo | null>;
  deleteSession: (sessionId: string) => Promise<void>;
  addSessionFromWs: (info: { session_id: string; device_id: string; cwd?: string }) => void;
  removeSessionFromWs: (sessionId: string) => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: [],
  loading: false,
  error: null,

  fetchSessions: async () => {
    set((s) => ({ loading: s.sessions.length === 0, error: null }));
    try {
      const sessions = await apiClient.listSessions();
      set({ sessions, loading: false });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : translate('fetchSessionsFailed'), loading: false });
    }
  },

  createSession: async (deviceId: string, cwd?: string) => {
    set({ error: null });
    try {
      const res = await apiClient.createSession(deviceId, cwd);
      // Refresh list to include the new session
      const sessions = await apiClient.listSessions();
      set({ sessions });
      return sessions.find((s) => s.id === res.session_id) || null;
    } catch (e) {
      set({ error: e instanceof Error ? e.message : translate('createSessionFailed') });
      return null;
    }
  },

  deleteSession: async (sessionId: string) => {
    set({ error: null });
    try {
      await apiClient.closeSession(sessionId);
      const sessions = get().sessions.filter((s) => s.id !== sessionId);
      set({ sessions });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : translate('deleteSessionFailed') });
    }
  },

  addSessionFromWs: (info) => {
    const existing = get().sessions.find((s) => s.id === info.session_id);
    if (existing) return;
    const newSession: SessionInfo = {
      id: info.session_id,
      device_id: info.device_id,
      user_id: '',
      created_at: Date.now() / 1000,
      cwd: info.cwd ?? null,
    };
    set({ sessions: [...get().sessions, newSession] });
  },

  removeSessionFromWs: (sessionId: string) => {
    set({ sessions: get().sessions.filter((s) => s.id !== sessionId) });
  },
}));
