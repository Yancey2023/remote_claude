import { useCallback, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useTerminalStore } from '../stores/terminalStore';
import { useAuthStore } from '../stores/authStore';
import { useDeviceStore } from '../stores/deviceStore';
import { Terminal, type TerminalHandle } from '../components/Terminal';
import { useI18n } from '../i18n';

export function TerminalPage() {
  const { t } = useI18n();
  const { id: deviceId, sessionId } = useParams<{ id: string; sessionId: string }>();
  const [searchParams] = useSearchParams();
  const cwd = searchParams.get('cwd') || undefined;
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);
  const devices = useDeviceStore((s) => s.devices);
  const device = devices.find((d) => d.id === deviceId);
  const store = useTerminalStore();
  const { connect, sendRawInput, sendResize, disconnect, connected, ws, error, sessionId: activeSessionId } = store;
  const terminalRef = useRef<TerminalHandle>(null);
  const terminalSizeRef = useRef<{ cols: number; rows: number } | null>(null);
  const suppressInputRef = useRef(false);
  const replayReleaseTimerRef = useRef<number | null>(null);
  const displayedSessionId = activeSessionId ?? sessionId;

  // (Re)attach on session change; store handles same-device fast switching.
  useEffect(() => {
    if (!deviceId || !sessionId || !token) return;
    connect(deviceId, token, sessionId!, cwd);
  }, [deviceId, sessionId, token, cwd, connect]);

  // New-session flow: once server assigns real session id, sync URL via React Router.
  useEffect(() => {
    if (!deviceId || !sessionId || !activeSessionId) return;
    if (sessionId !== 'new') return;
    const qs = cwd ? `?cwd=${encodeURIComponent(cwd)}` : '';
    navigate(`/devices/${deviceId}/sessions/${activeSessionId}${qs}`, { replace: true });
  }, [deviceId, sessionId, activeSessionId, cwd, navigate]);

  // Close WS only when leaving terminal page.
  useEffect(() => {
    return () => {
      if (replayReleaseTimerRef.current !== null) {
        window.clearTimeout(replayReleaseTimerRef.current);
      }
      disconnect();
    };
  }, [disconnect]);

  // Listen for result_chunks and write to terminal
  useEffect(() => {
    if (!ws) return;
    const unsub = ws.on('result_chunk', (payload) => {
      let chunk = payload.chunk as string;
      const done = payload.done as boolean;
      const sid = payload.session_id as string;
      const replay = Boolean(payload.replay);
      if (sid !== displayedSessionId) return;
      const term = terminalRef.current;
      if (term && chunk) {
        if (replay) {
          // Replay can include historical CSI queries (e.g. ESC[6n) that would cause
          // xterm to emit automatic replies like ESC[4;1R into onData.
          // Strip these query sequences and suppress transient emulator replies.
          suppressInputRef.current = true;
          chunk = chunk
            .split('\x1b[6n').join('')
            .split('\x1b[?6n').join('');
        }
        term.write(chunk);
        if (replay) {
          if (replayReleaseTimerRef.current !== null) {
            window.clearTimeout(replayReleaseTimerRef.current);
          }
          replayReleaseTimerRef.current = window.setTimeout(() => {
            suppressInputRef.current = false;
            replayReleaseTimerRef.current = null;
          }, 80);
        }
      }
      if (done) {
        terminalRef.current?.writeln(`\r\n\x1b[1;33m${t('terminalSessionEnded')}\x1b[0m`);
      }
    });

    const unsubErr = ws.on('error', (payload) => {
      const msg = payload.message as string;
      terminalRef.current?.writeln(`\r\n\x1b[1;31m${t('terminalErrorPrefix')}: ${msg}\x1b[0m`);
    });

    return () => {
      unsub();
      unsubErr();
    };
  }, [ws, displayedSessionId, t]);

  const handleData = useCallback(
    (data: string) => {
      if (suppressInputRef.current) return;
      if (!connected) return;
      sendRawInput(data);
    },
    [connected, sendRawInput],
  );

  const handleResize = useCallback(
    (cols: number, rows: number) => {
      terminalSizeRef.current = { cols, rows };
      if (connected) {
        sendResize(cols, rows);
      }
    },
    [connected, sendResize],
  );

  // Once session connects, push the latest known terminal size to PTY.
  useEffect(() => {
    if (!connected) return;
    const size = terminalSizeRef.current;
    if (!size) return;
    sendResize(size.cols, size.rows);
  }, [connected, sendResize]);

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
          &larr; {t('back')}
        </button>
        <span style={{ color: '#e0e0e0', fontSize: '0.9rem' }}>
          {device?.name || deviceId || ''}
        </span>
        <span style={{ color: '#666', fontSize: '0.8rem' }}>
          {displayedSessionId?.slice(0, 8)}...
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
          {connected ? t('connected') : error ? t('error') : t('disconnected')}
        </span>
      </div>

      <div style={{ flex: 1, padding: '0.5rem', overflow: 'hidden' }}>
        <Terminal
          key={displayedSessionId ?? 'pending'}
          ref={terminalRef}
          onData={handleData}
          onResize={handleResize}
          readOnly={!connected}
        />
      </div>
    </div>
  );
}
