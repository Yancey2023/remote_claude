import { NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useSessionStore } from '../stores/sessionStore';
import { useDeviceStore } from '../stores/deviceStore';
import { ToastContainer } from './Toast';
import { ConnectionOverlay } from './ConnectionOverlay';
import { useI18n } from '../i18n';
import { getConfig } from '../config';
import { useIsMobile } from '../hooks/useIsMobile';

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    height: '100dvh',
    overflow: 'hidden',
    background: '#0f0f23',
    color: '#e0e0e0',
    fontFamily: 'system-ui, sans-serif',
  },
  sidebar: {
    width: '252px',
    background: '#1a1a2e',
    borderRight: '1px solid #16213e',
    display: 'flex',
    flexDirection: 'column',
    padding: '0.85rem',
    flexShrink: 0,
    overflow: 'hidden',
  },
  brandCard: {
    background: 'linear-gradient(150deg, rgba(22,33,62,0.95), rgba(15,15,35,0.9))',
    border: '1px solid #1d2b50',
    borderRadius: '10px',
    padding: '0.75rem 0.8rem',
    marginBottom: '0.85rem',
  },
  brandTitle: {
    fontSize: '1.05rem',
    fontWeight: 700,
    color: '#e94560',
    marginBottom: '0.25rem',
  },
  brandMeta: {
    fontSize: '0.75rem',
    color: '#8d95b8',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
  },
  link: {
    padding: '0.6rem 0.65rem',
    borderRadius: '8px',
    textDecoration: 'none',
    color: '#a0a0a0',
    fontSize: '0.87rem',
    transition: 'background 0.2s, color 0.2s',
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
    border: '1px solid transparent',
  },
  linkIcon: {
    display: 'inline-flex',
    width: '18px',
    height: '18px',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '5px',
    background: 'rgba(233,69,96,0.12)',
    color: '#f06a80',
    fontSize: '0.74rem',
    flexShrink: 0,
  },
  activeLink: {
    background: '#182545',
    color: '#e94560',
    border: '1px solid #233765',
  },
  sessionsSection: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
    marginTop: '0.85rem',
    borderTop: '1px solid #16213e',
    paddingTop: '0.8rem',
    display: 'flex',
    flexDirection: 'column',
  },
  sessionList: {
    overflowY: 'auto',
    paddingRight: '0.15rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
  },
  sessionItem: {
    padding: '0.5rem 0.55rem',
    borderRadius: '8px',
    textDecoration: 'none',
    color: '#b3b8d0',
    fontSize: '0.78rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    transition: 'background 0.2s, color 0.2s',
    border: '1px solid transparent',
    gap: '0.45rem',
  },
  sessionItemText: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
    color: 'inherit',
  },
  sessionItemMeta: {
    color: '#65719c',
    fontSize: '0.67rem',
    marginTop: '0.18rem',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  sessionDeleteBtn: {
    background: 'none',
    border: 'none',
    color: '#e74c3c',
    cursor: 'pointer',
    fontSize: '0.83rem',
    opacity: 0.45,
    padding: '0.05rem 0.18rem',
    flexShrink: 0,
    marginLeft: '0.2rem',
    alignSelf: 'center',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '1.2rem',
    minHeight: '1.2rem',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '0.55rem',
    padding: '0 0.15rem',
  },
  sectionTitle: {
    fontSize: '0.72rem',
    color: '#727ea6',
    letterSpacing: '0.04em',
  },
  sectionCount: {
    color: '#9ca3c8',
    background: '#192544',
    border: '1px solid #25355f',
    borderRadius: '999px',
    fontSize: '0.66rem',
    padding: '0.08rem 0.42rem',
    marginLeft: '0.4rem',
  },
  newSessionBtn: {
    background: '#1d2a4b',
    border: '1px solid #2f4778',
    color: '#f17a8e',
    borderRadius: '999px',
    padding: '0.18rem 0.6rem',
    fontSize: '0.68rem',
    fontWeight: 600,
    cursor: 'pointer',
    lineHeight: 1.1,
  },
  languageRow: {
    display: 'flex',
    gap: '0.4rem',
    marginTop: '0.5rem',
  },
  langBtn: {
    background: '#141f3a',
    border: '1px solid #25355f',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.72rem',
    padding: '0.2rem 0.55rem',
    flex: 1,
  },
  footer: {
    padding: '0.72rem',
    fontSize: '0.8rem',
    color: '#8791b9',
    borderTop: '1px solid #16213e',
    marginTop: '0.6rem',
    background: '#131d36',
    borderRadius: '10px',
  },
  userRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  userAvatar: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    background: '#1f2c50',
    border: '1px solid #2d4273',
    color: '#d1d8f8',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.78rem',
    fontWeight: 700,
    flexShrink: 0,
  },
  userName: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: '#d7dcf3',
    fontSize: '0.8rem',
  },
  logoutBtn: {
    width: '100%',
    marginTop: '0.55rem',
    background: '#2a1b34',
    border: '1px solid #5d2f4f',
    color: '#ff8694',
    cursor: 'pointer',
    borderRadius: '6px',
    padding: '0.35rem 0.5rem',
    fontSize: '0.78rem',
  },
  main: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  topbar: {
    minHeight: '56px',
    borderBottom: '1px solid #16213e',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.7rem',
    padding: '0.4rem 0.8rem',
    background: 'rgba(20,20,41,0.95)',
    flexShrink: 0,
    paddingTop: 'max(0.35rem, env(safe-area-inset-top))',
  },
  topbarLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.55rem',
    minWidth: 0,
    flex: 1,
  },
  menuBtn: {
    background: 'none',
    border: '1px solid #16213e',
    color: '#e0e0e0',
    borderRadius: '6px',
    width: '34px',
    height: '34px',
    cursor: 'pointer',
    fontSize: '1rem',
    lineHeight: 1,
    padding: 0,
    flexShrink: 0,
  },
  topbarTitleWrap: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.1rem',
  },
  topbarTitle: {
    color: '#e0e0e0',
    fontSize: '0.9rem',
    fontWeight: 600,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  topbarSubtitle: {
    color: '#7f86ad',
    fontSize: '0.72rem',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  topbarActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
    flexShrink: 0,
  },
  topbarActionBtn: {
    background: '#1e2b4d',
    border: '1px solid #324b7f',
    color: '#ef6f85',
    borderRadius: '999px',
    height: '30px',
    padding: '0 0.65rem',
    cursor: 'pointer',
    fontSize: '0.74rem',
    fontWeight: 600,
  },
  content: {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
};

export function Layout() {
  const { locale, setLocale, t } = useI18n();
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const location = useLocation();
  const navigate = useNavigate();
  const { id: deviceId, sessionId: activeSessionId } = useParams<{ id: string; sessionId: string }>();
  const devices = useDeviceStore((s) => s.devices);
  const sessions = useSessionStore((s) => s.sessions);
  const deleteSession = useSessionStore((s) => s.deleteSession);
  const fetchSessions = useSessionStore((s) => s.fetchSessions);
  const isMobile = useIsMobile(900);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const currentDevice = devices.find((d) => d.id === deviceId);
  const sessionsForDevice = useMemo(
    () => sessions.filter((s) => s.device_id === deviceId).sort((a, b) => b.created_at - a.created_at),
    [sessions, deviceId],
  );
  const activeSession = sessionsForDevice.find((s) => s.id === activeSessionId);

  const sessionLabel = (cwd: string | null | undefined, fallback: string) => {
    if (!cwd) return fallback;
    const tail = cwd.split(/[\\/]/).pop();
    return tail && tail.trim().length > 0 ? tail : cwd;
  };
  const currentSessionLabel = activeSessionId
    ? sessionLabel(activeSession?.cwd, activeSessionId.slice(0, 8))
    : '';

  const topTitle = activeSessionId
    ? currentSessionLabel
    : (currentDevice?.name || deviceId || t('devices'));
  const topSubtitle = activeSessionId
    ? `${t('sessions')} · ${activeSessionId.slice(0, 8)}`
    : deviceId
      ? `${t('sessions')} · ${sessionsForDevice.length}`
      : t('appName');
  const userInitial = (user?.username?.trim().charAt(0) || 'U').toUpperCase();

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, getConfig().devicePollIntervalMs);
    return () => clearInterval(interval);
  }, [fetchSessions]);

  useEffect(() => {
    if (!isMobile) setSidebarOpen(false);
  }, [isMobile]);

  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
  }, [location.pathname, location.search, isMobile]);

  useEffect(() => {
    if (!isMobile) return;
    document.body.style.overflow = sidebarOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobile, sidebarOpen]);

  useEffect(() => {
    if (!isMobile || !sidebarOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSidebarOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isMobile, sidebarOpen]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleDeleteSession = async (e: React.MouseEvent, sid: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm(t('deleteSessionConfirm'))) return;
    const isCurrentSession = sid === activeSessionId;
    if (isCurrentSession && deviceId) {
      // Leave terminal route first, then delete in background.
      navigate(`/devices/${deviceId}`, { replace: true });
    }
    await deleteSession(sid);
  };

  return (
    <div style={styles.container}>
      {isMobile && sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            zIndex: 30,
          }}
        />
      )}
      <div
        style={{
          ...styles.sidebar,
          position: isMobile ? 'fixed' : 'relative',
          top: 0,
          left: 0,
          bottom: 0,
          width: isMobile ? 'min(82vw, 320px)' : styles.sidebar.width,
          maxWidth: '100vw',
          paddingTop: isMobile ? 'max(0.75rem, env(safe-area-inset-top))' : styles.sidebar.padding,
          paddingBottom: isMobile ? 'max(0.75rem, env(safe-area-inset-bottom))' : styles.sidebar.padding,
          transform: isMobile ? (sidebarOpen ? 'translateX(0)' : 'translateX(-105%)') : 'none',
          transition: isMobile ? 'transform 0.2s ease' : undefined,
          boxShadow: isMobile && sidebarOpen ? '0 10px 40px rgba(0, 0, 0, 0.5)' : undefined,
          zIndex: 40,
        }}
      >
        <div style={styles.brandCard}>
          <div style={styles.brandTitle}>{t('appName')}</div>
          <div style={styles.brandMeta}>
            {deviceId ? (currentDevice?.name || deviceId) : t('devices')}
          </div>
        </div>
        <nav style={styles.nav}>
          <NavLink
            to="/devices"
            end
            onClick={() => setSidebarOpen(false)}
            style={({ isActive }) => ({
              ...styles.link,
              ...(isActive ? styles.activeLink : {}),
            })}
          >
            <span style={styles.linkIcon}>●</span>
            {t('devices')}
          </NavLink>
          {user?.role === 'Admin' && (
            <NavLink
              to="/admin"
              end
              onClick={() => setSidebarOpen(false)}
              style={({ isActive }) => ({
                ...styles.link,
                ...(isActive ? styles.activeLink : {}),
              })}
            >
              <span style={styles.linkIcon}>⚙</span>
              {t('admin')}
            </NavLink>
          )}
        </nav>

        {deviceId && (
          <div style={styles.sessionsSection}>
            <div style={styles.sectionHeader}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={styles.sectionTitle}>{t('sessions')}</span>
                <span style={styles.sectionCount}>{sessionsForDevice.length}</span>
              </div>
              <button
                style={styles.newSessionBtn}
                onClick={() => {
                  navigate(`/devices/${deviceId}?new=1`);
                  setSidebarOpen(false);
                }}
                title={t('newSessionTitle')}
              >
                <span className="btn-label">{t('new')}</span>
              </button>
            </div>
            <div style={styles.sessionList}>
              {sessionsForDevice.map((s) => (
                <NavLink
                  key={s.id}
                  to={`/devices/${deviceId}/sessions/${s.id}`}
                  onClick={() => setSidebarOpen(false)}
                  style={({ isActive }) => ({
                    ...styles.sessionItem,
                    ...(isActive ? { background: '#1b2a4d', color: '#f06b81', borderColor: '#2d4575' } : {}),
                  })}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={styles.sessionItemText}>{sessionLabel(s.cwd, '~')}</div>
                    <div style={styles.sessionItemMeta}>
                      {new Date(s.created_at * 1000).toLocaleString()}
                    </div>
                  </div>
                  <button
                    onClick={(e) => { void handleDeleteSession(e, s.id); }}
                    style={styles.sessionDeleteBtn}
                    title={t('closeSessionTitle')}
                  >
                    <span className="btn-icon-label">✕</span>
                  </button>
                </NavLink>
              ))}
            </div>
          </div>
        )}

        <div style={styles.footer}>
          <div style={styles.userRow}>
            <span style={styles.userAvatar}>{userInitial}</span>
            <span style={styles.userName}>{user?.username}</span>
          </div>
          <div style={styles.languageRow}>
            <button
              onClick={() => setLocale('en')}
              style={{ ...styles.langBtn, color: locale === 'en' ? '#ef6f85' : '#8b92b5' }}
            >
              <span className="btn-label">{t('languageEnglish')}</span>
            </button>
            <button
              onClick={() => setLocale('zh')}
              style={{ ...styles.langBtn, color: locale === 'zh' ? '#ef6f85' : '#8b92b5' }}
            >
              <span className="btn-label">{t('languageChinese')}</span>
            </button>
          </div>
          <button
            onClick={handleLogout}
            style={styles.logoutBtn}
          >
            <span className="btn-label">{t('logout')}</span>
          </button>
        </div>
      </div>
      <div style={styles.main}>
        {isMobile && (
          <div style={styles.topbar}>
            <div style={styles.topbarLeft}>
              <button style={styles.menuBtn} onClick={() => setSidebarOpen(true)} aria-label="Open menu">
                <span className="btn-icon-label">☰</span>
              </button>
              <div style={styles.topbarTitleWrap}>
                <div style={styles.topbarTitle}>{topTitle}</div>
                <div style={styles.topbarSubtitle}>{topSubtitle}</div>
              </div>
            </div>
            {deviceId && (
              <div style={styles.topbarActions}>
                <button
                  style={styles.topbarActionBtn}
                  onClick={() => navigate(`/devices/${deviceId}?new=1`)}
                  title={t('newSessionTitle')}
                >
                  <span className="btn-label">{t('new')}</span>
                </button>
              </div>
            )}
          </div>
        )}
        <ConnectionOverlay />
        <div style={styles.content}>
          <Suspense fallback={null}><Outlet /></Suspense>
        </div>
      </div>
      <ToastContainer />
    </div>
  );
}
