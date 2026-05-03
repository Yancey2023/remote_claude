import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './Layout';
import { useI18nStore } from '../i18n';

const mockNavigate = vi.fn();
const mockLogout = vi.fn();
const mockFetchSessions = vi.fn().mockResolvedValue(undefined);
const mockDeleteSession = vi.fn().mockResolvedValue(undefined);
let mockIsMobile = false;

const authState = {
  logout: mockLogout,
  user: { user_id: 'u1', username: 'alice', role: 'User' as const },
};

const sessionState = {
  sessions: [] as Array<{ id: string; device_id: string; user_id: string; created_at: number; cwd: string | null }>,
  fetchSessions: mockFetchSessions,
  deleteSession: mockDeleteSession,
};

const deviceState = {
  devices: [
    { id: 'd1', name: 'dev-box', version: '1.0.0', online: true, busy: false, last_seen: 1000 },
  ],
};

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../stores/authStore', () => ({
  useAuthStore: (selector: (s: typeof authState) => unknown) => selector(authState),
}));

vi.mock('../stores/sessionStore', () => ({
  useSessionStore: (selector: (s: typeof sessionState) => unknown) => selector(sessionState),
}));

vi.mock('../stores/deviceStore', () => ({
  useDeviceStore: (selector: (s: typeof deviceState) => unknown) => selector(deviceState),
}));

vi.mock('../hooks/useIsMobile', () => ({
  useIsMobile: () => mockIsMobile,
}));

vi.mock('./ConnectionOverlay', () => ({
  ConnectionOverlay: () => <div data-testid="connection-overlay" />,
}));

vi.mock('./Toast', () => ({
  ToastContainer: () => <div data-testid="toast-container" />,
}));

vi.mock('../config', () => ({
  getConfig: () => ({ devicePollIntervalMs: 10000 }),
}));

function renderLayout(path = '/devices/d1/sessions/s1') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/devices/:id" element={<Layout />}>
          <Route index element={<div>Session Index</div>} />
          <Route path="sessions/:sessionId" element={<div>Terminal Outlet</div>} />
        </Route>
        <Route path="/devices" element={<div>Device List</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mockIsMobile = false;
  mockNavigate.mockReset();
  mockLogout.mockReset();
  mockFetchSessions.mockClear();
  mockDeleteSession.mockReset();
  useI18nStore.setState({ locale: 'en' });
  sessionState.sessions = [];
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Layout', () => {
  it('renders desktop sidebar with sorted sessions and count', () => {
    sessionState.sessions = [
      { id: 's1', device_id: 'd1', user_id: 'u1', created_at: 1000, cwd: '/work/alpha' },
      { id: 's2', device_id: 'd1', user_id: 'u1', created_at: 2000, cwd: '/work/beta' },
      { id: 's3', device_id: 'd2', user_id: 'u1', created_at: 3000, cwd: '/other/gamma' },
    ];

    renderLayout('/devices/d1/sessions/s1');

    expect(screen.getByText('Remote Claude')).toBeTruthy();
    expect(screen.getByText('dev-box')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    expect(mockFetchSessions).toHaveBeenCalled();

    const beta = screen.getByText('beta');
    const alpha = screen.getByText('alpha');
    const relation = beta.compareDocumentPosition(alpha);
    expect(relation & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows mobile topbar and starts new session from top action', () => {
    mockIsMobile = true;
    sessionState.sessions = [
      { id: 's1', device_id: 'd1', user_id: 'u1', created_at: 1000, cwd: '/work/mobile' },
    ];

    renderLayout('/devices/d1/sessions/s1');

    expect(screen.getByLabelText('Open menu')).toBeTruthy();
    expect(screen.getByText('SESSIONS · s1')).toBeTruthy();

    const newBtns = screen.getAllByTitle('New session');
    fireEvent.click(newBtns[0]);
    expect(mockNavigate).toHaveBeenCalledWith('/devices/d1?new=1');
  });

  it('deletes current session and navigates back to device page', async () => {
    sessionState.sessions = [
      { id: 's1', device_id: 'd1', user_id: 'u1', created_at: 1000, cwd: '/work/current' },
    ];
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderLayout('/devices/d1/sessions/s1');

    fireEvent.click(screen.getByTitle('Close session'));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/devices/d1', { replace: true });
      expect(mockDeleteSession).toHaveBeenCalledWith('s1');
    });
  });
});
