import { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { useI18n } from '../i18n';
import { useIsMobile } from '../hooks/useIsMobile';
import type { DownloadFileInfo } from '../types/protocol';

type OsTab = 'windows' | 'macos' | 'linux';

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

function PlatformLogo({ platform, size = 14 }: { platform: string | null; size?: number }) {
  const s = size;
  const svgProps = {
    width: s,
    height: s,
    viewBox: '0 0 24 24',
    fill: 'none',
    style: { verticalAlign: 'middle' as const, display: 'inline-block' as const },
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
          <path fill="currentColor" d="M12.504 0c-.155 0-.315.008-.48.021-4.226.333-3.105 4.807-3.17 6.298-.076 1.092-.3 1.953-1.05 3.02-.885 1.051-2.127 2.75-2.716 4.521-.278.832-.41 1.684-.287 2.489a.424.424 0 00-.11.135c-.26.268-.45.6-.663.839-.199.199-.485.267-.797.4-.313.136-.658.269-.864.68-.09.189-.136.394-.132.602 0 .199.027.4.055.536.058.399.116.728.04.97-.249.68-.28 1.145-.106 1.484.174.334.535.47.94.601.81.2 1.91.135 2.774.6.926.466 1.866.67 2.616.47.526-.116.97-.464 1.208-.946.587-.003 1.23-.269 2.26-.334.699-.058 1.574.267 2.577.2.025.134.063.198.114.333l.003.003c.391.778 1.113 1.132 1.884 1.071.771-.06 1.592-.536 2.257-1.306.631-.765 1.683-1.084 2.378-1.503.348-.199.629-.469.649-.853.023-.4-.2-.811-.714-1.376v-.097l-.003-.003c-.17-.2-.25-.535-.338-.926-.085-.401-.182-.786-.492-1.046h-.003c-.059-.054-.123-.067-.188-.135a.357.357 0 00-.19-.064c.431-1.278.264-2.55-.173-3.694-.533-1.41-1.465-2.638-2.175-3.483-.796-1.005-1.576-1.957-1.56-3.368.026-2.152.236-6.133-3.544-6.139zm.529 3.405h.013c.213 0 .396.062.584.198.19.135.33.332.438.533.105.259.158.459.166.724 0-.02.006-.04.006-.06v.105a.086.086 0 01-.004-.021l-.004-.024a1.807 1.807 0 01-.15.706.953.953 0 01-.213.335.71.71 0 00-.088-.042c-.104-.045-.198-.064-.284-.133a1.312 1.312 0 00-.22-.066c.05-.06.146-.133.183-.198.053-.128.082-.264.088-.402v-.02a1.21 1.21 0 00-.061-.4c-.045-.134-.101-.2-.183-.333-.084-.066-.167-.132-.267-.132h-.016c-.093 0-.176.03-.262.132a.8.8 0 00-.205.334 1.18 1.18 0 00-.09.4v.019c.002.089.008.179.02.267-.193-.067-.438-.135-.607-.202a1.635 1.635 0 01-.018-.2v-.02a1.772 1.772 0 01.15-.768c.082-.22.232-.406.43-.533a.985.985 0 01.594-.2zm-2.962.059h.036c.142 0 .27.048.399.135.146.129.264.288.344.465.09.199.14.4.153.667v.004c.007.134.006.2-.002.266v.08c-.03.007-.056.018-.083.024-.152.055-.274.135-.393.2.012-.09.013-.18.003-.267v-.015c-.012-.133-.04-.2-.082-.333a.613.613 0 00-.166-.267.248.248 0 00-.183-.064h-.021c-.071.006-.13.04-.186.132a.552.552 0 00-.12.27.944.944 0 00-.023.33v.015c.012.135.037.2.08.334.046.134.098.2.166.268.01.009.02.018.034.024-.07.057-.117.07-.176.136a.304.304 0 01-.131.068 2.62 2.62 0 01-.275-.402 1.772 1.772 0 01-.155-.667 1.759 1.759 0 01.08-.668 1.43 1.43 0 01.283-.535c.128-.133.26-.2.418-.2zm1.37 1.706c.332 0 .733.065 1.216.399.293.2.523.269 1.052.468h.003c.255.136.405.266.478.399v-.131a.571.571 0 01.016.47c-.123.31-.516.643-1.063.842v.002c-.268.135-.501.333-.775.465-.276.135-.588.292-1.012.267a1.139 1.139 0 01-.448-.067 3.566 3.566 0 01-.322-.198c-.195-.135-.363-.332-.612-.465v-.005h-.005c-.4-.246-.616-.512-.686-.71-.07-.268-.005-.47.193-.6.224-.135.38-.271.483-.336.104-.074.143-.102.176-.131h.002v-.003c.169-.202.436-.47.839-.601.139-.036.294-.065.466-.065zm2.8 2.142c.358 1.417 1.196 3.475 1.735 4.473.286.534.855 1.659 1.102 3.024.156-.005.33.018.513.064.646-1.671-.546-3.467-1.089-3.966-.22-.2-.232-.335-.123-.335.59.534 1.365 1.572 1.646 2.757.13.535.16 1.104.021 1.67.067.028.135.06.205.067 1.032.534 1.413.938 1.23 1.537v-.043c-.06-.003-.12 0-.18 0h-.016c.151-.467-.182-.825-1.065-1.224-.915-.4-1.646-.336-1.77.465-.008.043-.013.066-.018.135-.068.023-.139.053-.209.064-.43.268-.662.669-.793 1.187-.13.533-.17 1.156-.205 1.869v.003c-.02.334-.17.838-.319 1.35-1.5 1.072-3.58 1.538-5.348.334a2.645 2.645 0 00-.402-.533 1.45 1.45 0 00-.275-.333c.182 0 .338-.03.465-.067a.615.615 0 00.314-.334c.108-.267 0-.697-.345-1.163-.345-.467-.931-.995-1.788-1.521-.63-.4-.986-.87-1.15-1.396-.165-.534-.143-1.085-.015-1.645.245-1.07.873-2.11 1.274-2.763.107-.065.037.135-.408.974-.396.751-1.14 2.497-.122 3.854a8.123 8.123 0 01.647-2.876c.564-1.278 1.743-3.504 1.836-5.268.048.036.217.135.289.202.218.133.38.333.59.465.21.201.477.335.876.335.039.003.075.006.11.006.412 0 .73-.134.997-.268.29-.134.52-.334.74-.4h.005c.467-.135.835-.402 1.044-.7zm2.185 8.958c.037.6.343 1.245.882 1.377.588.134 1.434-.333 1.791-.765l.211-.01c.315-.007.577.01.847.268l.003.003c.208.199.305.53.391.876.085.4.154.78.409 1.066.486.527.645.906.636 1.14l.003-.007v.018l-.003-.012c-.015.262-.185.396-.498.595-.63.401-1.746.712-2.457 1.57-.618.737-1.37 1.14-2.036 1.191-.664.053-1.237-.2-1.574-.898l-.005-.003c-.21-.4-.12-1.025.056-1.69.176-.668.428-1.344.463-1.897.037-.714.076-1.335.195-1.814.12-.465.308-.797.641-.984l.045-.022zm-10.814.049h.01c.053 0 .105.005.157.014.376.055.706.333 1.023.752l.91 1.664.003.003c.243.533.754 1.064 1.189 1.637.434.598.77 1.131.729 1.57v.006c-.057.744-.48 1.148-1.125 1.294-.645.135-1.52.002-2.395-.464-.968-.536-2.118-.469-2.857-.602-.369-.066-.61-.2-.723-.4-.11-.2-.113-.602.123-1.23v-.004l.002-.003c.117-.334.03-.752-.027-1.118-.055-.401-.083-.71.043-.94.16-.334.396-.4.69-.533.294-.135.64-.202.915-.47h.002v-.002c.256-.268.445-.601.668-.838.19-.201.38-.336.663-.336z" />
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

const OS_TABS: OsTab[] = ['windows', 'macos', 'linux'];

const OS_TAB_LABEL: Record<OsTab, React.ReactNode> = {
  windows: <><PlatformLogo platform="windows" /> Windows</>,
  macos: <><PlatformLogo platform="macos" /> MacOS</>,
  linux: <><PlatformLogo platform="linux" /> Linux</>,
};

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
                {[...files].sort((a, b) => comparePlatform(a.platform, b.platform)).map((f) => (
                  <tr key={f.filename}>
                    <td style={styles.td}>
                      <span style={{ marginRight: '0.35rem', display: 'inline-flex', verticalAlign: 'middle' }}>
                        <PlatformLogo platform={f.platform} />
                      </span>
                      {platformDisplayName(f.platform)}
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
              {OS_TABS.map((key) => (
                <button
                  key={key}
                  onClick={() => setOsTab(key)}
                  style={{
                    ...styles.osTab,
                    background: osTab === key ? '#1d2a4b' : 'transparent',
                    color: osTab === key ? '#f17a8e' : '#8d95b8',
                    borderColor: osTab === key ? '#2f4778' : '#1d2b50',
                  }}
                >
                  {OS_TAB_LABEL[key]}
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
