import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import { getConfig } from '../config';
import { useI18n } from '../i18n';
import { useIsMobile } from '../hooks/useIsMobile';
import type { DownloadFileInfo } from '../types/protocol';

const CLIENT_VERSION = import.meta.env.VITE_CLIENT_VERSION;
if (!CLIENT_VERSION) throw new Error('VITE_CLIENT_VERSION is not set');

const DOWNLOADS: DownloadFileInfo[] = [
  { filename: `remote-claude-desktop-client-v${CLIENT_VERSION}-linux-x64`,       size: 0, modified: '', platform: 'linux',   arch: 'x64',   version: CLIENT_VERSION },
  { filename: `remote-claude-desktop-client-v${CLIENT_VERSION}-linux-arm64`,     size: 0, modified: '', platform: 'linux',   arch: 'arm64', version: CLIENT_VERSION },
  { filename: `remote-claude-desktop-client-v${CLIENT_VERSION}-windows-x64.exe`, size: 0, modified: '', platform: 'windows', arch: 'x64',   version: CLIENT_VERSION },
  { filename: `remote-claude-desktop-client-v${CLIENT_VERSION}-windows-arm64.exe`,size: 0, modified: '', platform: 'windows', arch: 'arm64', version: CLIENT_VERSION },
  { filename: `remote-claude-desktop-client-v${CLIENT_VERSION}-darwin-arm64`,    size: 0, modified: '', platform: 'darwin',  arch: 'arm64', version: CLIENT_VERSION },
];

const PLATFORM_DISPLAY: Record<string, string> = {
  windows: 'Windows',
  darwin: 'MacOS',
  macos: 'MacOS',
  linux: 'Linux',
};

const PLATFORM_ORDER: Record<string, number> = {
  windows: 0,
  darwin: 1,
  macos: 1,
  linux: 2,
};

function platformDisplayName(platform: string | null): string {
  if (!platform) return '-';
  return PLATFORM_DISPLAY[platform.toLowerCase()] ?? platform;
}

function comparePlatform(a: string | null, b: string | null): number {
  const ai = PLATFORM_ORDER[a?.toLowerCase() ?? ''] ?? 99;
  const bi = PLATFORM_ORDER[b?.toLowerCase() ?? ''] ?? 99;
  return ai - bi;
}

