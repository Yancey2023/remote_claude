import { useNavigate } from 'react-router-dom';
import { useDeviceStore } from '../stores/deviceStore';
import { showToast } from './Toast';
import type { DeviceResponse } from '../types/protocol';

interface Props {
  device: DeviceResponse;
}

export function DeviceCard({ device }: Props) {
  const navigate = useNavigate();
  const deleteDevice = useDeviceStore((s) => s.deleteDevice);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Delete device "${device.name}"? This cannot be undone.`)) return;
    try {
      await deleteDevice(device.id);
      showToast(`Device "${device.name}" deleted`, 'success');
    } catch {
      showToast('Failed to delete device', 'error');
    }
  };

  return (
    <div
      onClick={() => navigate(`/devices/${device.id}`)}
      style={{
        background: '#16213e',
        borderRadius: '8px',
        padding: '1rem',
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
      <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: '#888' }}>
        <span>v{device.version}</span>
        <span>{device.busy ? 'Busy' : 'Idle'}</span>
        <span>{device.online ? 'Online' : 'Offline'}</span>
      </div>
      <button
        onClick={handleDelete}
        title={`Delete ${device.name}`}
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
        ✕
      </button>
    </div>
  );
}
