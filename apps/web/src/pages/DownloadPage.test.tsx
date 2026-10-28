import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useI18nStore } from '../i18n';

vi.stubEnv('VITE_CLIENT_VERSION', '1.2.2');
const { DownloadPage } = await import('./DownloadPage');

vi.mock('../api/client', () => ({ apiClient: { fetchDownloadSizes: vi.fn().mockResolvedValue({}) } }));
vi.mock('../hooks/useIsMobile', () => ({ useIsMobile: () => false }));
vi.mock('../config', () => ({ getConfig: () => ({ apiBaseUrl: '/remote_claude/api', wsBaseUrl: '/remote_claude/ws/web' }) }));

beforeEach(() => {
  useI18nStore.setState({ locale: 'en' });
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockResolvedValue(undefined) } });
});
afterEach(cleanup);

describe('DownloadPage', () => {
  it('copies the selected platform command with an absolute download URL', async () => {
    render(<MemoryRouter><DownloadPage /></MemoryRouter>);
    expect(screen.getByText('PowerShell')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Linux arm64' }));
    expect(screen.getByText('Shell')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining(`curl -fL '${window.location.origin}/remote_claude/api/downloads/remote-claude-desktop-client-v1.2.2-linux-arm64'`)));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('/remote_claude/ws/client'));
  });
});
