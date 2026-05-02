import '@testing-library/jest-dom';
import { afterEach, vi } from 'vitest';
import { loadConfig } from '../config';

// ── Global mocks ────────────────────────────────────────────
// jsdom doesn't implement WebSocket; provide a stub matching the
// browser WebSocket API surface so code importing ws.ts doesn't explode.
class MockWebSocket {
  static OPEN = 1;
  static CLOSED = 3;

  readonly url: string;
  readyState: number = MockWebSocket.CLOSED;
  onopen: ((e: Event) => void) | null = null;
  onclose: ((e: CloseEvent) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  onmessage: ((e: MessageEvent) => void) | null = null;

  constructor(url: string) {
    this.url = url;
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.(new CloseEvent('close'));
  }

  send(_data: string) {
    // no-op
  }
}

const OrigWebSocket = globalThis.WebSocket;
globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;

// Prevent real HTTP requests. Individual tests override fetch with
// their own mocks — this is only a safety net so that any test that
// forgets to mock will fail fast with a clear message.
const defaultFetch = vi.fn().mockRejectedValue(
  new Error('network not available — mock fetch in your test'),
);
globalThis.fetch = defaultFetch;

// ── Config loading ──────────────────────────────────────────
// Pre-load config so getConfig() works in ApiClient / WebSocketClient
// without each test having to call loadConfig() individually.
// The /config.json fetch → rejected by the mock → falls back to defaults.
try {
  await loadConfig();
} catch (e) {
  throw new Error(`config loading failed in setup: ${e}`);
}

// ── Global cleanup ──────────────────────────────────────────
afterEach(() => {
  // Restore WebSocket mock in case a test stubbed it.
  if (!globalThis.WebSocket || globalThis.WebSocket === OrigWebSocket) {
    // keep the mock in place
  } else {
    globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;
  }
});
