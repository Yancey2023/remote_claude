import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useI18n } from '../i18n';

export function LoginPage() {
  const { locale, setLocale, t } = useI18n();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const login = useAuthStore((s) => s.login);
  const token = useAuthStore((s) => s.token);
  const loading = useAuthStore((s) => s.loading);
  const error = useAuthStore((s) => s.error);
  const navigate = useNavigate();

  useEffect(() => {
    if (token) navigate('/devices', { replace: true });
  }, [token, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;
    try {
      await login(username.trim(), password);
      navigate('/devices');
    } catch {
      // error is set in store
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: '#0f0f23',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          background: '#1a1a2e',
          padding: '2rem',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '360px',
          border: '1px solid #16213e',
        }}
      >
        <h1
          style={{
            color: '#e94560',
            fontSize: '1.5rem',
            marginBottom: '0.5rem',
            textAlign: 'center',
          }}
        >
          {t('appName')}
        </h1>
        <p
          style={{
            color: '#666',
            fontSize: '0.85rem',
            textAlign: 'center',
            marginBottom: '1.5rem',
          }}
        >
          {t('signInSubtitle')}
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.35rem', marginBottom: '1rem' }}>
          <button
            type="button"
            onClick={() => setLocale('en')}
            style={{
              background: 'none',
              border: '1px solid #16213e',
              color: locale === 'en' ? '#e94560' : '#888',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.75rem',
              padding: '0.15rem 0.45rem',
            }}
          >
            {t('languageEnglish')}
          </button>
          <button
            type="button"
            onClick={() => setLocale('zh')}
            style={{
              background: 'none',
              border: '1px solid #16213e',
              color: locale === 'zh' ? '#e94560' : '#888',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.75rem',
              padding: '0.15rem 0.45rem',
            }}
          >
            {t('languageChinese')}
          </button>
        </div>

        {error && (
          <div
            style={{
              background: 'rgba(231, 76, 60, 0.1)',
              color: '#e74c3c',
              padding: '0.5rem',
              borderRadius: '6px',
              fontSize: '0.8rem',
              marginBottom: '1rem',
              textAlign: 'center',
            }}
          >
            {error}
          </div>
        )}

        <div style={{ marginBottom: '1rem' }}>
          <label
            style={{
              display: 'block',
              color: '#a0a0a0',
              fontSize: '0.8rem',
              marginBottom: '0.3rem',
            }}
          >
            {t('username')}
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{
              width: '100%',
              padding: '0.6rem',
              background: '#0f0f23',
              border: '1px solid #16213e',
              borderRadius: '6px',
              color: '#e0e0e0',
              fontSize: '0.9rem',
              outline: 'none',
              boxSizing: 'border-box',
            }}
            disabled={loading}
            autoFocus
          />
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label
            style={{
              display: 'block',
              color: '#a0a0a0',
              fontSize: '0.8rem',
              marginBottom: '0.3rem',
            }}
          >
            {t('password')}
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              width: '100%',
              padding: '0.6rem',
              background: '#0f0f23',
              border: '1px solid #16213e',
              borderRadius: '6px',
              color: '#e0e0e0',
              fontSize: '0.9rem',
              outline: 'none',
              boxSizing: 'border-box',
            }}
            disabled={loading}
          />
        </div>

        <button
          type="submit"
          disabled={loading || !username.trim() || !password.trim()}
          style={{
            width: '100%',
            padding: '0.7rem',
            background: loading ? '#4a4a8a' : '#e94560',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '1rem',
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'background 0.2s',
          }}
        >
          {loading ? t('signingIn') : t('signIn')}
        </button>
      </form>
    </div>
  );
}
