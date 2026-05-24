import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { apiFetch } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import AppNav from '../components/AppNav.jsx';
import AmbientOrbs from '../components/AmbientOrbs.jsx';
import '../styles/background.css';
import '../styles/app-nav.css';
import '../styles/profile.css';

export default function Profile() {
  const { fetchProfile } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [modality, setModality] = useState('cbt');
  const [status, setStatus] = useState({ text: '', kind: '' });
  const [busy, setBusy] = useState(false);
  const [sessions, setSessions] = useState(null);

  // Load profile
  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch('/profile');
        if (res.status === 401) { window.location.href = '/auth'; return; }
        if (res.status === 403) { window.location.href = '/onboarding'; return; }
        if (!res.ok) throw new Error('Failed to fetch profile');
        const data = await res.json();
        setDisplayName(data.display_name || '');
        setModality(data.preferred_modality || 'cbt');
      } catch {
        setStatus({ text: 'Could not load profile.', kind: 'error' });
      }
    })();
  }, []);

  // Load sessions
  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch('/sessions');
        if (res.status === 401) { window.location.href = '/auth'; return; }
        if (res.status === 403) { window.location.href = '/onboarding'; return; }
        if (!res.ok) throw new Error('Failed');
        setSessions(await res.json());
      } catch {
        setSessions([]);
      }
    })();
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setStatus({ text: '', kind: '' });
    const payload = {
      display_name: displayName.trim(),
      preferred_modality: modality,
    };
    try {
      const res = await apiFetch('/profile', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      if (res.status === 401) { window.location.href = '/auth'; return; }
      if (res.status === 403) { window.location.href = '/onboarding'; return; }
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Update failed');
      }
      await supabase.auth.updateUser({ data: payload });
      await fetchProfile();
      setStatus({ text: 'Profile updated.', kind: 'success' });
    } catch (err) {
      setStatus({ text: err.message || 'Something went wrong.', kind: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="profile-page">
      <AmbientOrbs variant="soft" />
      <AppNav />

      <div className="profile-card">
        <h2 className="section-title serif">Your Profile</h2>
        <form onSubmit={onSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="display-name">Display Name</label>
              <input
                type="text" id="display-name" placeholder="Your name"
                value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                required autoComplete="name"
              />
            </div>
            <div className="form-group">
              <label htmlFor="preferred-modality">Preferred Modality</label>
              <select
                id="preferred-modality" value={modality}
                onChange={(e) => setModality(e.target.value)}
              >
                <option value="cbt">CBT</option>
                <option value="act">ACT</option>
                <option value="dbt">DBT</option>
                <option value="mindfulness">Mindfulness</option>
                <option value="sfbt">Solution-Focused</option>
              </select>
            </div>
          </div>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save Changes'}
          </button>
          <div className={`status-msg ${status.kind}`} aria-live="polite">{status.text}</div>
        </form>
      </div>

      <div className="profile-card history-card">
        <h2 className="section-title serif">Past Sessions</h2>
        <div>
          {sessions === null && <div className="empty-state">Loading sessions…</div>}
          {sessions && sessions.length === 0 && <div className="empty-state">No past sessions yet.</div>}
          {sessions && sessions.map((s) => {
            const formatted = new Date(s.created_at).toLocaleDateString('en-US', {
              month: 'short', day: 'numeric', year: 'numeric',
            });
            return (
              <div className="session-item" key={s.id}>
                <div>
                  <div className="session-date">{formatted}</div>
                  <div className="session-mode">{s.mode} · {s.modality || '—'}</div>
                </div>
                <Link to={`/chat?session=${s.id}`} className="session-link">Resume</Link>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
