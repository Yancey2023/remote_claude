import { create } from 'zustand';
import { WebSocketClient } from '../api/ws';
import { getConfig } from '../config';
import { translate } from '../i18n';
import { useDeviceStore } from './deviceStore';
import { useSessionStore } from './sessionStore';

interface TerminalState {
  sessionId: string | null;
  deviceId: string | null;
  connected: boolean;
  wsConnected: boolean;
  ws: WebSocketClient | null;
  error: string | null;
  connect: (deviceId: string, token: string, existingSessionId: string, cwd?: string, program?: string) => Promise<void>;
  sendCommand: (cmd: string) => void;
  sendRawInput: (data: string) => void;
  sendResize: (cols: number, rows: number) => void;
  disconnect: () => void;
  setWsConnected: (connected: boolean) => void;
}

export const useTerminalStore = create<TerminalState>((set, get) => ({
  sessionId: null,
  deviceId: null,
  connected: false,
  wsConnected: false,
  ws: null,
  error: null,

  connect: async (deviceId: string, token: string, existingSessionId: string, cwd?: string, program?: string) => {
    const prev = get();
    const existingWs = prev.ws;
    const sameDevice = !!existingWs && prev.deviceId === deviceId;

    const isNew = existingSessionId === 'new';

    // Fast path: switching sessions on the same device should reuse the WS connection.
    // This avoids full-page reconnect feel and only refreshes terminal content.
    if (sameDevice) {
      if (isNew) {
        existingWs!.send('create_session', { device_id: deviceId, cwd: cwd ?? null, program: program ?? null });
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
        // Router path sync is handled in TerminalPage via navigate(...),
        // so side bar active-state stays in sync with React Router.
        // Trigger PTY spawn without injecting visible input characters.
        const serverProgram = payload.program as string | undefined;
        ws.send('terminal_input', { session_id: sid, data: '', cwd: serverCwd ?? null, program: serverProgram ?? null });
      });

      // Handle errors
      const unsubErr = ws.on('error', (payload) => {
        const msg = payload.message as string;
        set({ error: `${translate('error')}: ${msg}` });
      });

      const unsubClosed = ws.on('session_closed', (payload) => {
        const sid = payload.session_id as string | undefined;
        if (sid) {
          useSessionStore.getState().removeSessionFromWs(sid);
          const state = get();
          if (state.sessionId === sid) {
            set({ connected: false, sessionId: null });
          }
        }
      });

      // Track device status — mark session disconnected when device goes offline,
      // update shared deviceStore, and auto-reconnect when device comes back online
      const unsubDeviceStatus = ws.on('device_status', (payload) => {
        const did = payload.device_id as string | undefined;
        const online = payload.online as boolean | undefined;
        if (!did || online === undefined) return;
        // Sync deviceStore for real-time indicator everywhere
        useDeviceStore.getState().updateDeviceStatus(did, online);
        const state = get();
        if (state.deviceId !== did) return;
        if (!online) {
          set({ connected: false });
        } else if (state.sessionId && !state.connected) {
          // Device came back online — re-attach session
          ws.send('attach_session', { session_id: state.sessionId });
          set({ connected: true });
        }
      });

      // Track session context for WS reconnect re-attachment
      let savedReconnect: { sessionId: string; deviceId: string; cwd?: string; program?: string } | null = null;

      ws.onStatus((connected) => {
        if (!connected) {
          const s = get();
          if (s.sessionId && s.deviceId) {
            savedReconnect = { sessionId: s.sessionId, deviceId: s.deviceId, cwd, program };
          }
        }
        if (connected && savedReconnect) {
          const ctx = savedReconnect;
          savedReconnect = null;
          // Check device status: if the device is known to be offline, don't
          // claim the session is connected until we get a device_status:online.
          const device = useDeviceStore.getState().devices.find(d => d.id === ctx.deviceId);
          const deviceOnline = device?.online ?? true; // assume online if unknown
          if (ctx.sessionId === 'new') {
            ws.send('create_session', { device_id: ctx.deviceId, cwd: ctx.cwd ?? null, program: ctx.program ?? null });
          } else {
            ws.send('attach_session', { session_id: ctx.sessionId });
            if (deviceOnline) {
              set({ sessionId: ctx.sessionId, connected: true });
            } else {
              // Device is offline — keep sessionId for re-attach later, but stay disconnected
              set({ sessionId: ctx.sessionId, connected: false });
            }
          }
        }
        set({ wsConnected: connected });
      });

      ws.connect(() => {
        if (isNew) {
          // Create session over WS
          ws.send('create_session', { device_id: deviceId, cwd: cwd ?? null, program: program ?? null });
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
        error: null,
      });
    } catch (e) {
      set({ error: translate('connectFailed') });
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
    });
  },

  setWsConnected: (connected: boolean) => {
    set({ wsConnected: connected });
  },
}));
