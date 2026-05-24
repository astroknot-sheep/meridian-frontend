import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

/**
 * Wraps a private route.
 *  - `requireConsent={false}` allows authenticated users who haven't consented
 *    yet (used for onboarding).
 *  - `requireConsent={true}` redirects to /onboarding when consent missing.
 */
export default function ProtectedRoute({ children, requireConsent = true }) {
  const { session, profile, loading, profileLoaded } = useAuth();
  const location = useLocation();

  if (loading || (session && !profileLoaded)) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          color: 'var(--muted)',
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '0.85rem',
          letterSpacing: '0.05em',
        }}
      >
        Loading…
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  }

  if (requireConsent && (!profile || !profile.consent_given)) {
    return <Navigate to="/onboarding" replace />;
  }

  return children;
}
