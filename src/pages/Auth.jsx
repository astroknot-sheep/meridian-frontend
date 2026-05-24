import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { API_BASE } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import AmbientOrbs from '../components/AmbientOrbs.jsx';
import '../styles/background.css';
import '../styles/auth.css';

const routeByConsent = async (token, navigate) => {
  try {
    const res = await fetch(`${API_BASE}/profile`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    if (res.ok) {
      const profile = await res.json();
      navigate(profile.consent_given ? '/chat' : '/onboarding', { replace: true });
      return;
    }
    navigate('/onboarding', { replace: true });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('Consent check failed:', e);
    navigate('/onboarding', { replace: true });
  }
};

export default function Auth() {
  const [mode, setMode] = useState('login'); // 'login' | 'signup' | 'sent'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { session, loading } = useAuth();

  // ── Handle email-confirmation redirect (?confirmed=true) ──────────
  const handleConfirmed = useCallback(async () => {
    const { data: { session: sess } } = await supabase.auth.getSession();
    if (sess) {
      localStorage.setItem('sb_token', sess.access_token);
      await routeByConsent(sess.access_token, navigate);
      return true;
    }
    setError('Verification successful. Please sign in.');
    // Clear the ?confirmed param so subsequent refreshes don't loop.
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('confirmed');
    setSearchParams(newParams, { replace: true });
    return false;
  }, [navigate, searchParams, setSearchParams]);

  // ── On mount: confirm? already-signed-in? ─────────────────────────
  useEffect(() => {
    if (loading) return;

    (async () => {
      if (searchParams.get('confirmed') === 'true') {
        const ok = await handleConfirmed();
        if (ok) return;
      }
      if (session) {
        // Already signed in — route by consent state.
        localStorage.setItem('sb_token', session.access_token);
        await routeByConsent(session.access_token, navigate);
      }
    })();
  }, [loading, session, searchParams, handleConfirmed, navigate]);

  const onSignIn = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) throw err;
      localStorage.setItem('sb_token', data.session.access_token);
      await routeByConsent(data.session.access_token, navigate);
    } catch (err) {
      setError(err.message || 'Login failed. Check your credentials.');
    } finally {
      setBusy(false);
    }
  };

  const onSignUp = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { data, error: err } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth?confirmed=true` },
      });
      if (err) throw err;

      if (data.session) {
        // Email confirmation disabled → straight to onboarding.
        localStorage.setItem('sb_token', data.session.access_token);
        navigate('/onboarding', { replace: true });
        return;
      }
      // Email confirmation ON → show "check inbox" panel.
      setMode('sent');
    } catch (err) {
      setError(err.message || 'Registration failed. Try a different email.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-layout">
        {/* Visual half (desktop) / blurred backdrop (mobile) */}
        <div className="auth-visual" aria-hidden="true">
          <AmbientOrbs variant="card" />
          <div className="visual-grid" />
          <div className="visual-content">
            <span className="visual-logo serif">Meridian</span>
            <hr className="visual-rule" />
            <p className="visual-tagline">Private, evidence-based mental health support</p>
          </div>
        </div>

        {/* Form half */}
        <div className="auth-panel">
          <div className="auth-card">
            <div className="auth-logo">
              <Link to="/" className="serif">
                Meridian<span className="logo-dot" />
              </Link>
            </div>

            {mode !== 'sent' && (
              <div className="auth-toggle">
                <button
                  className={mode === 'login' ? 'active' : ''}
                  onClick={() => { setMode('login'); setError(''); }}
                  type="button"
                >Sign In</button>
                <button
                  className={mode === 'signup' ? 'active' : ''}
                  onClick={() => { setMode('signup'); setError(''); }}
                  type="button"
                >Create Account</button>
              </div>
            )}

            {mode === 'login' && (
              <form onSubmit={onSignIn} autoComplete="on">
                <div className="form-group">
                  <label className="sans-label" htmlFor="login-email">Email</label>
                  <input
                    type="email" id="login-email" placeholder="you@example.com"
                    value={email} onChange={(e) => setEmail(e.target.value)}
                    required autoComplete="email"
                  />
                </div>
                <div className="form-group">
                  <label className="sans-label" htmlFor="login-password">Password</label>
                  <input
                    type="password" id="login-password" placeholder="········"
                    value={password} onChange={(e) => setPassword(e.target.value)}
                    required autoComplete="current-password"
                  />
                </div>
                <button type="submit" className="btn-primary" disabled={busy}>
                  {busy ? 'Please wait…' : 'Enter Portal'}
                </button>
              </form>
            )}

            {mode === 'signup' && (
              <form onSubmit={onSignUp} autoComplete="on">
                <div className="form-group">
                  <label className="sans-label" htmlFor="signup-email">Email</label>
                  <input
                    type="email" id="signup-email" placeholder="you@example.com"
                    value={email} onChange={(e) => setEmail(e.target.value)}
                    required autoComplete="email"
                  />
                </div>
                <div className="form-group">
                  <label className="sans-label" htmlFor="signup-password">Password</label>
                  <input
                    type="password" id="signup-password" placeholder="Min. 8 characters"
                    value={password} onChange={(e) => setPassword(e.target.value)}
                    required minLength={8} autoComplete="new-password"
                  />
                </div>
                <button type="submit" className="btn-primary" disabled={busy}>
                  {busy ? 'Please wait…' : 'Create Account'}
                </button>
              </form>
            )}

            {mode === 'sent' && (
              <div className="email-sent">
                <p className="auth-info">
                  <strong>Check your inbox.</strong>
                  <br /><br />
                  We've sent a verification link to your email address.
                  <br />
                  Click the link to complete your account, then come back here to sign in.
                </p>
                <button
                  className="btn-primary"
                  style={{ marginTop: '1.5rem' }}
                  onClick={() => window.location.reload()}
                  type="button"
                >
                  I've verified — sign in
                </button>
              </div>
            )}

            <div className="auth-error" aria-live="polite">{error}</div>
            <Link to="/" className="back-link">← Back to Meridian</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
