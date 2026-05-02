import { useEffect } from 'react';
import { useDeviceStore } from '../stores/deviceStore';
import { DeviceCard } from '../components/DeviceCard';

export function DeviceListPage() {
  const devices = useDeviceStore((s) => s.devices);
  const loading = useDeviceStore((s) => s.loading);
  const error = useDeviceStore((s) => s.error);
  const fetchDevices = useDeviceStore((s) => s.fetchDevices);

  useEffect(() => {
    fetchDevices();
    const interval = setInterval(fetchDevices, 5000); // Poll every 5s
    return () => clearInterval(interval);
  }, [fetchDevices]);

  return (
    <div style={{ padding: '1.5rem', overflow: 'auto', flex: 1 }}>
      <h2 style={{ margin: '0 0 1.5rem', fontSize: '1.25rem', color: '#e0e0e0' }}>
        Devices
      </h2>

      {error && (
        <div
          style={{
            background: 'rgba(231, 76, 60, 0.1)',
            color: '#e74c3c',
            padding: '0.75rem',
            borderRadius: '6px',
            marginBottom: '1rem',
          }}
        >
          {error}
        </div>
      )}

      {loading && devices.length === 0 && (
        <p style={{ color: '#666' }}>Loading devices...</p>
      )}

      {!loading && devices.length === 0 && (
        <p style={{ color: '#666' }}>
          No devices found. Make sure the desktop client is running and connected.
        </p>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '1rem',
        }}
      >
        {devices.map((d) => (
          <DeviceCard key={d.id} device={d} />
        ))}
      </div>
    </div>
  );
}
