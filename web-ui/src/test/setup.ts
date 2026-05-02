import '@testing-library/jest-dom';
import { loadConfig } from '../config';

// Mock fetch so tests never make real HTTP requests during config loading
globalThis.fetch = vi.fn().mockRejectedValue(new Error('fetch not available in tests'));

// Pre-load config so getConfig() works in ApiClient / WebSocketClient.
// /config.json fetch will fail -> falls back to env vars -> hardcoded defaults.
await loadConfig();
