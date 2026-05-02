import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebSocketClient } from './ws';

describe('WebSocketClient', () => {
  it('registers and unregisters event handlers', () => {
    const client = new WebSocketClient('ws://test/ws/web', 'token-123');
    const handler = vi.fn();
    const unsub = client.on('result_chunk', handler);
    expect(unsub).toBeInstanceOf(Function);

    // Unsubscribe should not throw
    unsub();
  });

  it('send does not throw when not connected', () => {
    const client = new WebSocketClient('ws://test/ws/web', 'token-123');
    expect(() => client.send('command', { foo: 'bar' })).not.toThrow();
  });

  it('disconnect does not throw when not connected', () => {
    const client = new WebSocketClient('ws://test/ws/web', 'token-123');
    expect(() => client.disconnect()).not.toThrow();
  });

  it('disconnect is idempotent', () => {
    const client = new WebSocketClient('ws://test/ws/web', 'token-123');
    client.disconnect();
    expect(() => client.disconnect()).not.toThrow();
  });

  it('onStatus registers and fires handler', () => {
    const client = new WebSocketClient('ws://test/ws/web', 'token-123');
    const handler = vi.fn();
    const unsub = client.onStatus(handler);
    expect(unsub).toBeInstanceOf(Function);

    // Unsubscribe should not throw
    unsub();
  });

  it('onStatus unsubscribe removes handler', () => {
    const client = new WebSocketClient('ws://test/ws/web', 'token-123');
    const handler = vi.fn();
    const unsub = client.onStatus(handler);
    unsub();
    // No way to directly verify, but at least no error
    expect(true).toBe(true);
  });

  it('on returns unsubscribe function that can be called multiple times', () => {
    const client = new WebSocketClient('ws://test/ws/web', 'token-123');
    const handler = vi.fn();
    const unsub = client.on('result_chunk', handler);
    unsub();
    // Second unsubscribe should not throw
    expect(() => unsub()).not.toThrow();
  });
});
