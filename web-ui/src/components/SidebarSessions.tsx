import { useMemo } from 'react';
import { NavLink, useNavigate, useParams } from 'react-router-dom';
import { useSessionStore } from '../stores/sessionStore';
import { useI18n } from '../i18n';

const styles: Record<string, React.CSSProperties> = {
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
};

function sessionLabel(cwd: string | null | undefined, fallback: string): string {
  if (!cwd) return fallback;
  const tail = cwd.split(/[\\/]/).pop();
  return tail && tail.trim().length > 0 ? tail : cwd;
}

interface Props {
  deviceId: string | undefined;
  onNavigate: () => void;
}

export function SidebarSessions({ deviceId, onNavigate }: Props) {
  const { t } = useI18n();
  const { sessionId: activeSessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const sessions = useSessionStore((s) => s.sessions);
  const deleteSession = useSessionStore((s) => s.deleteSession);

  const sessionsForDevice = useMemo(
    () => sessions
      .filter((s) => s.device_id === deviceId)
      .sort((a, b) => b.created_at - a.created_at),
    [sessions, deviceId],
  );

  const handleDeleteSession = async (e: React.MouseEvent, sid: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm(t('deleteSessionConfirm'))) return;
    const isCurrentSession = sid === activeSessionId;
    if (isCurrentSession && deviceId) {
      navigate(`/devices/${deviceId}`, { replace: true });
    }
    await deleteSession(sid);
  };

  return (
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
            onNavigate();
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
            onClick={onNavigate}
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
  );
}
