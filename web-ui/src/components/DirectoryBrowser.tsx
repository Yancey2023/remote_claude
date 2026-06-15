import { useEffect, useRef, useState, useCallback } from 'react';
import { getConfig } from '../config';
import { WebSocketClient } from '../api/ws';
import { useAuthStore } from '../stores/authStore';
import { useI18n } from '../i18n';

interface DirectoryEntry {
  name: string;
  is_dir: boolean;
  size?: number;
}

interface DirectoryBrowserProps {
  deviceId: string;
  initialPath?: string;
  onSelect: (path: string) => void;
  onClose: () => void;
}

export function DirectoryBrowser({ deviceId, initialPath, onSelect, onClose }: DirectoryBrowserProps) {
  const { t } = useI18n();
  const token = useAuthStore((s) => s.token);
  const [currentPath, setCurrentPath] = useState(initialPath || '');
  const [entries, setEntries] = useState<DirectoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const wsRef = useRef<WebSocketClient | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const requestListing = useCallback((ws: WebSocketClient, path: string) => {
    setLoading(true);
    setError(null);
    ws.send('list_directory', { device_id: deviceId, path });
  }, [deviceId]);

  useEffect(() => {
    if (!token) {
      setError('Not authenticated');
      setLoading(false);
      return;
    }

    const cfg = getConfig();
    const ws = new WebSocketClient(cfg.wsBaseUrl, token);
    wsRef.current = ws;

    const unsub = ws.on('directory_list', (payload) => {
      const data = payload as { path?: string; entries?: DirectoryEntry[]; error?: string };
      if (data.error) {
        setError(data.error);
        setLoading(false);
        return;
      }
      if (data.path !== undefined) {
        setCurrentPath(data.path);
      }
      setEntries(data.entries || []);
      setLoading(false);
    });

    ws.connect(() => {
      // On first connect, request the initial path
      requestListing(ws, initialPath || '');
    });

    return () => {
      unsub();
      ws.disconnect();
      wsRef.current = null;
    };
  }, [token, deviceId, initialPath, requestListing]);

  const navigateTo = useCallback((newPath: string) => {
    if (wsRef.current) {
      requestListing(wsRef.current, newPath);
    }
  }, [requestListing]);

  const handleEntryClick = useCallback((entry: DirectoryEntry) => {
    if (entry.name === '..') {
      // Go to parent directory
      const parent = currentPath.substring(0, currentPath.lastIndexOf('/')) || '/';
      // Handle Windows paths
      const winParent = currentPath.endsWith('\\')
        ? currentPath.substring(0, currentPath.length - 1)
        : currentPath.includes('\\')
          ? currentPath.substring(0, Math.max(currentPath.lastIndexOf('\\'), currentPath.lastIndexOf(':') + 2))
          : parent;
      navigateTo(currentPath.includes('\\') ? winParent : parent);
    } else if (entry.is_dir) {
      const separator = currentPath.includes('\\') ? '\\' : '/';
      const newPath = currentPath.endsWith(separator)
        ? `${currentPath}${entry.name}`
        : `${currentPath}${separator}${entry.name}`;
      navigateTo(newPath);
    } else {
      // Select file directly
      const separator = currentPath.includes('\\') ? '\\' : '/';
      const filePath = currentPath.endsWith(separator)
        ? `${currentPath}${entry.name}`
        : `${currentPath}${separator}${entry.name}`;
      setSelectedPath(filePath);
    }
  }, [currentPath, navigateTo]);

  const handleSelect = useCallback(() => {
    if (selectedPath) {
      onSelect(selectedPath);
    } else {
      onSelect(currentPath);
    }
  }, [selectedPath, currentPath, onSelect]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter' && selectedPath) {
      handleSelect();
    }
  }, [onClose, handleSelect, selectedPath]);

  useEffect(() => {
    // Focus the container for keyboard events
    containerRef.current?.focus();
  }, []);

  const isRoot = currentPath === '' || currentPath === '/' || /^[A-Z]:\\?$/i.test(currentPath);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={containerRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        style={{
          background: '#16213e',
          border: '1px solid #0f3460',
          borderRadius: '10px',
          width: 'min(90vw, 540px)',
          maxHeight: 'min(80vh, 500px)',
          display: 'flex',
          flexDirection: 'column',
          outline: 'none',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '0.85rem 1rem',
          borderBottom: '1px solid #0f3460',
          color: '#e0e0e0',
          fontSize: '0.9rem',
          fontWeight: 600,
        }}>
          {t('directoryBrowser')}
        </div>

        {/* Current path display + manual input */}
        <div style={{ padding: '0.6rem 1rem' }}>
          <div
            style={{
              background: '#0f0f23',
              border: '1px solid #1a1a3e',
              borderRadius: '6px',
              padding: '0.4rem 0.6rem',
              color: '#8ab4f8',
              fontSize: '0.8rem',
              fontFamily: 'monospace',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              cursor: 'text',
            }}
            title={currentPath || '/'}
            onClick={() => {
              // Allow editing by passing current path to a prompt
              const input = window.prompt(t('directoryPathPrompt'), currentPath || '/');
              if (input !== null && input.trim()) {
                navigateTo(input.trim());
              }
            }}
          >
            📁 {currentPath || '/'}
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div style={{
            padding: '0.6rem 1rem',
            color: '#e74c3c',
            fontSize: '0.8rem',
            textAlign: 'center',
          }}>
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{
            padding: '2rem',
            textAlign: 'center',
            color: '#666',
            fontSize: '0.85rem',
          }}>
            {t('loading')}
          </div>
        )}

        {/* Directory entries */}
        {!loading && !error && (
          <div style={{
            flex: 1,
            overflow: 'auto',
            padding: '0.25rem 0',
            minHeight: 0,
          }}>
            {/* Parent directory entry */}
            {!isRoot && (
              <div
                onClick={() => handleEntryClick({ name: '..', is_dir: true })}
                style={entryRowStyle(false)}
              >
                <span style={{ marginRight: '0.5rem' }}>📁</span>
                <span style={{ color: '#8ab4f8' }}>..</span>
              </div>
            )}

            {entries.map((entry) => {
              const fullPath = currentPath
                ? `${currentPath}${currentPath.includes('\\') ? '\\' : '/'}${entry.name}`
                : entry.name;
              const isSelected = selectedPath === fullPath;
              return (
                <div
                  key={entry.name}
                  onClick={() => handleEntryClick(entry)}
                  onDoubleClick={() => {
                    if (entry.is_dir) {
                      // Already navigated by single click
                    } else {
                      setSelectedPath(fullPath);
                      onSelect(fullPath);
                    }
                  }}
                  style={{
                    ...entryRowStyle(isSelected),
                    background: isSelected ? '#1a2a4b' : 'transparent',
                  }}
                >
                  <span style={{ marginRight: '0.5rem', flexShrink: 0 }}>
                    {entry.is_dir ? '📁' : '📄'}
                  </span>
                  <span style={{
                    color: entry.is_dir ? '#e0e0e0' : '#999',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {entry.name}
                  </span>
                  {!entry.is_dir && entry.size !== undefined && (
                    <span style={{
                      marginLeft: 'auto',
                      color: '#666',
                      fontSize: '0.75rem',
                      flexShrink: 0,
                      paddingLeft: '0.5rem',
                    }}>
                      {formatSize(entry.size)}
                    </span>
                  )}
                </div>
              );
            })}

            {entries.length === 0 && (
              <div style={{ padding: '1.5rem', textAlign: 'center', color: '#666', fontSize: '0.85rem' }}>
                {t('directoryEmpty')}
              </div>
            )}
          </div>
        )}

        {/* Footer actions */}
        <div style={{
          padding: '0.6rem 1rem',
          borderTop: '1px solid #0f3460',
          display: 'flex',
          gap: '0.5rem',
          justifyContent: 'flex-end',
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '0.4rem 0.85rem',
              background: 'none',
              border: '1px solid #2f4778',
              color: '#b0b8d0',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.8rem',
            }}
          >
            {t('cancel')}
          </button>
          <button
            onClick={handleSelect}
            disabled={loading}
            style={{
              padding: '0.4rem 0.85rem',
              background: '#e94560',
              border: 'none',
              color: 'white',
              borderRadius: '6px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '0.8rem',
              opacity: loading ? 0.5 : 1,
            }}
          >
            {t('selectDirectory')}
          </button>
        </div>
      </div>
    </div>
  );
}

function entryRowStyle(selected: boolean): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    padding: '0.35rem 1rem',
    cursor: 'pointer',
    fontSize: '0.85rem',
    background: selected ? '#1a2a4b' : 'transparent',
    transition: 'background 0.1s',
  };
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
