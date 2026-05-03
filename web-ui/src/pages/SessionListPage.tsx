import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useDeviceStore } from '../stores/deviceStore';
import { useSessionStore } from '../stores/sessionStore';
import { useI18n } from '../i18n';

export function SessionListPage() {
  const { t } = useI18n();
  const { id: deviceId } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const devices = useDeviceStore((s) => s.devices);
  const device = devices.find((d) => d.id === deviceId);
  const { sessions, loading, fetchSessions, createSession, deleteSession } = useSessionStore();
  const [showNew, setShowNew] = useState(false);
  const [cwd, setCwd] = useState('');

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
    const qs = params.toString();
    navigate(`/devices/${deviceId}/sessions/new${qs ? '?' + qs : ''}`);
  };

  const handleCancelNew = () => {
    setShowNew(false);
    setNewFlag(false);
  };

  const handleDelete = async (sessionId: string) => {
    await deleteSession(sessionId);
  };

  const deviceSessions = sessions.filter((s) => s.device_id === deviceId);

  return (
    <div style={{ padding: '1.5rem', overflow: 'auto', flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#e0e0e0' }}>
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
            padding: '0.5rem 1rem',
            background: '#e94560',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            marginBottom: '1.5rem',
          }}
        >
          {t('plusNewSession')}
        </button>
      )}

      {showNew && (
        <div
          style={{
            background: '#16213e',
            border: '1px solid #0f3460',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1.5rem',
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
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={handleCreate}
              style={{
                padding: '0.4rem 1rem',
                background: '#e94560',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.85rem',
              }}
            >
              {t('start')}
            </button>
            <button
              onClick={handleCancelNew}
              style={{
                padding: '0.4rem 1rem',
                background: 'none',
                border: '1px solid #16213e',
                color: '#888',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.85rem',
              }}
            >
              {t('cancel')}
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
          <div
            key={s.id}
            onClick={() => navigate(`/devices/${deviceId}/sessions/${s.id}`)}
            style={{
              background: '#16213e',
              border: '1px solid #0f3460',
              borderRadius: '8px',
              padding: '0.75rem 1rem',
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              transition: 'border-color 0.2s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = '#e94560';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = '#0f3460';
            }}
          >
            <div>
              <div style={{ color: '#e0e0e0', fontSize: '0.9rem', marginBottom: '0.2rem' }}>
                {s.cwd || t('defaultDirectory')}
              </div>
              <div style={{ color: '#666', fontSize: '0.75rem' }}>
                {new Date(s.created_at * 1000).toLocaleString()}
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm(t('deleteSessionConfirm'))) {
                  handleDelete(s.id);
                }
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#e74c3c',
                cursor: 'pointer',
                fontSize: '1rem',
                opacity: 0.5,
              }}
              title={t('deleteSessionTitle')}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
