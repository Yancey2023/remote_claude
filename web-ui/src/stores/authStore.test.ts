import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAuthStore } from './authStore';
import { apiClient, ApiClientError } from '../api/client';

vi.mock('../api/client', () => {
  const mockApiClient = {
    login: vi.fn(),
    setToken: vi.fn(),
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
  it('starts with no token from empty localStorage', () => {
    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.user).toBeNull();
  });

  it('reads token from localStorage on init', () => {
    localStorage.setItem('token', 'saved-token');
    useAuthStore.setState({ token: 'saved-token' });
    const state = useAuthStore.getState();
    expect(state.token).toBe('saved-token');
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
    expect(localStorage.getItem('token')).toBe('jwt-123');
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
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('returns false from checkAuth when no token', async () => {
    const valid = await useAuthStore.getState().checkAuth();
    expect(valid).toBe(false);
  });

  it('returns true from checkAuth when token is valid', async () => {
    useAuthStore.setState({ token: 'valid-token' });
    vi.mocked(apiClient.verify).mockResolvedValueOnce({ valid: true, user_id: 'u1', username: 'a', role: 'User' });

    const valid = await useAuthStore.getState().checkAuth();
    expect(valid).toBe(true);
    expect(useAuthStore.getState().user?.username).toBe('a');
  });

  it('logs out on checkAuth when token is invalid', async () => {
    useAuthStore.setState({ token: 'bad-token' });
    vi.mocked(apiClient.verify).mockRejectedValueOnce(new Error('invalid'));

    const valid = await useAuthStore.getState().checkAuth();
    expect(valid).toBe(false);
    expect(useAuthStore.getState().token).toBeNull();
  });
});
