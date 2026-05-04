import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useDeviceStore } from './deviceStore';
import { apiClient } from '../api/client';

vi.mock('../api/client', () => ({
  apiClient: {
    listDevices: vi.fn(),
  },
}));

beforeEach(() => {
  useDeviceStore.setState({ devices: [], loading: false, error: null });
});

const mockDevices = [
  { id: 'd1', name: 'pc-1', version: '1.0', online: true, busy: false, last_seen: 1000 },
  { id: 'd2', name: 'pc-2', version: '1.0', online: false, busy: false, last_seen: 500 },
];

describe('deviceStore', () => {
  it('starts with empty devices', () => {
    expect(useDeviceStore.getState().devices).toEqual([]);
    expect(useDeviceStore.getState().loading).toBe(false);
  });

  it('fetches and stores device list', async () => {
    vi.mocked(apiClient.listDevices).mockResolvedValueOnce(mockDevices);

    await useDeviceStore.getState().fetchDevices();

    const state = useDeviceStore.getState();
    expect(state.devices).toHaveLength(2);
    expect(state.devices[0].name).toBe('pc-1');
    expect(state.loading).toBe(false);
  });

  it('sets loading state during fetch', async () => {
    vi.mocked(apiClient.listDevices).mockImplementationOnce(
      () => new Promise(() => {}), // never resolves
    );

    const promise = useDeviceStore.getState().fetchDevices();
    expect(useDeviceStore.getState().loading).toBe(true);
    // cleanup
    vi.mocked(apiClient.listDevices).mockReset();
    useDeviceStore.setState({ loading: false });
  });

  it('sets error on fetch failure', async () => {
    vi.mocked(apiClient.listDevices).mockRejectedValueOnce(new Error('network error'));

    await useDeviceStore.getState().fetchDevices();

    expect(useDeviceStore.getState().error).toBe('network error');
    expect(useDeviceStore.getState().loading).toBe(false);
  });

  it('does not set loading=true on background poll when devices exist', async () => {
    useDeviceStore.setState({ devices: mockDevices });
    vi.mocked(apiClient.listDevices).mockResolvedValueOnce(mockDevices);

    const promise = useDeviceStore.getState().fetchDevices();
    // loading should remain false since devices already exist
    expect(useDeviceStore.getState().loading).toBe(false);
    await promise;
    expect(useDeviceStore.getState().loading).toBe(false);
  });

  it('sets loading=true on initial fetch when no devices', async () => {
    vi.mocked(apiClient.listDevices).mockImplementationOnce(
      () => new Promise(() => {}),
    );

    useDeviceStore.getState().fetchDevices();
    expect(useDeviceStore.getState().loading).toBe(true);
    vi.mocked(apiClient.listDevices).mockReset();
    useDeviceStore.setState({ loading: false });
  });

  it('updates single device online status', () => {
    useDeviceStore.setState({ devices: mockDevices });

    useDeviceStore.getState().updateDeviceStatus('d1', false);

    const d1 = useDeviceStore.getState().devices.find((d) => d.id === 'd1');
    expect(d1?.online).toBe(false);
    // d2 unchanged
    const d2 = useDeviceStore.getState().devices.find((d) => d.id === 'd2');
    expect(d2?.online).toBe(false);
  });

  it('updates device to online', () => {
    useDeviceStore.setState({ devices: mockDevices });

    useDeviceStore.getState().updateDeviceStatus('d2', true);

    const d2 = useDeviceStore.getState().devices.find((d) => d.id === 'd2');
    expect(d2?.online).toBe(true);
  });
});
