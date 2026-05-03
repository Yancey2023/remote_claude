import { create } from 'zustand';
import { WebSocketClient } from '../api/ws';
import { getConfig } from '../config';
import { translate } from '../i18n';
import { useSessionStore } from './sessionStore';

interface TerminalState {
  sessionId: string | null;
  deviceId: string | null;
  connected: boolean;
  wsConnected: boolean;
  ws: WebSocketClient | null;
  output: string;
  error: string | null;
  connect: (deviceId: string, token: string, existingSessionId: string, cwd?: string) => Promise<void>;
  sendCommand: (cmd: string) => void;
  sendRawInput: (data: string) => void;
  sendResize: (cols: number, rows: number) => void;
  disconnect: () => void;
  appendOutput: (chunk: string) => void;
  setWsConnected: (connected: boolean) => void;
}

export const useTerminalStore = create<TerminalState>((set, get) => ({
  sessionId: null,
  deviceId: null,
  connected: false,
  wsConnected: false,
  ws: null,
  output: '',
  error: null,

  connect: async (deviceId: string, token: string, existingSessionId: string, cwd?: string) => {
    const prev = get();
    const existingWs = prev.ws;
    const sameDevice = !!existingWs && prev.deviceId === deviceId;

    const isNew = existingSessionId === 'new';

    // Fast path: switching sessions on the same device should reuse the WS connection.
    // This avoids full-page reconnect feel and only refreshes terminal content.
    if (sameDevice) {
      if (isNew) {
        existingWs!.send('create_session', { device_id: deviceId, cwd: cwd ?? null });
        set({ sessionId: null, connected: false, error: null });
      } else {
        existingWs!.send('attach_session', { session_id: existingSessionId });
        set({ sessionId: existingSessionId, connected: true, error: null });
      }
      return;
    }

    if (existingWs) {
      existingWs.disconnect();
    }

    try {
      const cfg = getConfig();
      const wsUrl = cfg.wsBaseUrl || (
        import.meta.env.DEV && ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname)
          ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.hostname}:8080/ws/web`
          : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/web`
      );
      const ws = new WebSocketClient(wsUrl, token);

      // Handle session creation from server
      const unsubCreated = ws.on('session_created', (payload) => {
        const sid = payload.session_id as string;
        const createdDeviceId = payload.device_id as string | undefined;
        const serverCwd = payload.cwd as string | undefined;
        // Keep sidebar session list in sync immediately.
        useSessionStore.getState().addSessionFromWs({
          session_id: sid,
          device_id: createdDeviceId ?? deviceId,
          cwd: serverCwd,
        });
        set({ sessionId: sid, connected: true });
        // Navigate to the real session URL
        const qs = serverCwd ? `?cwd=${encodeURIComponent(serverCwd)}` : '';
        window.history.replaceState(null, '', `/devices/${deviceId}/sessions/${sid}${qs}`);
        // Trigger PTY spawn with \r
        ws.send('terminal_input', { session_id: sid, data: '\r', cwd: serverCwd ?? null });
      });

      // Handle errors
      const unsubErr = ws.on('error', (payload) => {
        const msg = payload.message as string;
        set({ error: msg });
      });

      ws.onStatus((connected) => {
        set({ wsConnected: connected });
      });

      ws.connect(() => {
        if (isNew) {
          // Create session over WS
          ws.send('create_session', { device_id: deviceId, cwd: cwd ?? null });
        } else {
          // Reconnect to existing session
          ws.send('attach_session', { session_id: existingSessionId });
          set({ sessionId: existingSessionId, connected: true });
        }
      });

      set({
        ws,
        deviceId,
        wsConnected: false,
        connected: false,
        output: '',
        error: null,
      });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : translate('connectFailed') });
    }
  },

  sendCommand: (cmd: string) => {
    const { ws, sessionId, connected } = get();
    if (!ws || !sessionId || !connected) return;
    ws.send('command', { session_id: sessionId, command: cmd });
  },

  sendRawInput: (data: string) => {
    const { ws, sessionId, connected } = get();
    if (!ws || !sessionId || !connected) return;
    ws.send('terminal_input', { session_id: sessionId, data, cwd: null });
  },

  sendResize: (cols: number, rows: number) => {
    const { ws, sessionId, connected } = get();
    if (!ws || !sessionId || !connected) return;
    ws.send('terminal_resize', { session_id: sessionId, cols, rows });
  },

  disconnect: () => {
    const { ws } = get();
    // Don't close session via REST — sessions persist
    ws?.disconnect();
    set({
      sessionId: null,
      deviceId: null,
      connected: false,
      wsConnected: false,
      ws: null,
      output: '',
    });
  },

  appendOutput: (chunk: string) => {
    set((s) => ({ output: s.output + chunk }));
  },

  setWsConnected: (connected: boolean) => {
    set({ wsConnected: connected });
  },
}));
