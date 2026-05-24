import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { apiFetch } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import AmbientOrbs from '../components/AmbientOrbs.jsx';
import '../styles/background.css';
import '../styles/card-page.css';

export default function Onboarding() {
  const { session, profile, fetchProfile } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState('');
  const [modality, setModality] = useState('cbt');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // If already consented, skip onboarding entirely.
  useEffect(() => {
    if (profile?.consent_given) {
      navigate('/chat', { replace: true });
      return;
    }
    // Pre-fill from profile or auth metadata.
    if (profile?.display_name) setDisplayName(profile.display_name);
    if (profile?.preferred_modality) setModality(profile.preferred_modality);
    if (!profile?.display_name && session?.user?.user_metadata) {
      const meta = session.user.user_metadata;
      setDisplayName((prev) => prev || meta.full_name || meta.display_name || '');
    }
  }, [profile, session, navigate]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!consent) {
      setError('Please agree to the consent to continue.');
      return;
    }
    setBusy(true);
    try {
      const res = await apiFetch('/profile/consent', {
        method: 'POST',
        body: JSON.stringify({
          display_name: displayName.trim(),
          preferred_modality: modality,
          consent_given: true,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Failed to save profile.');
      }
      await supabase.auth.updateUser({
        data: { display_name: displayName.trim(), preferred_modality: modality },
      });
      await fetchProfile();
      navigate('/chat', { replace: true });
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card-page">
      <AmbientOrbs variant="card" />
      <div className="card-shell onboarding-card">
        <div className="card-logo">
          <Link to="/" className="serif">
            Meridian<span className="logo-dot" />
          </Link>
        </div>
        <h2 className="serif">Complete Your Profile</h2>

        <form onSubmit={onSubmit}>
          <div className="form-group">
            <label className="sans-label" htmlFor="display-name">Display Name</label>
            <input
              type="text" id="display-name" placeholder="How should we call you?"
              required autoComplete="name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="sans-label" htmlFor="preferred-modality">Preferred Therapy Modality</label>
            <select
              id="preferred-modality"
              value={modality}
              onChange={(e) => setModality(e.target.value)}
            >
              <option value="cbt">CBT</option>
              <option value="act">ACT</option>
              <option value="dbt">DBT</option>
              <option value="mindfulness">Mindfulness</option>
              <option value="sfbt">Solution-Focused</option>
            </select>
          </div>
          <div className="consent-box">
            <input
              type="checkbox" id="consent-check" required
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            <label htmlFor="consent-check" className="consent-text">
              I understand that Meridian provides automated support, not clinical therapy.
              I consent to anonymous, session-only data processing.
            </label>
          </div>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Enter Meridian'}
          </button>
          <div className="error-msg" aria-live="polite">{error}</div>
        </form>
      </div>
    </div>
  );
}
