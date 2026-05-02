import { useEffect, useState } from 'react';

interface ToastMessage {
  id: number;
  text: string;
  type: 'error' | 'info' | 'success';
}

let toastId = 0;
const listeners = new Set<(msg: ToastMessage) => void>();

export function showToast(text: string, type: 'error' | 'info' | 'success' = 'info') {
  const msg: ToastMessage = { id: ++toastId, text, type };
  listeners.forEach((fn) => fn(msg));
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const handler = (msg: ToastMessage) => {
      setToasts((prev) => [...prev, msg]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== msg.id));
      }, 4000);
    };
    listeners.add(handler);
    return () => { listeners.delete(handler); };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div style={{
      position: 'fixed',
      top: '1rem',
      right: '1rem',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem',
    }}>
      {toasts.map((t) => (
        <div
          key={t.id}
          style={{
            padding: '0.75rem 1rem',
            borderRadius: '6px',
            color: 'white',
            fontSize: '0.875rem',
            background: t.type === 'error' ? '#e74c3c' : t.type === 'success' ? '#27ae60' : '#3498db',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            maxWidth: '20rem',
            wordBreak: 'break-word',
          }}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}
