import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { API_BASE } from '../lib/api.js';
import AmbientOrbs from '../components/AmbientOrbs.jsx';
import '../styles/background.css';
import '../styles/card-page.css';

export default function Verified() {
  const [statusText, setStatusText] = useState('Taking you to Meridian…');
  const [showManual, setShowManual] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setStatusText('Your account is active. Sign in to start using Meridian.');
        setShowManual(true);
        return;
      }
      localStorage.setItem('sb_token', session.access_token);
      try {
        const res = await fetch(`${API_BASE}/profile`, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        });
        if (res.ok) {
          const profile = await res.json();
          navigate(profile.consent_given ? '/chat' : '/onboarding', { replace: true });
          return;
        }
        navigate('/onboarding', { replace: true });
      } catch {
        navigate('/onboarding', { replace: true });
      }
    })();
  }, [navigate]);

  return (
    <div className="card-page">
      <AmbientOrbs variant="card" />
      <div className="card-shell verified-card">
        <div className="card-logo">
          <Link to="/" className="serif">
            Meridian<span className="logo-dot" />
          </Link>
        </div>
        <div className="check-icon">✓</div>
        <h2 className="serif">Email verified</h2>
        <p>{statusText}</p>
        {showManual && (
          <Link to="/auth" className="btn-primary" style={{ display: 'inline-block', textAlign: 'center' }}>
            Sign in to Meridian
          </Link>
        )}
      </div>
    </div>
  );
}
