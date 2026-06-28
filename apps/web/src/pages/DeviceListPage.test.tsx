import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { DeviceListPage } from './DeviceListPage';
import { useI18nStore } from '../i18n';

const mockFetchDevices = vi.fn().mockResolvedValue(undefined);
const mockFetchTokens = vi.fn();
const mockCreateToken = vi.fn();
const mockListTokens = vi.fn();
const mockDeleteToken = vi.fn();
let mockDevices: Array<{ id: string; name: string; version: string; online: boolean; busy: boolean; last_seen: number }> = [];
let mockTokens: Array<{ token: string; created_at: number }> = [];
let mockDeviceLoading = false;
let mockDeviceError: string | null = null;

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => vi.fn() };
});

vi.mock('../stores/authStore', () => ({
  useAuthStore: () => ({ token: 'jwt-1' }),
}));

vi.mock('../stores/deviceStore', () => ({
  useDeviceStore: (selector: (s: any) => any) =>
    selector({
      devices: mockDevices,
      loading: mockDeviceLoading,
      error: mockDeviceError,
      fetchDevices: mockFetchDevices,
      deleteDevice: vi.fn(),
    }),
}));

vi.mock('../api/client', () => ({
  apiClient: {
    createToken: (...args: unknown[]) => mockCreateToken(...args),
    listTokens: (...args: unknown[]) => mockListTokens(...args),
    deleteToken: (...args: unknown[]) => mockDeleteToken(...args),
  },
}));

vi.mock('../hooks/useIsMobile', () => ({
  useIsMobile: () => false,
}));

vi.mock('../components/DeviceCard', () => ({
  DeviceCard: ({ device }: { device: { id: string; name: string } }) => (
    <div data-testid="device-card">{device.name}</div>
  ),
}));

vi.mock('../config', () => ({
  getConfig: () => ({ devicePollIntervalMs: 5000 }),
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <DeviceListPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mockDevices = [];
  mockTokens = [];
  mockDeviceLoading = false;
  mockDeviceError = null;
  mockFetchDevices.mockResolvedValue(undefined);
  mockListTokens.mockResolvedValue([]);
  mockCreateToken.mockReset();
  mockDeleteToken.mockReset();
  useI18nStore.setState({ locale: 'en' });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('DeviceListPage', () => {
  it('renders devices section', async () => {
    mockDevices = [
      { id: 'd1', name: 'pc-1', version: '1.0', online: true, busy: false, last_seen: 1000 },
    ];

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Devices')).toBeTruthy();
    });
    expect(screen.getByText('pc-1')).toBeTruthy();
  });

  it('shows loading text when fetching initial devices', () => {
    mockDeviceLoading = true;

    renderPage();

    // "Loading devices..." appears for both token section and device section
    expect(screen.queryAllByText('Loading devices...').length).toBeGreaterThanOrEqual(1);
  });

  it('shows error message on device fetch failure', async () => {
    mockDeviceError = 'failed to fetch devices';

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('failed to fetch devices')).toBeTruthy();
    });
  });

  it('shows no devices message when list is empty', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/No devices found/)).toBeTruthy();
    });
  });

  describe('token management', () => {
    it('shows no tokens message when empty', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText(/No tokens yet/)).toBeTruthy();
      });
    });

    it('displays generated tokens', async () => {
      mockTokens = [
        { token: 'tk-abcdef123456', created_at: 1700000000 },
      ];
      mockListTokens.mockResolvedValue(mockTokens);

      renderPage();

      await waitFor(() => {
        // Token is masked: first 8 chars + ... + last 4 = "tk-abcde...2345"
        expect(screen.getByText(/tk-abcde/)).toBeTruthy();
      });
    });

    it('shows newly generated token with copy button', async () => {
      mockCreateToken.mockResolvedValue({ token: 'new-token-xyz', created_at: 1700000001 });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Generate Token')).toBeTruthy();
      });

      fireEvent.click(screen.getByText('Generate Token'));

      await waitFor(() => {
        expect(screen.getByText('new-token-xyz')).toBeTruthy();
        expect(screen.getByText('Token generated!', { exact: false })).toBeTruthy();
      });
    });

    it('shows error when token generation fails', async () => {
      mockCreateToken.mockRejectedValue(new Error('fail'));

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Generate Token')).toBeTruthy();
      });

      fireEvent.click(screen.getByText('Generate Token'));

      await waitFor(() => {
        expect(screen.getByText('Failed to generate token')).toBeTruthy();
      });
    });

    it('deletes token after confirmation', async () => {
      mockTokens = [
        { token: 'tk-to-delete', created_at: 1700000000 },
      ];
      mockListTokens.mockResolvedValue(mockTokens);
      mockDeleteToken.mockResolvedValue({ message: 'token revoked' });
      vi.spyOn(window, 'confirm').mockReturnValue(true);

      renderPage();

      await waitFor(() => {
        expect(screen.getByTitle('Revoke')).toBeTruthy();
      });

      fireEvent.click(screen.getByTitle('Revoke'));

      await waitFor(() => {
        expect(mockDeleteToken).toHaveBeenCalledWith('tk-to-delete');
      });
    });

    it('does not delete token when confirm is cancelled', async () => {
      mockTokens = [
        { token: 'tk-keep', created_at: 1700000000 },
      ];
      mockListTokens.mockResolvedValue(mockTokens);
      vi.spyOn(window, 'confirm').mockReturnValue(false);

      renderPage();

      await waitFor(() => {
        expect(screen.getByTitle('Revoke')).toBeTruthy();
      });

      fireEvent.click(screen.getByTitle('Revoke'));

      await waitFor(() => {
        expect(mockDeleteToken).not.toHaveBeenCalled();
      });
    });

    it('shows error when token deletion fails', async () => {
      mockTokens = [
        { token: 'tk-fail', created_at: 1700000000 },
      ];
      mockListTokens.mockResolvedValue(mockTokens);
      mockDeleteToken.mockRejectedValue(new Error('fail'));
      vi.spyOn(window, 'confirm').mockReturnValue(true);

      renderPage();

      await waitFor(() => {
        expect(screen.getByTitle('Revoke')).toBeTruthy();
      });

      fireEvent.click(screen.getByTitle('Revoke'));

      await waitFor(() => {
        expect(screen.getByText('Failed to revoke token')).toBeTruthy();
      });
    });
  });
});
