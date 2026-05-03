import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
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
  },
  logo: {
    fontSize: '1.1rem',
    fontWeight: 700,
    color: '#e94560',
    marginBottom: '2rem',
    padding: '0 0.5rem',
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    flex: 1,
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
  footer: {
    padding: '0.5rem',
    fontSize: '0.8rem',
    color: '#666',
    borderTop: '1px solid #16213e',
    marginTop: 'auto',
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

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div style={styles.container}>
      <div style={styles.sidebar}>
        <div style={styles.logo}>Remote Claude</div>
        <nav style={styles.nav}>
          <NavLink
            to="/devices"
            style={({ isActive }) => ({
              ...styles.link,
              ...(isActive ? styles.activeLink : {}),
            })}
          >
            Devices
          </NavLink>
        </nav>
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
