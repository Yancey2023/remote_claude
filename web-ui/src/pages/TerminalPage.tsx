import { useCallback, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTerminalStore } from '../stores/terminalStore';
import { useAuthStore } from '../stores/authStore';
import { useDeviceStore } from '../stores/deviceStore';
import { Terminal, getTerminal } from '../components/Terminal';
import { showToast } from '../components/Toast';

export function TerminalPage() {
  const { id: deviceId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);
  const devices = useDeviceStore((s) => s.devices);
  const device = devices.find((d) => d.id === deviceId);
  const store = useTerminalStore();
  const { connect, sendCommand, disconnect, connected, ws, output } = store;
  const initRef = useRef(false);

  // Connection setup
  useEffect(() => {
    if (!deviceId || !token || initRef.current) return;
    initRef.current = true;

    connect(deviceId, token);

    return () => {
      initRef.current = false;
      disconnect();
    };
  }, [deviceId, token, connect, disconnect]);

  // Listen for result_chunks and write to terminal
  useEffect(() => {
    if (!ws) return;
    const unsub = ws.on('result_chunk', (payload) => {
      const chunk = payload.chunk as string;
      const done = payload.done as boolean;
      const term = getTerminal();
      if (term && chunk) {
        term.write(chunk);
      }
      if (done) {
        term?.writeln('');
      }
    });

    const unsubErr = ws.on('error', (payload) => {
      const msg = payload.message as string;
      showToast(msg, 'error');
      const term = getTerminal();
      term?.writeln(`\x1b[1;31mError: ${msg}\x1b[0m`);
    });

    return () => {
      unsub();
      unsubErr();
    };
  }, [ws]);

  const handleCommand = useCallback(
    (cmd: string) => {
      if (!connected) {
        showToast('Session not connected', 'error');
        return;
      }
      // Echo the command in the terminal
      const term = getTerminal();
      term?.writeln(`\x1b[1;32m> ${cmd}\x1b[0m`);
      sendCommand(cmd);
    },
    [connected, sendCommand],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 0 }}>
      {/* Header bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          padding: '0.75rem 1rem',
          background: '#1a1a2e',
          borderBottom: '1px solid #16213e',
          flexShrink: 0,
        }}
      >
        <button
          onClick={() => navigate('/devices')}
          style={{
            background: 'none',
            border: '1px solid #16213e',
            color: '#a0a0a0',
            padding: '0.3rem 0.75rem',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '0.8rem',
          }}
        >
          &larr; Back
        </button>
        <span style={{ color: '#e0e0e0', fontSize: '0.9rem' }}>
          {device?.name || deviceId || 'Unknown Device'}
        </span>
        <span
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: connected ? '#27ae60' : '#e74c3c',
            display: 'inline-block',
          }}
        />
        <span style={{ color: '#666', fontSize: '0.8rem' }}>
          {connected ? 'Connected' : 'Disconnected'}
        </span>
      </div>

      {/* Terminal area */}
      <div style={{ flex: 1, padding: '0.5rem', overflow: 'hidden' }}>
        <Terminal onCommand={handleCommand} readOnly={!connected} />
      </div>
    </div>
  );
}
