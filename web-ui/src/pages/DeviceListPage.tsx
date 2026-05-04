import { useEffect, useState, useCallback } from 'react';
import { useDeviceStore } from '../stores/deviceStore';
import { DeviceCard } from '../components/DeviceCard';
import { apiClient } from '../api/client';
import { getConfig } from '../config';
import { translate, useI18n } from '../i18n';
import { useIsMobile } from '../hooks/useIsMobile';
import type { TokenResponse } from '../types/protocol';

function maskToken(token: string): string {
  if (token.length <= 12) return token;
  return token.slice(0, 8) + '...' + token.slice(-4);
}

export function DeviceListPage() {
  const { t } = useI18n();
  const devices = useDeviceStore((s) => s.devices);
  const loading = useDeviceStore((s) => s.loading);
  const error = useDeviceStore((s) => s.error);
  const fetchDevices = useDeviceStore((s) => s.fetchDevices);
  const isMobile = useIsMobile(900);

  // Token state
  const [tokens, setTokens] = useState<TokenResponse[]>([]);
  const [tokensLoading, setTokensLoading] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const fetchTokens = useCallback(async () => {
    setTokensLoading(true);
    setTokenError(null);
    try {
      const list = await apiClient.listTokens();
      setTokens(list);
    } catch {
      setTokenError(translate('tokenGenerateFailed'));
    } finally {
      setTokensLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDevices();
    fetchTokens();
    const interval = setInterval(fetchDevices, getConfig().devicePollIntervalMs);
    return () => clearInterval(interval);
  }, [fetchDevices, fetchTokens]);

  const handleGenerate = async () => {
    setGenerating(true);
    setTokenError(null);
    setNewToken(null);
    try {
      const res = await apiClient.createToken();
      setNewToken(res.token);
      // Refresh the token list
      await fetchTokens();
    } catch {
      setTokenError(translate('tokenGenerateFailed'));
    } finally {
      setGenerating(false);
    }
  };

  const handleDeleteToken = async (token: string) => {
    if (!window.confirm(t('tokenDeleteConfirm'))) return;
    try {
      await apiClient.deleteToken(token);
      await fetchTokens();
    } catch {
      setTokenError(translate('tokenDeleteFailed'));
    }
  };

  const handleCopy = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch {
      // Fallback for older browsers
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    }
  };

  return (
    <div style={{ padding: isMobile ? '0.9rem 0.75rem' : '1.5rem', overflow: 'auto', flex: 1, minWidth: 0 }}>
      {/* Token Section */}
      <div
        style={{
          background: '#141f36',
          border: '1px solid #1d2b50',
          borderRadius: '10px',
          padding: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <h3 style={{ margin: 0, fontSize: isMobile ? '1rem' : '1.1rem', color: '#e0e0e0' }}>
            {t('tokens')}
          </h3>
          <button
            onClick={handleGenerate}
            disabled={generating}
            style={{
              background: '#1d2a4b',
              border: '1px solid #2f4778',
              color: generating ? '#666' : '#f17a8e',
              borderRadius: '8px',
              padding: '0.4rem 0.8rem',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: generating ? 'not-allowed' : 'pointer',
            }}
          >
            {generating ? '...' : t('generateToken')}
          </button>
        </div>

        {tokenError && (
          <div style={{ color: '#e74c3c', fontSize: '0.82rem', marginBottom: '0.5rem' }}>{tokenError}</div>
        )}

        {newToken && (
          <div
            style={{
              background: 'rgba(46, 204, 113, 0.1)',
              border: '1px solid rgba(46, 204, 113, 0.3)',
              borderRadius: '8px',
              padding: '0.75rem',
              marginBottom: '0.75rem',
            }}
          >
            <div style={{ color: '#2ecc71', fontSize: '0.82rem', marginBottom: '0.4rem' }}>
              {t('tokenGenerated')}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <code
                style={{
                  flex: 1,
                  background: '#0a0e1a',
                  padding: '0.5rem 0.65rem',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                  color: '#b3b8d0',
                  wordBreak: 'break-all',
                  border: '1px solid #1d2b50',
                }}
              >
                {newToken}
              </code>
              <button
                onClick={() => handleCopy(newToken, -1)}
                style={{
                  background: copiedIndex === -1 ? '#1a6b3c' : '#1d2a4b',
                  border: `1px solid ${copiedIndex === -1 ? '#2ecc71' : '#2f4778'}`,
                  color: copiedIndex === -1 ? '#2ecc71' : '#f17a8e',
                  borderRadius: '6px',
                  padding: '0.4rem 0.7rem',
                  fontSize: '0.74rem',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                {copiedIndex === -1 ? t('tokenCopied') : t('tokenCopy')}
              </button>
            </div>
          </div>
        )}

        {/* Token list */}
        {tokensLoading && tokens.length === 0 && (
          <p style={{ color: '#666', fontSize: '0.85rem', margin: '0.5rem 0' }}>{t('loadingDevices')}</p>
        )}

        {!tokensLoading && tokens.length === 0 && !newToken && (
          <p style={{ color: '#666', fontSize: '0.85rem', margin: '0.5rem 0' }}>{t('noTokens')}</p>
        )}

        {tokens.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {tokens.map((tk, idx) => (
              <div
                key={tk.token}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.35rem 0.65rem',
                  background: '#0f1a30',
                  borderRadius: '6px',
                  border: '1px solid #182545',
                }}
              >
                <code style={{ flex: 1, fontSize: '0.8rem', color: '#8d95b8' }}>
                  {maskToken(tk.token)}
                </code>
                <span style={{ fontSize: '0.7rem', color: '#65719c', flexShrink: 0 }}>
                  {new Date(tk.created_at * 1000).toLocaleString()}
                </span>
                <button
                  onClick={() => handleCopy(tk.token, idx)}
                  style={{
                    background: copiedIndex === idx ? '#1a6b3c' : '#1d2a4b',
                    border: `1px solid ${copiedIndex === idx ? '#2ecc71' : '#2f4778'}`,
                    color: copiedIndex === idx ? '#2ecc71' : '#f17a8e',
                    borderRadius: '6px',
                    padding: '0.25rem 0.55rem',
                    fontSize: '0.7rem',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  {copiedIndex === idx ? t('tokenCopied') : t('tokenCopy')}
                </button>
                <button
                  onClick={() => handleDeleteToken(tk.token)}
                  title={t('tokenDelete')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#e74c3c',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    padding: '0.1rem 0.3rem',
                    opacity: 0.5,
                    flexShrink: 0,
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.5'; }}
                >
                  <span className="btn-icon-label">✕</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Device list */}
      <h2 style={{ margin: '0 0 1.1rem', fontSize: isMobile ? '1.1rem' : '1.25rem', color: '#e0e0e0' }}>
        {t('devices')}
      </h2>

      {error && (
        <div
          style={{
            background: 'rgba(231, 76, 60, 0.1)',
            color: '#e74c3c',
            padding: '0.75rem',
            borderRadius: '6px',
            marginBottom: '1rem',
          }}
        >
          {error}
        </div>
      )}

      {loading && devices.length === 0 && (
        <p style={{ color: '#666' }}>{t('loadingDevices')}</p>
      )}

      {!loading && devices.length === 0 && (
        <p style={{ color: '#666' }}>
          {t('noDevices')}
        </p>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: isMobile ? '0.75rem' : '1rem',
        }}
      >
        {devices.map((d) => (
          <DeviceCard key={d.id} device={d} />
        ))}
      </div>
    </div>
  );
}
