import { memo, useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useDeviceStore } from '../stores/deviceStore';
import { useSessionStore } from '../stores/sessionStore';
import { useI18n } from '../i18n';
import { useIsMobile } from '../hooks/useIsMobile';

export function SessionListPage() {
  const { t } = useI18n();
  const { id: deviceId } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const devices = useDeviceStore((s) => s.devices);
  const device = devices.find((d) => d.id === deviceId);
  const sessions = useSessionStore((s) => s.sessions);
  const loading = useSessionStore((s) => s.loading);
  const fetchSessions = useSessionStore((s) => s.fetchSessions);
  const createSession = useSessionStore((s) => s.createSession);
  const deleteSession = useSessionStore((s) => s.deleteSession);
  const [showNew, setShowNew] = useState(false);
  const [cwd, setCwd] = useState('');
  const [program, setProgram] = useState('claude');
  const isMobile = useIsMobile(900);

  const PROGRAMS = [
    { value: 'powershell', label: t('programPowerShell') },
    { value: 'bash', label: t('programBash') },
    { value: 'claude', label: t('programClaude') },
    { value: 'codex', label: t('programCodex') },
    { value: 'opencode', label: t('programOpencode') },
  ];

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setShowNew(true);
    }
  }, [searchParams]);

  const setNewFlag = (enabled: boolean) => {
    const next = new URLSearchParams(searchParams);
    if (enabled) {
      next.set('new', '1');
    } else {
      next.delete('new');
    }
    setSearchParams(next, { replace: true });
  };

  const handleCreate = () => {
    if (!deviceId) return;
    setShowNew(false);
    const params = new URLSearchParams();
    if (cwd) params.set('cwd', cwd);
    if (program !== 'claude') params.set('program', program);
    const qs = params.toString();
    navigate(`/devices/${deviceId}/sessions/new${qs ? '?' + qs : ''}`);
  };

  const handleCancelNew = () => {
    setShowNew(false);
    setNewFlag(false);
  };

  const deviceSessions = sessions.filter((s) => s.device_id === deviceId);

  const handleDelete = useCallback((sessionId: string) => {
    deleteSession(sessionId);
  }, [deleteSession]);

  return (
    <div style={{ padding: isMobile ? '0.9rem 0.75rem' : '1.5rem', overflow: 'auto', flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '1.1rem' }}>
        <h2 style={{ margin: 0, fontSize: isMobile ? '1.1rem' : '1.25rem', color: '#e0e0e0', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {device?.name || deviceId}
        </h2>
        <span
          style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            background: device?.online ? '#27ae60' : '#666',
            display: 'inline-block',
          }}
        />
        <span style={{ color: '#666', fontSize: '0.8rem' }}>
          {device?.online ? t('sessionOnline') : t('sessionOffline')}
        </span>
      </div>

      {!showNew && (
        <button
          onClick={() => {
            setShowNew(true);
            setNewFlag(true);
          }}
          style={{
            padding: isMobile ? '0.6rem 0.9rem' : '0.5rem 1rem',
            width: isMobile ? '100%' : 'auto',
            background: '#e94560',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            marginBottom: '1.1rem',
          }}
        >
          <span className="btn-label">{t('plusNewSession')}</span>
        </button>
      )}

      {showNew && (
        <div
          style={{
            background: '#16213e',
            border: '1px solid #0f3460',
            borderRadius: '8px',
            padding: isMobile ? '0.85rem' : '1rem',
            marginBottom: '1.1rem',
          }}
        >
          <div style={{ marginBottom: '0.75rem', color: '#e0e0e0', fontSize: '0.9rem' }}>
            {t('sessionNewTitle')}
          </div>
          <input
            type="text"
            value={cwd}
            onChange={(e) => setCwd(e.target.value)}
            placeholder={t('workingDirPlaceholder')}
            style={{
              width: '100%',
              padding: '0.5rem',
              background: '#0f0f23',
              border: '1px solid #16213e',
              borderRadius: '6px',
              color: '#e0e0e0',
              fontSize: '0.85rem',
              outline: 'none',
              boxSizing: 'border-box',
              marginBottom: '0.75rem',
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />
          <div style={{ marginBottom: '0.75rem' }}>
            <div style={{ color: '#a0a0a0', fontSize: '0.8rem', marginBottom: '0.35rem' }}>
              {t('program')}
            </div>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {PROGRAMS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setProgram(p.value)}
                  style={{
                    padding: '0.4rem 0.75rem',
                    background: program === p.value ? '#e94560' : '#1d2a4b',
                    border: `1px solid ${program === p.value ? '#e94560' : '#2f4778'}`,
                    color: program === p.value ? '#fff' : '#b0b8d0',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    fontWeight: 500,
                    flex: isMobile ? '1 1 calc(50% - 0.4rem)' : 'none',
                    minWidth: isMobile ? 0 : '6.5rem',
                    textAlign: 'center',
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
            <button
              onClick={handleCreate}
              style={{
                padding: '0.45rem 1rem',
                background: '#e94560',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.85rem',
                width: isMobile ? '100%' : 'auto',
              }}
            >
              <span className="btn-label">{t('start')}</span>
            </button>
            <button
              onClick={handleCancelNew}
              style={{
                padding: '0.45rem 1rem',
                background: 'none',
                border: '1px solid #16213e',
                color: '#888',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.85rem',
                width: isMobile ? '100%' : 'auto',
              }}
            >
              <span className="btn-label">{t('cancel')}</span>
            </button>
          </div>
        </div>
      )}

      {loading && <p style={{ color: '#666' }}>{t('loadingSessions')}</p>}

      {!loading && deviceSessions.length === 0 && !showNew && (
        <p style={{ color: '#666' }}>{t('noSessionsYet')}</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {deviceSessions.map((s) => (
          <SessionItem
            key={s.id}
            id={s.id}
            cwd={s.cwd}
            createdAt={s.created_at}
            deviceId={deviceId!}
            isMobile={isMobile}
            onDelete={handleDelete}
          />
        ))}
      </div>
    </div>
  );
}

interface SessionItemProps {
  id: string;
  cwd: string | null;
  createdAt: number;
  deviceId: string;
  isMobile: boolean;
  onDelete: (id: string) => void;
}

const SessionItem = memo(function SessionItem({
  id,
  cwd,
  createdAt,
  deviceId,
  isMobile,
  onDelete,
}: SessionItemProps) {
  const { t } = useI18n();
  const navigate = useNavigate();

  return (
    <div
      onClick={() => navigate(`/devices/${deviceId}/sessions/${id}`)}
      style={{
        background: '#16213e',
        border: '1px solid #0f3460',
        borderRadius: '8px',
        padding: isMobile ? '0.7rem 0.8rem' : '0.75rem 1rem',
        cursor: 'pointer',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: isMobile ? 'flex-start' : 'center',
        gap: '0.6rem',
        transition: 'border-color 0.2s',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = '#e94560';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = '#0f3460';
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            color: '#e0e0e0',
            fontSize: '0.9rem',
            marginBottom: '0.2rem',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {cwd || t('defaultDirectory')}
        </div>
        <div style={{ color: '#666', fontSize: '0.75rem' }}>
          {new Date(createdAt * 1000).toLocaleString()}
        </div>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (window.confirm(t('deleteSessionConfirm'))) {
            onDelete(id);
          }
        }}
        style={{
          background: 'none',
          border: 'none',
          color: '#e74c3c',
          cursor: 'pointer',
          fontSize: '1rem',
          opacity: 0.5,
          alignSelf: 'center',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: '1.3rem',
          minHeight: '1.3rem',
        }}
        title={t('deleteSessionTitle')}
      >
        <span className="btn-icon-label">✕</span>
      </button>
    </div>
  );
});
