import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { useI18n, translate } from '../i18n';
import { useIsMobile } from '../hooks/useIsMobile';
import type { UserResponse } from '../types/protocol';

export function AdminPage() {
  const { t, tf } = useI18n();
  const isMobile = useIsMobile(900);

  // User list
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create user form
  const [showForm, setShowForm] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

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

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || newPassword.length < 6) return;

    setCreating(true);
    setCreateError(null);
    try {
      await apiClient.createUser(newUsername.trim(), newPassword);
      setNewUsername('');
      setNewPassword('');
      setShowForm(false);
      await fetchUsers();
    } catch {
      setCreateError(translate('createUserFailed'));
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string, username: string) => {
    if (!window.confirm(tf('deleteUserConfirm', { username }))) return;
    try {
      await apiClient.deleteUser(id);
      await fetchUsers();
    } catch {
      setError(translate('deleteUserFailed'));
    }
  };

  const handleToggleStatus = async (id: string, current: boolean) => {
    try {
      await apiClient.toggleUserStatus(id, !current);
      await fetchUsers();
    } catch {
      setError(translate('toggleUserStatusFailed'));
    }
  };

  const styles: Record<string, React.CSSProperties> = {
    container: {
      padding: isMobile ? '0.9rem 0.75rem' : '1.5rem',
      overflow: 'auto',
      flex: 1,
      minWidth: 0,
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: '1rem',
    },
    title: {
      margin: 0,
      fontSize: isMobile ? '1.1rem' : '1.25rem',
      color: '#e0e0e0',
    },
    addBtn: {
      background: '#1d2a4b',
      border: '1px solid #2f4778',
      color: '#f17a8e',
      borderRadius: '8px',
      padding: '0.4rem 0.8rem',
      fontSize: '0.78rem',
      fontWeight: 600,
      cursor: 'pointer',
    },
    card: {
      background: '#141f36',
      border: '1px solid #1d2b50',
      borderRadius: '10px',
      padding: '1rem',
      marginBottom: '1rem',
    },
    formRow: {
      display: 'flex',
      flexDirection: isMobile ? 'column' : 'row',
      gap: '0.5rem',
      marginBottom: '0.5rem',
    },
    input: {
      flex: 1,
      background: '#0a0e1a',
      border: '1px solid #1d2b50',
      borderRadius: '6px',
      padding: '0.5rem 0.65rem',
      fontSize: '0.82rem',
      color: '#e0e0e0',
      outline: 'none',
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
    },
    td: {
      padding: '0.6rem 0.5rem',
      borderBottom: '1px solid #16213e',
      color: '#c8cce0',
    },
    badge: {
      display: 'inline-block',
      padding: '0.15rem 0.5rem',
      borderRadius: '999px',
      fontSize: '0.72rem',
      fontWeight: 600,
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
    toggleBtn: {
      color: '#f17a8e',
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
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>{t('admin')}</h2>
        <button
          style={styles.addBtn}
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? t('cancel') : t('addUser')}
        </button>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {/* Create user form */}
      {showForm && (
        <div style={styles.card}>
          <form onSubmit={handleCreate}>
            <div style={styles.formRow}>
              <input
                style={styles.input}
                placeholder={t('username')}
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                autoFocus
              />
              <input
                style={styles.input}
                type="password"
                placeholder={t('password')}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            {createError && <div style={styles.error}>{createError}</div>}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="submit"
                style={styles.submitBtn}
                disabled={creating || !newUsername.trim() || newPassword.length < 6}
              >
                {creating ? '...' : t('create')}
              </button>
              <button
                type="button"
                style={styles.cancelBtn}
                onClick={() => {
                  setShowForm(false);
                  setCreateError(null);
                  setNewUsername('');
                  setNewPassword('');
                }}
              >
                {t('cancel')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* User list */}
      {loading && (
        <p style={{ color: '#666', fontSize: '0.85rem' }}>{t('loadingUsers')}</p>
      )}

      {!loading && users.length === 0 && (
        <p style={{ color: '#666', fontSize: '0.85rem' }}>{t('noUsers')}</p>
      )}

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
                    <span
                      style={{
                        ...styles.badge,
                        ...(u.enabled ? styles.badgeEnabled : styles.badgeDisabled),
                      }}
                    >
                      {u.enabled ? t('enabled') : t('disabled')}
                    </span>
                  </td>
                  <td style={{ ...styles.td, color: '#65719c', fontSize: '0.78rem' }}>
                    {new Date(u.created_at * 1000).toLocaleString()}
                  </td>
                  <td style={styles.td}>
                    <button
                      style={{ ...styles.actionBtn, ...styles.toggleBtn }}
                      onClick={() => handleToggleStatus(u.id, u.enabled)}
                    >
                      {u.enabled ? t('disable') : t('enable')}
                    </button>
                    <button
                      style={{ ...styles.actionBtn, ...styles.deleteBtn }}
                      onClick={() => handleDelete(u.id, u.username)}
                    >
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
