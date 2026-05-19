import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { useI18n, translate } from '../i18n';
import { useIsMobile } from '../hooks/useIsMobile';
import type { UserResponse, AdminDeviceResponse, AdminSessionResponse, SessionDetailResponse } from '../types/protocol';

type Tab = 'users' | 'devices' | 'sessions';

export function AdminPage() {
  const { t, tf } = useI18n();
  const isMobile = useIsMobile(900);
  const [activeTab, setActiveTab] = useState<Tab>('users');

  return (
    <div style={styles.container(isMobile)}>
      <h2 style={styles.title}>{t('admin')}</h2>
      <TabBar activeTab={activeTab} onSelect={setActiveTab} t={t} isMobile={isMobile} />
      {activeTab === 'users' && <UsersTab t={t} tf={tf} isMobile={isMobile} />}
      {activeTab === 'devices' && <DevicesTab t={t} tf={tf} isMobile={isMobile} />}
      {activeTab === 'sessions' && <SessionsTab t={t} tf={tf} isMobile={isMobile} />}
    </div>
  );
}

// ── Tab Bar ──

function TabBar({ activeTab, onSelect, t, isMobile }: {
  activeTab: Tab;
  onSelect: (t: Tab) => void;
  t: (key: any) => string;
  isMobile: boolean;
}) {
  const tabs: { key: Tab; label: string }[] = [
    { key: 'users', label: t('adminUsers') },
    { key: 'devices', label: t('adminDevices') },
    { key: 'sessions', label: t('adminSessions') },
  ];
  return (
    <div style={tabBarStyles.container}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onSelect(tab.key)}
          style={{
            ...tabBarStyles.tab,
            ...(activeTab === tab.key ? tabBarStyles.active : {}),
            padding: isMobile ? '0.4rem 0.9rem' : '0.5rem 1.2rem',
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

const tabBarStyles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    gap: '0.25rem',
    marginBottom: '1rem',
    borderBottom: '1px solid #1d2b50',
    paddingBottom: 0,
  },
  tab: {
    background: 'none',
    border: 'none',
    borderBottom: '2px solid transparent',
    color: '#727ea6',
    fontSize: '0.85rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'color 0.15s, border-color 0.15s',
  },
  active: {
    color: '#f17a8e',
    borderBottom: '2px solid #f17a8e',
  },
};

// ── Shared Styles ──

const styles = {
  container: (isMobile: boolean): React.CSSProperties => ({
    padding: isMobile ? '0.9rem 0.75rem' : '1.5rem',
    overflow: 'auto',
    flex: 1,
    minWidth: 0,
  }),
  title: {
    margin: '0 0 0.75rem 0',
    fontSize: '1.25rem' as const,
    color: '#e0e0e0',
  },
  card: {
    background: '#141f36',
    border: '1px solid #1d2b50',
    borderRadius: '10px',
    padding: '1rem',
    marginBottom: '1rem',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: '0.85rem',
  },
  th: {
    textAlign: 'left' as const,
    padding: '0.6rem 0.5rem',
    color: '#727ea6',
    borderBottom: '1px solid #1d2b50',
    fontWeight: 600,
    fontSize: '0.78rem',
    textTransform: 'uppercase' as const,
    whiteSpace: 'nowrap' as const,
  },
  td: {
    padding: '0.6rem 0.5rem',
    borderBottom: '1px solid #16213e',
    color: '#c8cce0',
    fontSize: '0.82rem',
  },
  tdMono: {
    padding: '0.6rem 0.5rem',
    borderBottom: '1px solid #16213e',
    color: '#c8cce0',
    fontSize: '0.78rem',
    fontFamily: 'monospace',
  },
  actionBtn: {
    background: 'none',
    border: '1px solid #2f4778',
    borderRadius: '6px',
    padding: '0.25rem 0.55rem',
    fontSize: '0.72rem',
    cursor: 'pointer',
    marginRight: '0.35rem',
  },
  deleteBtn: {
    color: '#e74c3c',
  },
  primaryBtn: {
    color: '#2ecc71',
  },
  warnBtn: {
    color: '#f39c12',
  },
  badge: {
    display: 'inline-block',
    padding: '0.15rem 0.5rem',
    borderRadius: '999px',
    fontSize: '0.72rem',
    fontWeight: 600,
  },
  badgeOnline: {
    background: 'rgba(46, 204, 113, 0.15)',
    color: '#2ecc71',
    border: '1px solid rgba(46, 204, 113, 0.3)',
  },
  badgeOffline: {
    background: 'rgba(231, 76, 60, 0.15)',
    color: '#e74c3c',
    border: '1px solid rgba(231, 76, 60, 0.3)',
  },
  badgeEnabled: {
    background: 'rgba(46, 204, 113, 0.15)',
    color: '#2ecc71',
    border: '1px solid rgba(46, 204, 113, 0.3)',
  },
  badgeDisabled: {
    background: 'rgba(231, 76, 60, 0.15)',
    color: '#e74c3c',
    border: '1px solid rgba(231, 76, 60, 0.3)',
  },
  badgeActive: {
    background: 'rgba(46, 204, 113, 0.15)',
    color: '#2ecc71',
    border: '1px solid rgba(46, 204, 113, 0.3)',
  },
  badgeClosed: {
    background: 'rgba(149, 165, 166, 0.15)',
    color: '#95a5a6',
    border: '1px solid rgba(149, 165, 166, 0.3)',
  },
  badgeBusy: {
    background: 'rgba(243, 156, 18, 0.15)',
    color: '#f39c12',
    border: '1px solid rgba(243, 156, 18, 0.3)',
  },
  error: {
    color: '#e74c3c',
    fontSize: '0.82rem',
    marginBottom: '0.5rem',
  },
  emptyRow: {
    textAlign: 'center' as const,
    padding: '2rem 0.5rem',
    color: '#65719c',
    fontSize: '0.85rem',
  },
  input: {
    background: '#0a0e1a',
    border: '1px solid #1d2b50',
    borderRadius: '6px',
    padding: '0.5rem 0.65rem',
    fontSize: '0.82rem',
    color: '#e0e0e0',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box' as const,
  },
  submitBtn: {
    background: '#1a6b3c',
    border: '1px solid #2ecc71',
    color: '#2ecc71',
    borderRadius: '6px',
    padding: '0.4rem 0.8rem',
    fontSize: '0.78rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  cancelBtn: {
    background: '#2a1b34',
    border: '1px solid #5d2f4f',
    color: '#ff8694',
    borderRadius: '6px',
    padding: '0.4rem 0.8rem',
    fontSize: '0.78rem',
    cursor: 'pointer',
  },
  overlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    background: '#141f36',
    border: '1px solid #1d2b50',
    borderRadius: '12px',
    padding: '1.5rem',
    maxWidth: '700px',
    width: '90%',
    maxHeight: '80vh',
    overflow: 'auto',
  },
  modalTitle: {
    margin: '0 0 1rem 0',
    fontSize: '1.05rem',
    color: '#e0e0e0',
  },
  pre: {
    background: '#0a0e1a',
    border: '1px solid #1d2b50',
    borderRadius: '6px',
    padding: '0.75rem',
    color: '#a8b0d0',
    fontSize: '0.78rem',
    fontFamily: 'monospace',
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-all' as const,
    maxHeight: '400px',
    overflow: 'auto',
    lineHeight: 1.5,
  },
};

