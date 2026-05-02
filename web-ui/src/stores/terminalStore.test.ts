import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useTerminalStore } from './terminalStore';

const mockCreateSession = vi.fn();
const mockCloseSession = vi.fn().mockResolvedValue(undefined);

vi.mock('../api/client', () => ({
  apiClient: {
    createSession: (...args: unknown[]) => mockCreateSession(...args),
    closeSession: (...args: unknown[]) => mockCloseSession(...args),
  },
}));

// We can't easily mock the WebSocketClient constructor from ws.ts,
// so we test the store's synchronous actions and state transitions.

beforeEach(() => {
  useTerminalStore.setState({
    sessionId: null,
    deviceId: null,
    connected: false,
    wsConnected: false,
    ws: null,
    output: '',
    error: null,
  });
});

describe('terminalStore', () => {
  it('starts disconnected', () => {
    const s = useTerminalStore.getState();
    expect(s.sessionId).toBeNull();
    expect(s.deviceId).toBeNull();
    expect(s.connected).toBe(false);
    expect(s.output).toBe('');
  });

  it('appends output chunks', () => {
    useTerminalStore.getState().appendOutput('hello ');
    expect(useTerminalStore.getState().output).toBe('hello ');

    useTerminalStore.getState().appendOutput('world');
    expect(useTerminalStore.getState().output).toBe('hello world');
  });

  it('toggles wsConnected state', () => {
    useTerminalStore.getState().setWsConnected(true);
    expect(useTerminalStore.getState().wsConnected).toBe(true);

    useTerminalStore.getState().setWsConnected(false);
    expect(useTerminalStore.getState().wsConnected).toBe(false);
  });

  it('clears state on disconnect', () => {
    useTerminalStore.setState({
      sessionId: 's1',
      deviceId: 'd1',
      connected: true,
      wsConnected: true,
      output: 'some output',
    });

    useTerminalStore.getState().disconnect();

    const s = useTerminalStore.getState();
    expect(s.sessionId).toBeNull();
    expect(s.deviceId).toBeNull();
    expect(s.connected).toBe(false);
    expect(s.output).toBe('');
  });

  it('sendCommand does nothing when not connected', () => {
    // Should not throw when no session
    expect(() => useTerminalStore.getState().sendCommand('test')).not.toThrow();
  });

  it('sets error when createSession API fails', async () => {
    mockCreateSession.mockRejectedValueOnce(new Error('device offline'));

    // connect will catch the error and set it in state
    // but since we mock the api module, the ws import inside terminalStore
    // still needs to resolve. We use a try/catch approach.
    try {
      await useTerminalStore.getState().connect('d1', 'fake-token');
    } catch {
      // expected
    }

    // After error, state should reflect the failure
    const s = useTerminalStore.getState();
    expect(s.error).toBeTruthy();
  });
});
