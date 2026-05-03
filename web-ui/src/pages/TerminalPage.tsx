import { useCallback, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useTerminalStore } from '../stores/terminalStore';
import { useAuthStore } from '../stores/authStore';
import { useDeviceStore } from '../stores/deviceStore';
import { Terminal, type TerminalHandle } from '../components/Terminal';

export function TerminalPage() {
  const { id: deviceId, sessionId } = useParams<{ id: string; sessionId: string }>();
  const [searchParams] = useSearchParams();
  const cwd = searchParams.get('cwd') || undefined;
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);
  const devices = useDeviceStore((s) => s.devices);
  const device = devices.find((d) => d.id === deviceId);
  const store = useTerminalStore();
  const { connect, sendRawInput, sendResize, disconnect, connected, ws, error } = store;
  const initRef = useRef(false);
  const terminalRef = useRef<TerminalHandle>(null);

  // Connection setup
  useEffect(() => {
    if (!deviceId || !sessionId || !token || initRef.current) return;
    initRef.current = true;

    connect(deviceId, token, sessionId!, cwd);

    return () => {
      initRef.current = false;
      disconnect();
    };
  }, [deviceId, sessionId, token, connect, disconnect]);

  // Listen for result_chunks and write to terminal
  useEffect(() => {
    if (!ws) return;
    const unsub = ws.on('result_chunk', (payload) => {
      const chunk = payload.chunk as string;
      const done = payload.done as boolean;
      const sid = payload.session_id as string;
      // Only show output for THIS session
      if (sid !== sessionId) return;
      const term = terminalRef.current;
      if (term && chunk) {
        term.write(chunk);
      }
      if (done) {
        terminalRef.current?.writeln('\r\n\x1b[1;33m[Session ended]\x1b[0m');
      }
    });

    const unsubErr = ws.on('error', (payload) => {
      const msg = payload.message as string;
      terminalRef.current?.writeln(`\r\n\x1b[1;31mError: ${msg}\x1b[0m`);
    });

    return () => {
      unsub();
      unsubErr();
    };
  }, [ws, sessionId]);

  const handleData = useCallback(
    (data: string) => {
      if (!connected) return;
      sendRawInput(data);
    },
    [connected, sendRawInput],
  );

  const handleResize = useCallback(
    (cols: number, rows: number) => {
      if (!connected) return;
      sendResize(cols, rows);
    },
    [connected, sendResize],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 0 }}>
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
          onClick={() => navigate(`/devices/${deviceId}`)}
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
          {device?.name || deviceId || ''}
        </span>
        <span style={{ color: '#666', fontSize: '0.8rem' }}>
          {sessionId?.slice(0, 8)}...
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
          {connected ? 'Connected' : error ? 'Error' : 'Disconnected'}
        </span>
      </div>

      <div style={{ flex: 1, padding: '0.5rem', overflow: 'hidden' }}>
        <Terminal
          ref={terminalRef}
          onData={handleData}
          onResize={handleResize}
          readOnly={!connected}
        />
      </div>
    </div>
  );
}
