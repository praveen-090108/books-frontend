import { AppRoutes } from './routes/AppRoutes.jsx';
import { AppErrorBoundary } from './components/AppErrorBoundary.jsx';
import { GlobalErrorToast } from './components/GlobalErrorToast.jsx';
import { useLocation } from 'react-router-dom';

export default function App() {
  const location = useLocation();
  return (
    <AppErrorBoundary resetKey={location.pathname}>
      <GlobalErrorToast />
      <AppRoutes />
    </AppErrorBoundary>
  );
}
