import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import AuthPage from './pages/AuthPage';
import Designer from './pages/Designer';
import LandingPage from './pages/LandingPage';
import StorePortal from './pages/StorePortal';

function getRouterBasename() {
  const publicUrl = process.env.PUBLIC_URL || '';
  if (!publicUrl || publicUrl === '.') {
    return '/';
  }
  return publicUrl.endsWith('/') ? publicUrl.slice(0, -1) : publicUrl;
}

export default function AppRouter() {
  return (
    <BrowserRouter basename={getRouterBasename()}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route
          path="/design"
          element={
            <ProtectedRoute roles={['customer']}>
              <Designer />
            </ProtectedRoute>
          }
        />
        <Route
          path="/store"
          element={
            <ProtectedRoute roles={['store']}>
              <StorePortal />
            </ProtectedRoute>
          }
        />
        <Route
          path="/store/demo"
          element={
            <ProtectedRoute roles={['store']}>
              <Designer demoMode />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
