import { AuthProvider } from './context/AuthContext';
import AppRouter from './AppRouter';
import ErrorBoundary from './components/ErrorBoundary';
import { initSupabaseSession } from './utils/supabase/session';

initSupabaseSession();

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
