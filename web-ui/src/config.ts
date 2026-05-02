/// <reference types="vite/client" />

export interface AppConfig {
  /** API base URL (default: '' = same origin/Vite proxy) */
  apiBaseUrl: string;
  /** WebSocket base URL (default: '' = auto-detect from window.location) */
  wsBaseUrl: string;
  /** Device list polling interval in ms (default: 5000) */
  devicePollIntervalMs: number;
  /** WebSocket reconnect initial delay in ms (default: 1000) */
  wsReconnectDelayMs: number;
  /** WebSocket reconnect max delay in ms (default: 30000) */
  wsMaxReconnectDelayMs: number;
}

const DEFAULTS: AppConfig = {
  apiBaseUrl: '',
  wsBaseUrl: '',
  devicePollIntervalMs: 5000,
  wsReconnectDelayMs: 1000,
  wsMaxReconnectDelayMs: 30000,
};

let cached: AppConfig | null = null;

/** Load config with priority: /config.json > VITE_ env vars > hardcoded defaults */
export async function loadConfig(): Promise<AppConfig> {
  if (cached) return cached;

  const fileOverrides: Partial<AppConfig> = {};
  try {
    const res = await fetch('/config.json');
    if (res.ok) {
      const json = await res.json();
      Object.assign(fileOverrides, json);
    }
  } catch { /* config.json not available, use fallbacks */ }

  const env = import.meta.env;

  cached = {
    apiBaseUrl: fileOverrides.apiBaseUrl ?? (env.VITE_API_BASE_URL as string | undefined) ?? DEFAULTS.apiBaseUrl,
    wsBaseUrl: fileOverrides.wsBaseUrl ?? (env.VITE_WS_BASE_URL as string | undefined) ?? DEFAULTS.wsBaseUrl,
    devicePollIntervalMs: fileOverrides.devicePollIntervalMs ?? (Number(env.VITE_DEVICE_POLL_INTERVAL_MS) || DEFAULTS.devicePollIntervalMs),
    wsReconnectDelayMs: fileOverrides.wsReconnectDelayMs ?? (Number(env.VITE_WS_RECONNECT_DELAY_MS) || DEFAULTS.wsReconnectDelayMs),
    wsMaxReconnectDelayMs: fileOverrides.wsMaxReconnectDelayMs ?? (Number(env.VITE_WS_MAX_RECONNECT_DELAY_MS) || DEFAULTS.wsMaxReconnectDelayMs),
  };

  return cached;
}

/** Get already-loaded config. Throws if loadConfig() hasn't been called. */
export function getConfig(): AppConfig {
  if (!cached) throw new Error('Config not loaded. Call loadConfig() first.');
  return cached;
}
