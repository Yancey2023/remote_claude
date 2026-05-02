import { useTerminalStore } from '../stores/terminalStore';

export function ConnectionOverlay() {
  const wsConnected = useTerminalStore((s) => s.wsConnected);
  const connected = useTerminalStore((s) => s.connected);

  // Only show when we expect a connection but don't have one
  const show = !connected && !wsConnected;

  if (!show) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(15, 15, 35, 0.9)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          width: '48px',
          height: '48px',
          border: '4px solid #16213e',
          borderTopColor: '#e94560',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
          marginBottom: '1rem',
        }}
      />
      <p style={{ color: '#a0a0a0', fontSize: '0.9rem' }}>
        Connecting...
      </p>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