// ── Users Tab ──

function UsersTab({ t, tf, isMobile }: { t: any; tf: any; isMobile: boolean }) {
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Password reset state
  const [resetTarget, setResetTarget] = useState<{ id: string; username: string } | null>(null);
  const [resetPwd, setResetPwd] = useState('');
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await apiClient.listUsers();
      setUsers(list);
    } catch {
      setError(translate('fetchUsersFailed'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    setCreateError(null);
    if (!newUsername.trim()) { setValidationError(t('usernameRequired')); return; }
    if (newPassword.length < 6) { setValidationError(t('passwordMinLength')); return; }
    setCreating(true);
    try {
      await apiClient.createUser(newUsername.trim(), newPassword);
      setNewUsername(''); setNewPassword(''); setShowForm(false);
      await fetchUsers();
    } catch {
      setCreateError(translate('createUserFailed'));
    } finally { setCreating(false); }
  };

  const handleDelete = async (id: string, username: string) => {
    if (!window.confirm(tf('deleteUserConfirm', { username }))) return;
    try { await apiClient.deleteUser(id); await fetchUsers(); }
    catch { setError(translate('deleteUserFailed')); }
  };

  const handleToggleStatus = async (id: string, current: boolean) => {
    try { await apiClient.toggleUserStatus(id, !current); await fetchUsers(); }
    catch { setError(translate('toggleUserStatusFailed')); }
  };

  const handleResetPassword = async () => {
    if (!resetTarget) return;
    if (resetPwd.length < 6) { setResetError(t('passwordMinLength')); return; }
    setResetting(true); setResetError(null);
    try {
      await apiClient.resetUserPassword(resetTarget.id, resetPwd);
      setResetPwd(''); setResetTarget(null);
    } catch {
      setResetError(translate('resetPasswordFailed'));
    } finally { setResetting(false); }
  };

  return (
    <div>
      {/* Header + Add button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        {error && <div style={styles.error}>{error}</div>}
        <button
          style={{
            background: '#1d2a4b', border: '1px solid #2f4778', color: '#f17a8e',
            borderRadius: '8px', padding: '0.4rem 0.8rem', fontSize: '0.78rem',
            fontWeight: 600, cursor: 'pointer', marginLeft: 'auto',
          }}
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? t('cancel') : t('addUser')}
        </button>
      </div>

      {/* Create user form */}
      {showForm && (
        <div style={styles.card}>
          <form onSubmit={handleCreate}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <input style={styles.input} placeholder={t('username')} value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)} autoFocus />
              <input style={styles.input} type="password" placeholder={t('password')} value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            {validationError && <div style={styles.error}>{validationError}</div>}
            {createError && <div style={styles.error}>{createError}</div>}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="submit" style={{ ...styles.submitBtn, opacity: creating ? 0.5 : 1, cursor: creating ? 'not-allowed' : 'pointer' }} disabled={creating}>
                {creating ? '...' : t('create')}
              </button>
              <button type="button" style={styles.cancelBtn} onClick={() => { setShowForm(false); setCreateError(null); setValidationError(null); setNewUsername(''); setNewPassword(''); }}>
                {t('cancel')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* User list */}
      {loading && <p style={{ color: '#666', fontSize: '0.85rem' }}>{t('loadingUsers')}</p>}
      {!loading && users.length === 0 && <p style={{ color: '#666', fontSize: '0.85rem' }}>{t('noUsers')}</p>}
      {users.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>{t('username')}</th>
                <th style={styles.th}>{t('role')}</th>
                <th style={styles.th}>{t('status')}</th>
                <th style={styles.th}>{t('createdAt')}</th>
                <th style={styles.th}>{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td style={styles.td}>{u.username}</td>
                  <td style={styles.td}>{u.role}</td>
                  <td style={styles.td}>
                    <span style={{ ...styles.badge, ...(u.enabled ? styles.badgeEnabled : styles.badgeDisabled) }}>
                      {u.enabled ? t('enabled') : t('disabled')}
                    </span>
                  </td>
                  <td style={{ ...styles.td, color: '#65719c', fontSize: '0.78rem' }}>
                    {new Date(u.created_at * 1000).toLocaleString()}
                  </td>
                  <td style={styles.td}>
                    <button style={{ ...styles.actionBtn, ...styles.warnBtn }} onClick={() => setResetTarget({ id: u.id, username: u.username })}>
                      {t('resetPassword')}
                    </button>
                    <button style={{ ...styles.actionBtn, ...toggleBtnStyle }} onClick={() => handleToggleStatus(u.id, u.enabled)}>
                      {u.enabled ? t('disable') : t('enable')}
                    </button>
                    <button style={{ ...styles.actionBtn, ...styles.deleteBtn }} onClick={() => handleDelete(u.id, u.username)}>
                      {t('delete')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Password Reset Modal */}
      {resetTarget && (
        <div style={styles.overlay} onClick={() => setResetTarget(null)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>{tf('resetPasswordFor', { username: resetTarget.username })}</h3>
            <input style={styles.input} type="password" placeholder={t('newPasswordLabel')}
              value={resetPwd} onChange={(e) => setResetPwd(e.target.value)} autoFocus />
            {resetError && <div style={{ ...styles.error, marginTop: '0.5rem' }}>{resetError}</div>}
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
              <button style={{ ...styles.submitBtn, opacity: resetting ? 0.5 : 1, cursor: resetting ? 'not-allowed' : 'pointer' }}
                disabled={resetting} onClick={handleResetPassword}>
                {resetting ? '...' : t('resetPassword')}
              </button>
              <button style={styles.cancelBtn} onClick={() => { setResetTarget(null); setResetPwd(''); setResetError(null); }}>
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const toggleBtnStyle: React.CSSProperties = { color: '#f17a8e' };

// ── Devices Tab ──

function DevicesTab({ t, tf, isMobile }: { t: any; tf: any; isMobile: boolean }) {
  const [devices, setDevices] = useState<AdminDeviceResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDevices = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const list = await apiClient.listAllDevices();
      setDevices(list);
    } catch {
      setError(translate('fetchAllDevicesFailed'));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchDevices(); }, [fetchDevices]);

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(tf('adminDeviceDeleteConfirm', { name, id }))) return;
    try { await apiClient.adminDeleteDevice(id); await fetchDevices(); }
    catch { setError(translate('adminDeviceDeleteFailed')); }
  };

  return (
    <div>
      {error && <div style={styles.error}>{error}</div>}
      {loading && <p style={{ color: '#666', fontSize: '0.85rem' }}>{t('loadingDevices')}</p>}
      {!loading && devices.length === 0 && <p style={{ color: '#666', fontSize: '0.85rem' }}>{t('noDevices')}</p>}
      {devices.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>{t('deviceId')}</th>
                <th style={styles.th}>{t('deviceName')}</th>
                <th style={styles.th}>{t('version')}</th>
                <th style={styles.th}>{t('status')}</th>
                <th style={styles.th}>{t('lastSeen')}</th>
                <th style={styles.th}>{t('registeredAt')}</th>
                <th style={styles.th}>{t('userId')}</th>
                <th style={styles.th}>{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((d) => (
                <tr key={d.id}>
                  <td style={styles.tdMono}>{d.id}</td>
                  <td style={styles.td}>{d.name}</td>
                  <td style={styles.td}>{d.version}</td>
                  <td style={styles.td}>
                    <span style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                      <span style={{ ...styles.badge, ...(d.online ? styles.badgeOnline : styles.badgeOffline) }}>
                        {d.online ? t('online') : t('offline')}
                      </span>
                      {d.busy && <span style={{ ...styles.badge, ...styles.badgeBusy }}>{t('busy')}</span>}
                    </span>
                  </td>
                  <td style={{ ...styles.td, color: '#65719c', fontSize: '0.78rem' }}>
                    {new Date(d.last_seen * 1000).toLocaleString()}
                  </td>
                  <td style={{ ...styles.td, color: '#65719c', fontSize: '0.78rem' }}>
                    {new Date(d.registered_at * 1000).toLocaleString()}
                  </td>
                  <td style={styles.tdMono}>{d.user_id}</td>
                  <td style={styles.td}>
                    <button style={{ ...styles.actionBtn, ...styles.deleteBtn }} onClick={() => handleDelete(d.id, d.name)}>
                      {t('delete')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Sessions Tab ──

function SessionsTab({ t, tf, isMobile }: { t: any; tf: any; isMobile: boolean }) {
  const [sessions, setSessions] = useState<AdminSessionResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailTarget, setDetailTarget] = useState<string | null>(null);
  const [detail, setDetail] = useState<SessionDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const list = await apiClient.listAllSessions();
      setSessions(list);
    } catch {
      setError(translate('fetchAllSessionsFailed'));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  const openDetail = async (id: string) => {
    setDetailTarget(id);
    setDetailLoading(true);
    setDetail(null);
    setDetailError(null);
    try {
      const data = await apiClient.getSessionDetail(id);
      setDetail(data);
    } catch {
      setDetailError(translate('fetchSessionDetailFailed'));
    } finally { setDetailLoading(false); }
  };

  const statusBadge = (s: AdminSessionResponse) => {
    if (s.active) return { ...styles.badge, ...styles.badgeActive, label: t('sessionActive') };
    if (s.closed) return { ...styles.badge, ...styles.badgeClosed, label: t('sessionClosed') };
    return { ...styles.badge, ...styles.badgeClosed, label: t('sessionClosed') };
  };

  return (
    <div>
      {error && <div style={styles.error}>{error}</div>}
      {loading && <p style={{ color: '#666', fontSize: '0.85rem' }}>{t('loadingSessions')}</p>}
      {!loading && sessions.length === 0 && <p style={{ color: '#666', fontSize: '0.85rem' }}>{t('noSessionsYet')}</p>}
      {sessions.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>{t('sessionId')}</th>
                <th style={styles.th}>{t('deviceId')}</th>
                <th style={styles.th}>{t('userId')}</th>
                <th style={styles.th}>{t('createdAt')}</th>
                <th style={styles.th}>{t('status')}</th>
                <th style={styles.th}>{t('cwd')}</th>
                <th style={styles.th}>{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => {
                const badge = statusBadge(s);
                return (
                  <tr key={s.id}>
                    <td style={styles.tdMono}>{s.id}</td>
                    <td style={styles.tdMono}>{s.device_id}</td>
                    <td style={styles.tdMono}>{s.user_id}</td>
                    <td style={{ ...styles.td, color: '#65719c', fontSize: '0.78rem' }}>
                      {new Date(s.created_at * 1000).toLocaleString()}
                    </td>
                    <td style={styles.td}>
                      <span style={{ ...badge } as React.CSSProperties}>
                        {badge.label}
                      </span>
                    </td>
                    <td style={{ ...styles.td, color: '#65719c' }}>{s.cwd || '-'}</td>
                    <td style={styles.td}>
                      <button style={{ ...styles.actionBtn, ...styles.primaryBtn }} onClick={() => openDetail(s.id)}>
                        {t('viewDetail')}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Session Detail Modal */}
      {detailTarget && (
        <div style={styles.overlay} onClick={() => { setDetailTarget(null); setDetail(null); }}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>{t('sessionDetail')}</h3>
            {detailLoading && <p style={{ color: '#727ea6', fontSize: '0.85rem' }}>{t('loading')}</p>}
            {detailError && <div style={styles.error}>{detailError}</div>}
            {detail && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.4rem 1rem', fontSize: '0.82rem', marginBottom: '1rem' }}>
                  <span style={{ color: '#727ea6' }}>ID:</span>
                  <span style={{ color: '#c8cce0', fontFamily: 'monospace' }}>{detail.id}</span>
                  <span style={{ color: '#727ea6' }}>{t('deviceId')}:</span>
                  <span style={{ color: '#c8cce0', fontFamily: 'monospace' }}>{detail.device_id}</span>
                  <span style={{ color: '#727ea6' }}>{t('userId')}:</span>
                  <span style={{ color: '#c8cce0', fontFamily: 'monospace' }}>{detail.user_id}</span>
                  <span style={{ color: '#727ea6' }}>{t('createdAt')}:</span>
                  <span style={{ color: '#c8cce0' }}>{new Date(detail.created_at * 1000).toLocaleString()}</span>
                  <span style={{ color: '#727ea6' }}>{t('status')}:</span>
                  <span style={{ color: detail.active ? '#2ecc71' : '#95a5a6' }}>{detail.active ? t('sessionActive') : t('sessionClosed')}</span>
                  <span style={{ color: '#727ea6' }}>CWD:</span>
                  <span style={{ color: '#c8cce0' }}>{detail.cwd || '-'}</span>
                </div>
                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#e0e0e0' }}>{t('terminalHistory')}</h4>
                {detail.history ? (
                  <pre style={styles.pre}>{detail.history}</pre>
                ) : (
                  <p style={{ color: '#65719c', fontSize: '0.82rem' }}>{t('noHistory')}</p>
                )}
                <div style={{ marginTop: '1rem' }}>
                  <button style={styles.cancelBtn} onClick={() => { setDetailTarget(null); setDetail(null); }}>
                    {t('close')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
