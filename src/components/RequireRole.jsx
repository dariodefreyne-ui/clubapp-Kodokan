import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usePaginaRollen } from '../contexts/PaginaRollenContext';
import { ROL_STANDAARD_PAGINAS } from '../config/appConfig';

// Paths always accessible for any authenticated user, regardless of role config.
const ALTIJD_TOEGANKELIJK = new Set(['/', '/profiel', '/instellingen', '/dashboard']);

// Route guard that enforces role-based access on every route.
// - Not authenticated → /login (defensive; App.jsx already guards at top level)
// - Authenticated, no access → / (dashboard)
// - Detail paths (/leden/:id, /trainingen/:id, ...) inherit parent-path access
//   via startsWith so no per-route configuration is needed.
export default function RequireRole({ children }) {
  const { isAuthenticated, isLaden, role } = useAuth();
  const beschikbarePads = usePaginaRollen();
  const location = useLocation();

  if (isLaden) return null;

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const pad = location.pathname;

  if (ALTIJD_TOEGANKELIJK.has(pad)) return children;

  // Fall back to static defaults when Firestore config is unavailable.
  const toegestaan = beschikbarePads ?? (ROL_STANDAARD_PAGINAS[role] || []);

  const heeftToegang = toegestaan.some(
    allowed => pad === allowed || pad.startsWith(allowed + '/')
  );

  if (!heeftToegang) {
    return <Navigate to="/" replace />;
  }

  return children;
}
