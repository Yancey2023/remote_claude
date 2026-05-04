import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSessionStore } from './sessionStore';
import { apiClient } from '../api/client';

vi.mock('../api/client', () => ({
  apiClient: {
    listSessions: vi.fn(),
    createSession: vi.fn(),
    closeSession: vi.fn(),
  },
}));

const baseSessions = [
  { id: 's1', device_id: 'd1', user_id: 'u1', created_at: 1000, cwd: 'C:\\repo\\a' },
  { id: 's2', device_id: 'd1', user_id: 'u1', created_at: 1001, cwd: 'C:\\repo\\b' },
];

beforeEach(() => {
  useSessionStore.setState({ sessions: [], loading: false, error: null });
  vi.clearAllMocks();
});

describe('sessionStore', () => {
  it('fetches sessions into store', async () => {
    vi.mocked(apiClient.listSessions).mockResolvedValueOnce(baseSessions);

    await useSessionStore.getState().fetchSessions();

    const state = useSessionStore.getState();
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.sessions).toHaveLength(2);
    expect(state.sessions[0].id).toBe('s1');
  });

  it('sets error on fetch failure', async () => {
    vi.mocked(apiClient.listSessions).mockRejectedValueOnce(new Error('fetch failed'));

    await useSessionStore.getState().fetchSessions();

    expect(useSessionStore.getState().error).toBe('fetch failed');
    expect(useSessionStore.getState().loading).toBe(false);
  });

  it('does not set loading=true on background poll when sessions exist', async () => {
    useSessionStore.setState({ sessions: baseSessions });
    vi.mocked(apiClient.listSessions).mockResolvedValueOnce(baseSessions);

    const promise = useSessionStore.getState().fetchSessions();
    expect(useSessionStore.getState().loading).toBe(false);
    await promise;
    expect(useSessionStore.getState().loading).toBe(false);
  });

  it('sets loading=true on initial fetch when no sessions', async () => {
    vi.mocked(apiClient.listSessions).mockImplementationOnce(
      () => new Promise(() => {}),
    );

    useSessionStore.getState().fetchSessions();
    expect(useSessionStore.getState().loading).toBe(true);
    vi.mocked(apiClient.listSessions).mockReset();
    useSessionStore.setState({ loading: false });
  });

  it('creates session and refreshes list', async () => {
    vi.mocked(apiClient.createSession).mockResolvedValueOnce({ session_id: 's2', ws_url: '/ws/web' });
    vi.mocked(apiClient.listSessions).mockResolvedValueOnce(baseSessions);

    const created = await useSessionStore.getState().createSession('d1', 'C:\\repo\\b');

    expect(apiClient.createSession).toHaveBeenCalledWith('d1', 'C:\\repo\\b');
    expect(apiClient.listSessions).toHaveBeenCalledTimes(1);
    expect(created?.id).toBe('s2');
    expect(useSessionStore.getState().sessions).toHaveLength(2);
  });

  it('returns null and sets error when create fails', async () => {
    vi.mocked(apiClient.createSession).mockRejectedValueOnce(new Error('create failed'));

    const created = await useSessionStore.getState().createSession('d1');

    expect(created).toBeNull();
    expect(useSessionStore.getState().error).toBe('create failed');
  });

  it('deletes session from store', async () => {
    useSessionStore.setState({ sessions: baseSessions });
    vi.mocked(apiClient.closeSession).mockResolvedValueOnce({ message: 'ok' });

    await useSessionStore.getState().deleteSession('s1');

    expect(apiClient.closeSession).toHaveBeenCalledWith('s1');
    expect(useSessionStore.getState().sessions.map((s) => s.id)).toEqual(['s2']);
  });

  it('adds/removes sessions from websocket events', () => {
    useSessionStore.getState().addSessionFromWs({ session_id: 's3', device_id: 'd2', cwd: '/tmp' });
    useSessionStore.getState().addSessionFromWs({ session_id: 's3', device_id: 'd2', cwd: '/tmp' });

    const added = useSessionStore.getState().sessions;
    expect(added).toHaveLength(1);
    expect(added[0].id).toBe('s3');

    useSessionStore.getState().removeSessionFromWs('s3');
    expect(useSessionStore.getState().sessions).toHaveLength(0);
  });
});
