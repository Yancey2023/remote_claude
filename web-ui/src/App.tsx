import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { DeviceListPage } from './pages/DeviceListPage';
import { SessionListPage } from './pages/SessionListPage';
import { TerminalPage } from './pages/TerminalPage';
import { AdminPage } from './pages/AdminPage';
import { useAuthStore } from './stores/authStore';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  const [checking, setChecking] = useState(true);
  const checkAuth = useAuthStore((s) => s.checkAuth);

  useEffect(() => {
    checkAuth().finally(() => setChecking(false));
  }, [checkAuth]);

  if (checking) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100dvh',
          background: '#0f0f23',
          color: '#888',
          fontFamily: 'system-ui, sans-serif',
          fontSize: '0.9rem',
        }}
      >
        Loading...
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/devices" element={<DeviceListPage />} />
        <Route path="/devices/:id" element={<SessionListPage />} />
        <Route path="/devices/:id/sessions/:sessionId" element={<TerminalPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/devices" replace />} />
    </Routes>
  );
}
