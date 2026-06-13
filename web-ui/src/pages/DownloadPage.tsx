import { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { useI18n } from '../i18n';
import { useIsMobile } from '../hooks/useIsMobile';
import type { DownloadFileInfo } from '../types/protocol';

type OsTab = 'linux' | 'windows' | 'macos';

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function detectOsTab(): OsTab {
  if (typeof navigator === 'undefined') return 'linux';
  const p = navigator.platform.toLowerCase();
  if (p.startsWith('win')) return 'windows';
  if (p.startsWith('mac')) return 'macos';
  return 'linux';
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

function PlatformLogo({ platform, size = 14 }: { platform: string | null; size?: number }) {
  const s = size;
  const common = { width: s, height: s, style: { verticalAlign: 'middle' as const, display: 'inline-block' as const } };
  switch (platform?.toLowerCase()) {
    case 'windows':
      return (
        <svg viewBox="0 0 16 16" {...common}>
          <path fill="currentColor" d="M7.5 2H2v5.5h5.5V2zm0 6.5H2V14h5.5V8.5zM14 2H8.5v5.5H14V2zm0 6.5H8.5V14H14V8.5z" />
        </svg>
      );
    case 'macos':
    case 'darwin':
      return (
        <svg viewBox="0 0 16 16" {...common}>
          <path fill="currentColor" d="M11.4 8.5c0-1.7.9-2.6 2.1-3.1-.8-1.1-2-1.8-3.3-1.9-1.4-.1-2.7.8-3.4.8-.7 0-1.9-.8-3.1-.8C2 3.6.7 5.1.7 8.2c0 1 .2 2 .6 3 .5 1.1 2.4 3.8 4.1 3.8.9 0 1.6-.6 2.7-.6s1.7.6 2.7.6c1.7 0 3.4-2.5 3.9-3.6-2.1-1-1.8-2.9-1.5-3.7zM9.1 2.5C9.9 1.6 9.9.8 9.9.6c-.6 0-1.3.4-1.7.9-.4.5-.7 1.2-.6 1.9.6.1 1.2-.3 1.5-.9z" />
        </svg>
      );
    case 'linux':
      return (
        <svg viewBox="0 0 16 16" {...common}>
          <path fill="currentColor" d="M9.88 1.3C9.14.85 8.27.8 7.46 1c-.83-.14-1.7.03-2.38.56l.28.43C4.5 2.43 4 3.1 4 4v.5H3C2.17 4.5 1.5 5.17 1.5 6v3c0 .55.45 1 1 1h1v2.5c0 .83.67 1.5 1.5 1.5h.17l.33 1h5l.33-1h.17c.83 0 1.5-.67 1.5-1.5V10h1c.55 0 1-.45 1-1V6c0-.83-.67-1.5-1.5-1.5h-1V4c0-.74-.33-1.36-.83-1.72l.25-.39c.4-.24.73-.55.96-.95l-.5-.34zM7 6h2v1.5c0 .28.22.5.5.5s.5-.22.5-.5V6h.5c.28 0 .5.22.5.5V8c0 .55-.45 1-1 1H6c-.55 0-1-.45-1-1V6.5c0-.28.22-.5.5-.5H6v1.5c0 .28.22.5.5.5s.5-.22.5-.5V6z" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 16 16" {...common}>
          <path fill="currentColor" d="M3 3v10h10V3H3zm9 9H4V4h8v8zM6 7h4v1H6V7zm0 2h4v1H6V9z" />
        </svg>
      );
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
  osTabRow: {
    display: 'flex',
    gap: '0.35rem',
    marginBottom: '0.75rem',
  } as const,
  osTab: {
    border: '1px solid #1d2b50',
    borderRadius: '6px',
    padding: '0.35rem 0.7rem',
    fontSize: '0.78rem',
    fontWeight: 600,
    cursor: 'pointer',
    background: 'transparent',
    color: '#8d95b8',
    transition: 'background 0.15s, color 0.15s, border-color 0.15s',
  } as const,
};

const OS_TABS: { key: OsTab; label: React.ReactNode }[] = [
  { key: 'windows', label: <><PlatformLogo platform="windows" /> Windows</> },
  { key: 'macos', label: <><PlatformLogo platform="macos" /> macOS</> },
  { key: 'linux', label: <><PlatformLogo platform="linux" /> Linux</> },
];

const OS_COMMANDS: Record<OsTab, string> = {
  linux: 'chmod +x desktop-client && ./desktop-client',
  windows: 'desktop-client.exe',
  macos: 'chmod +x desktop-client && ./desktop-client',
};

export function DownloadPage() {
  const { t } = useI18n();
  const isMobile = useIsMobile(900);
  const [files, setFiles] = useState<DownloadFileInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [osTab, setOsTab] = useState<OsTab>(detectOsTab);

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
                      <span style={{ marginRight: '0.35rem', display: 'inline-flex', verticalAlign: 'middle' }}>
                        <PlatformLogo platform={f.platform} />
                      </span>
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
            <div style={styles.osTabRow}>
              {OS_TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setOsTab(tab.key)}
                  style={{
                    ...styles.osTab,
                    background: osTab === tab.key ? '#1d2a4b' : 'transparent',
                    color: osTab === tab.key ? '#f17a8e' : '#8d95b8',
                    borderColor: osTab === tab.key ? '#2f4778' : '#1d2b50',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <code style={styles.code}>{OS_COMMANDS[osTab]}</code>
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
