import { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { useI18n } from '../i18n';
import { useIsMobile } from '../hooks/useIsMobile';
import type { DownloadFileInfo } from '../types/protocol';

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function isWindows(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /win(dows|32|64|16|ce)/i.test(navigator.platform);
}

function formatDate(iso: string): string {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function platformIcon(platform: string | null): string {
  switch (platform?.toLowerCase()) {
    case 'windows':
      return '⊞';
    case 'linux':
      return '🐧';
    case 'macos':
    case 'darwin':
      return '🍎';
    default:
      return '📦';
  }
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '1.5rem',
    overflow: 'auto',
    flex: 1,
    minWidth: 0,
  },
  section: {
    background: '#141f36',
    border: '1px solid #1d2b50',
    borderRadius: '10px',
    padding: '1rem',
    marginBottom: '1.5rem',
  },
  sectionTitle: {
    margin: '0 0 0.75rem',
    fontSize: '1.1rem',
    color: '#e0e0e0',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: '0.85rem',
  },
  th: {
    textAlign: 'left' as const,
    padding: '0.6rem 0.65rem',
    color: '#8d95b8',
    borderBottom: '1px solid #1d2b50',
    fontWeight: 600,
    whiteSpace: 'nowrap' as const,
  },
  td: {
    padding: '0.6rem 0.65rem',
    borderBottom: '1px solid #16213e',
    color: '#c8cce0',
  },
  downloadBtn: {
    background: '#1d2a4b',
    border: '1px solid #2f4778',
    color: '#f17a8e',
    borderRadius: '6px',
    padding: '0.35rem 0.7rem',
    fontSize: '0.76rem',
    fontWeight: 600,
    cursor: 'pointer',
    textDecoration: 'none',
    display: 'inline-block',
    whiteSpace: 'nowrap' as const,
  },
  helpCard: {
    background: '#0f1a30',
    border: '1px solid #182545',
    borderRadius: '8px',
    padding: '0.85rem',
    marginBottom: '0.6rem',
    fontSize: '0.85rem',
    color: '#b3bbd8',
    lineHeight: 1.6,
  },
  code: {
    background: '#0a0e1a',
    padding: '0.35rem 0.55rem',
    borderRadius: '4px',
    fontSize: '0.8rem',
    color: '#8fcbff',
    fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace',
  },
  stepNum: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    background: '#1d2a4b',
    color: '#f17a8e',
    fontSize: '0.72rem',
    fontWeight: 700,
    marginRight: '0.5rem',
    flexShrink: 0,
  },
  hint: {
    fontSize: '0.78rem',
    color: '#65719c',
    marginTop: '0.35rem',
  },
};

export function DownloadPage() {
  const { t, locale } = useI18n();
  const isMobile = useIsMobile(900);
  const [files, setFiles] = useState<DownloadFileInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiClient
      .listDownloads()
      .then((res) => {
        if (!cancelled) setFiles(res.files);
      })
      .catch(() => {
        if (!cancelled) setError(t('fetchDownloadsFailed'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  const containerStyle = isMobile
    ? { ...styles.container, padding: '0.9rem 0.75rem' }
    : styles.container;

  return (
    <div style={containerStyle}>
      <h2 style={{ margin: '0 0 1rem', fontSize: isMobile ? '1.1rem' : '1.25rem', color: '#e0e0e0' }}>
        {t('downloadTitle')}
      </h2>

      <p style={{ color: '#8d95b8', fontSize: '0.85rem', marginBottom: '1rem', lineHeight: 1.5 }}>
        {t('downloadDescription')}
      </p>

      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>{t('downloadClient')}</h3>

        {error && (
          <div style={{ color: '#e74c3c', fontSize: '0.82rem', marginBottom: '0.5rem' }}>{error}</div>
        )}

        {loading && <p style={{ color: '#666', fontSize: '0.85rem' }}>{t('loading')}</p>}

        {!loading && files.length === 0 && (
          <p style={{ color: '#666', fontSize: '0.85rem' }}>{t('noDownloads')}</p>
        )}

        {files.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>{t('downloadPlatform')}</th>
                  <th style={styles.th}>{t('downloadVersion')}</th>
                  <th style={styles.th}>{t('downloadArch')}</th>
                  <th style={styles.th}>{t('downloadSize')}</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>{/* Action */}</th>
                </tr>
              </thead>
              <tbody>
                {files.map((f) => (
                  <tr key={f.filename}>
                    <td style={styles.td}>
                      <span style={{ marginRight: '0.35rem' }}>{platformIcon(f.platform)}</span>
                      {f.platform || '-'}
                    </td>
                    <td style={{ ...styles.td, color: '#8fcbff', fontFamily: 'ui-monospace, monospace' }}>
                      {f.version || '-'}
                    </td>
                    <td style={styles.td}>{f.arch || '-'}</td>
                    <td style={{ ...styles.td, color: '#8d95b8' }}>{formatSize(f.size)}</td>
                    <td style={{ ...styles.td, textAlign: 'right' }}>
                      <a
                        href={apiClient.getDownloadUrl(f.filename)}
                        download={f.filename}
                        style={styles.downloadBtn}
                      >
                        {t('downloadFile')}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Help section */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>{t('downloadHelpTitle')}</h3>

        <div style={styles.helpCard}>
          <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
            <span style={styles.stepNum}>1</span>
            <span>{t('downloadHelpStep0')}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
            <span style={styles.stepNum}>2</span>
            <span>{t('downloadHelpStep1')}</span>
          </div>
          <div style={{ paddingLeft: '2.1rem', marginBottom: '0.6rem' }}>
            <code style={styles.code}>
              {isWindows() ? 'desktop-client.exe' : 'chmod +x desktop-client && ./desktop-client'}
            </code>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
            <span style={styles.stepNum}>3</span>
            <span>{t('downloadHelpStep2')}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start' }}>
            <span style={styles.stepNum}>4</span>
            <span>{t('downloadHelpStep3')}</span>
          </div>
          <div style={styles.hint}>{t('downloadHelpTokenHint')}</div>
        </div>
      </div>
    </div>
  );
}
