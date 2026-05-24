import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../lib/api.js';
import AppNav from '../components/AppNav.jsx';
import AmbientOrbs from '../components/AmbientOrbs.jsx';
import '../styles/background.css';
import '../styles/app-nav.css';
import '../styles/history.css';

export default function History() {
  const [sessions, setSessions] = useState(null); // null = loading, [] = empty
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch('/sessions');
        if (res.status === 401) { window.location.href = '/auth'; return; }
        if (res.status === 403) { window.location.href = '/onboarding'; return; }
        if (!res.ok) throw new Error('Failed to fetch history');
        const data = await res.json();
        setSessions(data || []);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(err);
        setError('Unable to load sessions. Please try again later.');
      }
    })();
  }, []);

  return (
    <div className="history-page">
      <AmbientOrbs variant="soft" />
      <AppNav />
      <div className="history-card">
        <h2 className="section-title serif">Your Sessions</h2>
        <div className="session-list">
          {sessions === null && !error && <div className="loading-state">Loading your sessions…</div>}
          {error && <div className="error-state">{error}</div>}
          {sessions && sessions.length === 0 && !error && (
            <div className="empty-state">
              No sessions recorded yet.<br />
              Start a conversation in the Chat tab.
            </div>
          )}
          {sessions && sessions.length > 0 && sessions.map((s) => {
            const formatted = new Date(s.created_at).toLocaleDateString('en-US', {
              month: 'short', day: 'numeric', year: 'numeric',
            });
            return (
              <div className="session-row" key={s.id}>
                <div className="session-date">{formatted}</div>
                <div className="session-mode">{s.mode || 'therapy'}</div>
                <div className="session-modality">{s.modality || '—'}</div>
                <Link to={`/chat?session=${s.id}`} className="session-link sans-label">
                  Resume
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
