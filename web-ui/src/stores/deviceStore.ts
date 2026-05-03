import { create } from 'zustand';
import { apiClient } from '../api/client';
import type { DeviceResponse } from '../types/protocol';

interface DeviceState {
  devices: DeviceResponse[];
  loading: boolean;
  error: string | null;
  fetchDevices: () => Promise<void>;
  deleteDevice: (deviceId: string) => Promise<void>;
  updateDeviceStatus: (deviceId: string, online: boolean) => void;
}

export const useDeviceStore = create<DeviceState>((set, get) => ({
  devices: [],
  loading: false,
  error: null,

  fetchDevices: async () => {
    set({ loading: true, error: null });
    try {
      const devices = await apiClient.listDevices();
      set({ devices, loading: false });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'failed to fetch devices', loading: false });
    }
  },

  deleteDevice: async (deviceId: string) => {
    set({ error: null });
    try {
      await apiClient.deleteDevice(deviceId);
      const devices = get().devices.filter((d) => d.id !== deviceId);
      set({ devices });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'failed to delete device' });
    }
  },

  updateDeviceStatus: (deviceId: string, online: boolean) => {
    const devices = get().devices.map((d) =>
      d.id === deviceId ? { ...d, online } : d,
    );
    set({ devices });
  },
}));