function PlatformLogo({ platform, size = 14 }: { platform: string | null; size?: number }) {
  const s = size;
  const svgProps = {
    width: s,
    height: s,
    viewBox: '0 0 24 24',
    fill: 'none',
    style: { verticalAlign: 'middle' as const, display: 'inline-block' as const, marginRight: '0.3rem' } as const,
  };
  switch (platform?.toLowerCase()) {
    case 'windows':
      return (
        <svg {...svgProps}>
          <path fill="currentColor" d="M0,0H11.377V11.372H0ZM12.623,0H24V11.372H12.623ZM0,12.623H11.377V24H0Zm12.623,0H24V24H12.623" />
        </svg>
      );
    case 'macos':
    case 'darwin':
      return (
        <svg {...svgProps}>
          <path fill="currentColor" d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
        </svg>
      );
    case 'linux':
      return (
        <svg {...svgProps}>
          <path fill="currentColor" d="M12.504 0c-.155 0-.315.008-.48.021-4.226.333-3.105 4.807-3.17 6.298-.076 1.092-.3 1.953-1.05 3.02-.885 1.051-2.127 2.75-2.716 4.521-.278.832-.41 1.684-.287 2.489a.424.424 0 00-.11.135c-.26.268-.45.6-.663.839-.199.199-.485.267-.797.4-.313.136-.658.269-.864.68-.09.189-.136.394-.132.602 0 .199.027.4.055.536.058.399.116.728.04.97-.249.68-.28 1.145-.106 1.484.174.334.535.47.94.601.81.2 1.91.135 2.774.6.926.466 1.866.67 2.616.47.526-.116.97-.464 1.208-.946.587-.003 1.23-.269 2.26-.334.699-.058 1.574.267 2.577.2.025.134.063.198.114.333l.003.003c.391.778 1.113 1.132 1.884 1.071.771-.06 1.592-.536 2.257-1.306.631-.765 1.683-1.084 2.378-1.503.348-.199.629-.469.649-.853.023-.4-.2-.811-.714-1.376v-.097l-.003-.003c-.17-.2-.25-.535-.338-.926-.085-.401-.182-.786-.492-1.046h-.003c-.059-.054-.123-.067-.188-.135a.357.357 0 00-.19-.064c.431-1.278.264-2.55-.173-3.694-.533-1.41-1.465-2.638-2.175-3.483-.796-1.005-1.576-1.957-1.56-3.368.026-2.152.236-6.133-3.544-6.139z" />
        </svg>
      );
    default:
      return (
        <svg {...svgProps}>
          <path fill="currentColor" d="M3 3v18h18V3H3zm16 16H5V5h14v14z" />
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
};

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function runCommand(file: DownloadFileInfo): string {
  const isWindows = file.platform?.toLowerCase() === 'windows';
  if (isWindows) return file.filename;
  return `chmod +x ${file.filename} && ./${file.filename}`;
}

function downloadUrl(filename: string): string {
  return `${getConfig().apiBaseUrl}/downloads/${encodeURIComponent(filename)}`;
}

const sortedBase = [...DOWNLOADS].sort((a, b) => comparePlatform(a.platform, b.platform));

export function DownloadPage() {
  const { t } = useI18n();
  const isMobile = useIsMobile(900);
  const [files, setFiles] = useState(sortedBase);
  const [fileTab, setFileTab] = useState(0);

  // Fetch real file sizes from server, fall back to 0 on failure
  useEffect(() => {
    let cancelled = false;
    apiClient.fetchDownloadSizes()
      .then((sizes) => {
        if (cancelled) return;
        setFiles(sortedBase.map((f) => ({
          ...f,
          size: sizes[f.filename] ?? 0,
        })));
      })
      .catch(() => {
        // Sizes stay 0 — non-critical
      });
    return () => { cancelled = true; };
  }, []);

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
                    <PlatformLogo platform={f.platform} />
                    {platformDisplayName(f.platform)}
                  </td>
                  <td style={{ ...styles.td, color: '#8fcbff', fontFamily: 'ui-monospace, monospace' }}>
                    {f.version || '-'}
                  </td>
                  <td style={styles.td}>{f.arch || '-'}</td>
                  <td style={{ ...styles.td, color: '#8d95b8' }}>{formatSize(f.size)}</td>
                  <td style={{ ...styles.td, textAlign: 'right' }}>
                    <a
                      href={downloadUrl(f.filename)}
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

          {/* File tabs with per-file run command */}
          <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '0.5rem', paddingLeft: '2.1rem', flexWrap: 'wrap' }}>
            {files.map((f, idx) => (
              <button
                key={f.filename}
                onClick={() => setFileTab(idx)}
                style={{
                  border: '1px solid ' + (fileTab === idx ? '#2f4778' : '#1d2b50'),
                  borderRadius: '6px',
                  padding: '0.35rem 0.7rem',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: fileTab === idx ? '#1d2a4b' : 'transparent',
                  color: fileTab === idx ? '#f17a8e' : '#8d95b8',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                }}
              >
                <PlatformLogo platform={f.platform} size={12} />
                {platformDisplayName(f.platform)} {f.arch || ''}
              </button>
            ))}
          </div>
          <div style={{ paddingLeft: '2.1rem', marginBottom: '0.6rem' }}>
            <code style={styles.code}>{runCommand(files[fileTab])}</code>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
            <span style={styles.stepNum}>3</span>
            <span>{t('downloadHelpStep2')}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
            <span style={styles.stepNum}>4</span>
            <span>
              {t('downloadHelpStep3')}
              {' '}
              <Link to="/devices" style={{ color: '#8fcbff', textDecoration: 'underline' }}>{t('downloadHelpStep3Link')}</Link>
              {t('downloadHelpStep3Suffix') && <>{' '}{t('downloadHelpStep3Suffix')}</>}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start' }}>
            <span style={styles.stepNum}>5</span>
            <span>
              {t('downloadHelpStep4')}
              {' '}
              <Link to="/devices" style={{ color: '#8fcbff', textDecoration: 'underline' }}>{t('downloadHelpStep4Link')}</Link>
              {' '}
              {t('downloadHelpStep4Suffix')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
