import { AppRoutes } from './routes/AppRoutes.jsx';
import { LeadModuleErrorBoundary } from './features/leads/LeadModuleErrorBoundary.jsx';
import { useLocation } from 'react-router-dom';

export default function App() {
  const location = useLocation();
  return (
    <LeadModuleErrorBoundary key={location.pathname}>
      <AppRoutes />
    </LeadModuleErrorBoundary>
  );
}
