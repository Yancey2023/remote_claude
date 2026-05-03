import { NavLink, Outlet, useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useSessionStore } from '../stores/sessionStore';
import { ToastContainer } from './Toast';
import { ConnectionOverlay } from './ConnectionOverlay';

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    height: '100vh',
    overflow: 'hidden',
    background: '#0f0f23',
    color: '#e0e0e0',
    fontFamily: 'system-ui, sans-serif',
  },
  sidebar: {
    width: '220px',
    background: '#1a1a2e',
    borderRight: '1px solid #16213e',
    display: 'flex',
    flexDirection: 'column',
    padding: '1rem',
    flexShrink: 0,
    overflow: 'hidden',
  },
  logo: {
    fontSize: '1.1rem',
    fontWeight: 700,
    color: '#e94560',
    marginBottom: '1rem',
    padding: '0 0.5rem',
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  link: {
    padding: '0.5rem',
    borderRadius: '6px',
    textDecoration: 'none',
    color: '#a0a0a0',
    fontSize: '0.9rem',
    transition: 'background 0.2s',
  },
  activeLink: {
    background: '#16213e',
    color: '#e94560',
  },
  sessionsSection: {
    flex: 1,
    overflow: 'auto',
    marginTop: '1rem',
    borderTop: '1px solid #16213e',
    paddingTop: '0.75rem',
  },
  sessionItem: {
    padding: '0.4rem 0.5rem',
    borderRadius: '4px',
    textDecoration: 'none',
    color: '#a0a0a0',
    fontSize: '0.8rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    transition: 'background 0.2s',
    marginBottom: '0.2rem',
  },
  footer: {
    padding: '0.5rem',
    fontSize: '0.8rem',
    color: '#666',
    borderTop: '1px solid #16213e',
    marginTop: '0.5rem',
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
};

export function Layout() {
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const { id: deviceId, sessionId: activeSessionId } = useParams<{ id: string; sessionId: string }>();
  const sessions = useSessionStore((s) => s.sessions);
  const deleteSession = useSessionStore((s) => s.deleteSession);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleDeleteSession = (e: React.MouseEvent, sid: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm('Delete this session?')) return;
    deleteSession(sid);
    if (sid === activeSessionId) {
      navigate(`/devices/${deviceId || ''}`);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.sidebar}>
        <div style={styles.logo}>Remote Claude</div>
        <nav style={styles.nav}>
          <NavLink
            to="/devices"
            end
            style={({ isActive }) => ({
              ...styles.link,
              ...(isActive ? styles.activeLink : {}),
            })}
          >
            Devices
          </NavLink>
        </nav>

        {deviceId && (
          <div style={styles.sessionsSection}>
            <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.5rem', padding: '0 0.5rem' }}>
              SESSIONS
            </div>
            {sessions
              .filter((s) => s.device_id === deviceId)
              .map((s) => (
                <NavLink
                  key={s.id}
                  to={`/devices/${deviceId}/sessions/${s.id}`}
                  style={({ isActive }) => ({
                    ...styles.sessionItem,
                    ...(isActive ? { background: '#16213e', color: '#e94560' } : {}),
                  })}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {s.cwd ? s.cwd.split(/[\\/]/).pop() || s.cwd : '~'}
                  </span>
                  <button
                    onClick={(e) => handleDeleteSession(e, s.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#e74c3c',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      opacity: 0.4,
                      padding: '0 2px',
                      flexShrink: 0,
                      marginLeft: '4px',
                    }}
                    title="Close session"
                  >
                    ✕
                  </button>
                </NavLink>
              ))}
          </div>
        )}

        <div style={styles.footer}>
          <div style={{ marginBottom: '0.25rem' }}>{user?.username}</div>
          <button
            onClick={handleLogout}
            style={{
              background: 'none',
              border: 'none',
              color: '#e74c3c',
              cursor: 'pointer',
              padding: 0,
              fontSize: '0.8rem',
            }}
          >
            Logout
          </button>
        </div>
      </div>
      <div style={styles.main}>
        <ConnectionOverlay />
        <Outlet />
      </div>
      <ToastContainer />
    </div>
  );
}
