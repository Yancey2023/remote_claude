import { NavLink, Outlet, useNavigate, useParams } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useSessionStore } from '../stores/sessionStore';
import { ToastContainer } from './Toast';
import { ConnectionOverlay } from './ConnectionOverlay';
import { useI18n } from '../i18n';
import { getConfig } from '../config';

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
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '0.5rem',
    padding: '0 0.5rem',
  },
  sectionTitle: {
    fontSize: '0.75rem',
    color: '#666',
  },
  newSessionBtn: {
    background: 'none',
    border: '1px solid #16213e',
    color: '#e94560',
    borderRadius: '4px',
    padding: '0.1rem 0.45rem',
    fontSize: '0.7rem',
    cursor: 'pointer',
    lineHeight: 1.2,
  },
  languageRow: {
    display: 'flex',
    gap: '0.35rem',
    marginTop: '0.35rem',
  },
  langBtn: {
    background: 'none',
    border: '1px solid #16213e',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.72rem',
    padding: '0.12rem 0.4rem',
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
  const { locale, setLocale, t } = useI18n();
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const { id: deviceId, sessionId: activeSessionId } = useParams<{ id: string; sessionId: string }>();
  const sessions = useSessionStore((s) => s.sessions);
  const deleteSession = useSessionStore((s) => s.deleteSession);
  const fetchSessions = useSessionStore((s) => s.fetchSessions);

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, getConfig().devicePollIntervalMs);
    return () => clearInterval(interval);
  }, [fetchSessions]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleDeleteSession = (e: React.MouseEvent, sid: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm(t('deleteSessionConfirm'))) return;
    deleteSession(sid);
    if (sid === activeSessionId) {
      navigate(`/devices/${deviceId || ''}`);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.sidebar}>
        <div style={styles.logo}>{t('appName')}</div>
        <nav style={styles.nav}>
          <NavLink
            to="/devices"
            end
            style={({ isActive }) => ({
              ...styles.link,
              ...(isActive ? styles.activeLink : {}),
            })}
          >
            {t('devices')}
          </NavLink>
        </nav>

        {deviceId && (
          <div style={styles.sessionsSection}>
            <div style={styles.sectionHeader}>
              <span style={styles.sectionTitle}>{t('sessions')}</span>
              <button
                style={styles.newSessionBtn}
                onClick={() => navigate(`/devices/${deviceId}/sessions/new`)}
                title={t('newSessionTitle')}
              >
                {t('new')}
              </button>
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
                    title={t('closeSessionTitle')}
                  >
                    ✕
                  </button>
                </NavLink>
              ))}
          </div>
        )}

        <div style={styles.footer}>
          <div style={{ marginBottom: '0.25rem' }}>{user?.username}</div>
          <div style={styles.languageRow}>
            <button
              onClick={() => setLocale('en')}
              style={{ ...styles.langBtn, color: locale === 'en' ? '#e94560' : '#888' }}
            >
              {t('languageEnglish')}
            </button>
            <button
              onClick={() => setLocale('zh')}
              style={{ ...styles.langBtn, color: locale === 'zh' ? '#e94560' : '#888' }}
            >
              {t('languageChinese')}
            </button>
          </div>
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
            {t('logout')}
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
