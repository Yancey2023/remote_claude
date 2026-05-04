import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DeviceCard } from './DeviceCard';

describe('DeviceCard', () => {
  const baseDevice = {
    id: 'd1',
    name: 'test-pc',
    version: '1.0.0',
    online: true,
    busy: false,
    last_seen: 1000,
    user_id: 'u1',
  };

  it('renders device name and version', () => {
    render(
      <MemoryRouter>
        <DeviceCard device={baseDevice} />
      </MemoryRouter>
    );
    expect(screen.getByText('test-pc')).toBeTruthy();
    expect(screen.getByText('v1.0.0')).toBeTruthy();
  });

  it('shows online status when online', () => {
    render(
      <MemoryRouter>
        <DeviceCard device={baseDevice} />
      </MemoryRouter>
    );
    expect(screen.getByText('Online')).toBeTruthy();
    expect(screen.getByText('Idle')).toBeTruthy();
  });

  it('shows offline status when offline', () => {
    const offlineDevice = { ...baseDevice, online: false };
    render(
      <MemoryRouter>
        <DeviceCard device={offlineDevice} />
      </MemoryRouter>
    );
    expect(screen.getByText('Offline')).toBeTruthy();
  });

  it('shows busy status when busy', () => {
    const busyDevice = { ...baseDevice, busy: true };
    render(
      <MemoryRouter>
        <DeviceCard device={busyDevice} />
      </MemoryRouter>
    );
    expect(screen.getByText('Busy')).toBeTruthy();
  });

  it('shows idle status when not busy', () => {
    const idleDevice = { ...baseDevice, busy: false };
    render(
      <MemoryRouter>
        <DeviceCard device={idleDevice} />
      </MemoryRouter>
    );
    expect(screen.getByText('Idle')).toBeTruthy();
  });

  it('renders offline + busy device', () => {
    const offlineBusy = { ...baseDevice, online: false, busy: true };
    render(
      <MemoryRouter>
        <DeviceCard device={offlineBusy} />
      </MemoryRouter>
    );
    expect(screen.getByText('Offline')).toBeTruthy();
    expect(screen.getByText('Busy')).toBeTruthy();
  });
});
