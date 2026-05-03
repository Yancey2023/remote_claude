import { create } from 'zustand';
import { apiClient } from '../api/client';
import { WebSocketClient } from '../api/ws';
import { getConfig } from '../config';

interface TerminalState {
  sessionId: string | null;
  deviceId: string | null;
  connected: boolean;
  wsConnected: boolean;
  ws: WebSocketClient | null;
  output: string;
  error: string | null;
  connect: (deviceId: string, token: string, existingSessionId?: string) => Promise<void>;
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

  connect: async (deviceId: string, token: string, existingSessionId?: string) => {
    const existingWs = get().ws;
    if (existingWs) {
      existingWs.disconnect();
    }

    try {
      const cfg = getConfig();
      const wsUrl = cfg.wsBaseUrl || `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/web`;
      const ws = new WebSocketClient(wsUrl, token);

      if (existingSessionId) {
        // Reconnecting to an existing session — set sessionId immediately
        set({ sessionId: existingSessionId });

        // When connected, we just need to connect WS (PTY is already running)
        // The result_chunk messages for this session will start flowing
        ws.on('session_created', (_payload) => {
          // Ignore — we already have a session
        });
      } else {
        // New session — wait for server to create it
        const unsub = ws.on('session_created', (payload) => {
          const sid = payload.session_id as string;
          const cwd = payload.cwd as string | undefined;
          set({ sessionId: sid, connected: true });
          // Trigger PTY spawn with cwd, then send Enter to start claude
          ws.send('terminal_input', { session_id: sid, data: '\r', cwd: cwd ?? null });
        });
      }

      // Handle errors
      const unsubErr = ws.on('error', (payload) => {
        const msg = payload.message as string;
        set({ error: msg });
      });

      ws.onStatus((connected) => {
        set({ wsConnected: connected });
        if (!connected) {
          // Auto-retry: user will see connection overlay
        }
      });

      // Connect and send create_session or just connect
      ws.connect(() => {
        if (existingSessionId) {
          // Reconnecting to existing session — set connected immediately
          set({ connected: true });
          // Send empty input to wake up any pending reads
          ws.send('terminal_input', { session_id: existingSessionId, data: '', cwd: null });
        } else {
          ws.send('create_session', { device_id: deviceId });
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
      set({ error: e instanceof Error ? e.message : 'failed to connect' });
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
    ws.send('terminal_input', { session_id: sessionId, data });
  },

  sendResize: (cols: number, rows: number) => {
    const { ws, sessionId, connected } = get();
    if (!ws || !sessionId || !connected) return;
    ws.send('terminal_resize', { session_id: sessionId, cols, rows });
  },

  disconnect: () => {
    const { ws, sessionId } = get();
    if (sessionId) {
      apiClient.closeSession(sessionId).catch(() => {});
    }
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
