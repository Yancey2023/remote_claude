/// <reference types="vite/client" />

export interface AppConfig {
  apiBaseUrl: string;
  wsBaseUrl: string;
  devicePollIntervalMs: number;
  wsReconnectDelayMs: number;
  wsMaxReconnectDelayMs: number;
}

export const BASE_URL = import.meta.env.VITE_BASE_URL ?? '';

const config: AppConfig = {
  apiBaseUrl: BASE_URL + '/api',
  wsBaseUrl: BASE_URL + '/ws',
  devicePollIntervalMs: Number(import.meta.env.VITE_DEVICE_POLL_INTERVAL_MS) || 30000,
  wsReconnectDelayMs: Number(import.meta.env.VITE_WS_RECONNECT_DELAY_MS) || 1000,
  wsMaxReconnectDelayMs: Number(import.meta.env.VITE_WS_MAX_RECONNECT_DELAY_MS) || 30000,
};

export function getConfig(): AppConfig {
  return config;
}
