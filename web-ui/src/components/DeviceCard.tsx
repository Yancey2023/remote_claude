import { useNavigate } from 'react-router-dom';
import { useDeviceStore } from '../stores/deviceStore';
import { showToast } from './Toast';
import type { DeviceResponse } from '../types/protocol';
import { useI18n } from '../i18n';
import { useIsMobile } from '../hooks/useIsMobile';

interface Props {
  device: DeviceResponse;
}

export function DeviceCard({ device }: Props) {
  const { t, tf } = useI18n();
  const navigate = useNavigate();
  const deleteDevice = useDeviceStore((s) => s.deleteDevice);
  const isMobile = useIsMobile(900);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(tf('deviceDeleteConfirm', { name: device.name }))) return;
    try {
      await deleteDevice(device.id);
      showToast(tf('deviceDeleted', { name: device.name }), 'success');
    } catch {
      showToast(t('deviceDeleteFailed'), 'error');
    }
  };

  return (
    <div
      onClick={() => navigate(`/devices/${device.id}`)}
      style={{
        background: '#16213e',
        borderRadius: '8px',
        padding: isMobile ? '0.85rem' : '1rem',
        cursor: 'pointer',
        border: '1px solid #0f3460',
        transition: 'border-color 0.2s',
        position: 'relative',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = '#e94560';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = '#0f3460';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
        <span
          style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            background: device.online ? '#27ae60' : '#666',
            display: 'inline-block',
            flexShrink: 0,
          }}
        />
        <h3 style={{ margin: 0, color: '#e0e0e0', fontSize: '1rem' }}>{device.name}</h3>
      </div>
      <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.8rem', color: '#888', flexWrap: 'wrap' }}>
        <span>v{device.version}</span>
        <span>{device.busy ? t('busy') : t('idle')}</span>
        <span>{device.online ? t('online') : t('offline')}</span>
      </div>
      <button
        onClick={handleDelete}
        title={tf('deviceDeleteTitle', { name: device.name })}
        style={{
          position: 'absolute',
          top: '6px',
          right: '8px',
          background: 'none',
          border: 'none',
          color: '#e74c3c',
          cursor: 'pointer',
          fontSize: '1.1rem',
          padding: '2px 6px',
          borderRadius: '4px',
          opacity: 0.5,
          transition: 'opacity 0.2s',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.5'; }}
      >
        <span className="btn-label">✕</span>
      </button>
    </div>
  );
}
