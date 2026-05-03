import { useEffect } from 'react';
import { useDeviceStore } from '../stores/deviceStore';
import { DeviceCard } from '../components/DeviceCard';
import { getConfig } from '../config';
import { useI18n } from '../i18n';
import { useIsMobile } from '../hooks/useIsMobile';

export function DeviceListPage() {
  const { t } = useI18n();
  const devices = useDeviceStore((s) => s.devices);
  const loading = useDeviceStore((s) => s.loading);
  const error = useDeviceStore((s) => s.error);
  const fetchDevices = useDeviceStore((s) => s.fetchDevices);
  const isMobile = useIsMobile(900);

  useEffect(() => {
    fetchDevices();
    const interval = setInterval(fetchDevices, getConfig().devicePollIntervalMs);
    return () => clearInterval(interval);
  }, [fetchDevices]);

  return (
    <div style={{ padding: isMobile ? '0.9rem 0.75rem' : '1.5rem', overflow: 'auto', flex: 1, minWidth: 0 }}>
      <h2 style={{ margin: '0 0 1.1rem', fontSize: isMobile ? '1.1rem' : '1.25rem', color: '#e0e0e0' }}>
        {t('devices')}
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
        <p style={{ color: '#666' }}>{t('loadingDevices')}</p>
      )}

      {!loading && devices.length === 0 && (
        <p style={{ color: '#666' }}>
          {t('noDevices')}
        </p>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: isMobile ? '0.75rem' : '1rem',
        }}
      >
        {devices.map((d) => (
          <DeviceCard key={d.id} device={d} />
        ))}
      </div>
    </div>
  );
}
