import { useState } from 'react';
import { apiClient, ApiClientError } from '../api/client';
import { useI18n, type I18nKey } from '../i18n';
import { showToast } from './Toast';

interface Props {
  onClose: () => void;
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.55)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
};

const dialogStyle: React.CSSProperties = {
  background: '#1a1a2e',
  border: '1px solid #1d2b50',
  borderRadius: '12px',
  padding: '1.5rem',
  width: 'min(90vw, 380px)',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.85rem',
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '1.05rem',
  color: '#e0e0e0',
  fontWeight: 700,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  background: '#0a0e1a',
  border: '1px solid #1d2b50',
  borderRadius: '6px',
  padding: '0.5rem 0.65rem',
  fontSize: '0.82rem',
  color: '#e0e0e0',
  outline: 'none',
};

const errorStyle: React.CSSProperties = {
  color: '#e74c3c',
  fontSize: '0.78rem',
};

const btnRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '0.5rem',
  justifyContent: 'flex-end',
  marginTop: '0.35rem',
};

const submitBtnStyle: React.CSSProperties = {
  background: '#1a6b3c',
  border: '1px solid #2ecc71',
  color: '#2ecc71',
  borderRadius: '6px',
  padding: '0.4rem 0.9rem',
  fontSize: '0.78rem',
  fontWeight: 600,
  cursor: 'pointer',
};

const cancelBtnStyle: React.CSSProperties = {
  background: '#2a1b34',
  border: '1px solid #5d2f4f',
  color: '#ff8694',
  borderRadius: '6px',
  padding: '0.4rem 0.9rem',
  fontSize: '0.78rem',
  cursor: 'pointer',
};

const knownErrorKeys: Record<string, I18nKey> = {
  'new password must be at least 6 characters': 'passwordMinLength',
  'new password too long': 'passwordTooLong',
  'password change not supported for this account type': 'passwordChangeNotSupported',
  'current password is incorrect': 'currentPasswordIncorrect',
};

function mapPasswordError(msg: string, t: (key: I18nKey) => string): string {
  const key = knownErrorKeys[msg];
  return key ? t(key) : msg;
}

export function ChangePasswordDialog({ onClose }: Props) {
  const { t } = useI18n();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 6) {
      setError(t('passwordMinLength'));
      return;
    }
    if (newPassword.length > 256) {
      setError(t('passwordTooLong'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t('passwordMismatch'));
      return;
    }

    setSaving(true);
    try {
      await apiClient.changePassword(currentPassword, newPassword);
      showToast(t('passwordChanged'), 'success');
      onClose();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(mapPasswordError(err.message, t));
      } else {
        setError(t('changePasswordFailed'));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div
        style={dialogStyle}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={t('changePassword')}
      >
        <h3 style={titleStyle}>{t('changePassword')}</h3>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <input
            style={inputStyle}
            type="password"
            placeholder={t('currentPassword')}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoFocus
          />
          <input
            style={inputStyle}
            type="password"
            placeholder={t('newPassword')}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <input
            style={inputStyle}
            type="password"
            placeholder={t('confirmPassword')}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          {error && <div style={errorStyle}>{error}</div>}
          <div style={btnRowStyle}>
            <button type="button" style={cancelBtnStyle} onClick={onClose}>
              {t('cancel')}
            </button>
            <button
              type="submit"
              style={{
                ...submitBtnStyle,
                opacity: saving ? 0.5 : 1,
                cursor: saving ? 'not-allowed' : 'pointer',
              }}
              disabled={saving}
            >
              {saving ? '...' : t('changePassword')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
