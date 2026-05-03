import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient, ApiClientError } from './client';

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
  apiClient.setToken(null);
});

function mockResponse(status: number, body: unknown) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 401 ? 'Unauthorized' : 'Error',
    json: () => Promise.resolve(body),
  });
}

describe('apiClient', () => {
  describe('login', () => {
    it('sends POST to /api/auth/login with credentials', async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse(200, { token: 'jwt-1', user_id: 'u1', username: 'alice', role: 'User' }),
      );

      const res = await apiClient.login({ username: 'alice', password: 'pass' });

      expect(res.token).toBe('jwt-1');
      expect(res.username).toBe('alice');
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/auth/login',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ username: 'alice', password: 'pass' }),
        }),
      );
    });

    it('throws ApiClientError on 401', async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse(401, { code: 'ERR_UNAUTHORIZED', message: 'invalid credentials' }),
      );

      await expect(apiClient.login({ username: 'alice', password: 'wrong' })).rejects.toThrow(ApiClientError);
    });

    it('throws ApiClientError on 400', async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse(400, { code: 'ERR_BAD_REQUEST', message: 'missing fields' }),
      );

      await expect(apiClient.login({ username: '', password: '' })).rejects.toThrow(ApiClientError);
    });
  });

  describe('authorized requests', () => {
    it('includes Bearer token when set', async () => {
      apiClient.setToken('my-token');
      mockFetch.mockResolvedValueOnce(mockResponse(200, []));

      await apiClient.listDevices();

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/devices',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer my-token',
          }),
        }),
      );
    });

    it('omits Authorization header when no token', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(200, []));
      apiClient.setToken(null);

      await apiClient.listDevices();

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers.Authorization).toBeUndefined();
    });
  });

  describe('listDevices', () => {
    it('returns device list', async () => {
      const mockDevices = [
        { id: 'd1', name: 'pc-1', version: '1.0', online: true, busy: false, last_seen: 1000 },
      ];
      mockFetch.mockResolvedValueOnce(mockResponse(200, mockDevices));

      const devices = await apiClient.listDevices();
      expect(devices).toHaveLength(1);
      expect(devices[0].name).toBe('pc-1');
    });
  });

  describe('sessions', () => {
    it('creates session and returns id', async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse(200, { session_id: 's1', ws_url: '/ws/web' }),
      );

      const res = await apiClient.createSession('d1');
      expect(res.session_id).toBe('s1');
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/sessions',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ device_id: 'd1', cwd: null }),
        }),
      );
    });

    it('closes session', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(200, { message: 'closed' }));

      await apiClient.closeSession('s1');
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/sessions/s1',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });

  describe('verify', () => {
    it('returns verification result', async () => {
      apiClient.setToken('my-token');
      mockFetch.mockResolvedValueOnce(
        mockResponse(200, { valid: true, user_id: 'u1', username: 'alice', role: 'User' }),
      );

      const res = await apiClient.verify();
      expect(res.valid).toBe(true);
    });
  });

  describe('logout', () => {
    it('sends POST to /api/auth/logout', async () => {
      apiClient.setToken('t');
      mockFetch.mockResolvedValueOnce(mockResponse(200, { message: 'logged out' }));

      await apiClient.logout();
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/auth/logout',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });
});
