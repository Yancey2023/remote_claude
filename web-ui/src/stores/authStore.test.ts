import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAuthStore } from './authStore';
import { apiClient, ApiClientError } from '../api/client';

vi.mock('../api/client', () => {
  const mockApiClient = {
    login: vi.fn(),
    logout: vi.fn().mockResolvedValue(undefined),
    verify: vi.fn(),
  };
  return { apiClient: mockApiClient, ApiClientError: class extends Error { code = ''; status = 0; constructor(_code: string, message: string, _status: number) { super(message); } } };
});

beforeEach(() => {
  localStorage.clear();
  useAuthStore.setState({ token: null, user: null, loading: false, error: null });
});

describe('authStore', () => {
  it('starts with no token', () => {
    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.user).toBeNull();
  });

  it('sets token and user on successful login', async () => {
    const mockRes = { token: 'jwt-123', user_id: 'u1', username: 'alice', role: 'User' as const };
    vi.mocked(apiClient.login).mockResolvedValueOnce(mockRes);

    await useAuthStore.getState().login('alice', 'pass');

    const state = useAuthStore.getState();
    expect(state.token).toBe('jwt-123');
    expect(state.user?.username).toBe('alice');
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
    // Token is NOT persisted to localStorage
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('sets error on login failure', async () => {
    const err = new ApiClientError('ERR_AUTH', 'bad credentials', 401);
    vi.mocked(apiClient.login).mockRejectedValueOnce(err);

    await expect(useAuthStore.getState().login('alice', 'wrong')).rejects.toThrow();
    const state = useAuthStore.getState();
    expect(state.error).toBe('bad credentials');
    expect(state.loading).toBe(false);
    expect(state.token).toBeNull();
  });

  it('clears state on logout', () => {
    useAuthStore.setState({ token: 't', user: { user_id: 'u1', username: 'a', role: 'User' } });

    useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.user).toBeNull();
  });

  it('returns false from checkAuth when verify fails', async () => {
    vi.mocked(apiClient.verify).mockRejectedValueOnce(new Error('not authenticated'));
    const valid = await useAuthStore.getState().checkAuth();
    expect(valid).toBe(false);
  });

  it('returns true from checkAuth when verify succeeds and sets token', async () => {
    vi.mocked(apiClient.verify).mockResolvedValueOnce({
      valid: true, user_id: 'u1', username: 'a', role: 'User', token: 'session-token',
    });

    const valid = await useAuthStore.getState().checkAuth();
    expect(valid).toBe(true);
    expect(useAuthStore.getState().user?.username).toBe('a');
    expect(useAuthStore.getState().token).toBe('session-token');
  });

  it('clears state on checkAuth when verify fails', async () => {
    useAuthStore.setState({ token: 'bad-token', user: { user_id: 'u1', username: 'a', role: 'User' } });
    vi.mocked(apiClient.verify).mockRejectedValueOnce(new Error('invalid'));

    const valid = await useAuthStore.getState().checkAuth();
    expect(valid).toBe(false);
    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
  });
});
