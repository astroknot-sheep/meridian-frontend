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
  const [phq9, setPhq9] = useState(null); // null = loading, then { assessments, in_progress }

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

  // Load PHQ-9 trajectory
  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch('/profile/phq9');
        if (!res.ok) throw new Error('Failed');
        setPhq9(await res.json());
      } catch {
        // Non-fatal: just show empty state rather than blow up the page.
        setPhq9({ assessments: [], in_progress: null });
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

      <PHQ9Card phq9={phq9} />

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

/* ──────────────────────────────────────────────────────────────────
   PHQ-9 trajectory card.
   States it renders:
     - loading          (phq9 === null)
     - empty            (no assessments, no in-progress)
     - in_progress only (N of 9 answered, no completed assessment yet)
     - one assessment   (latest score + severity, no chart)
     - 2+ assessments   (latest score + delta + line chart)
   ────────────────────────────────────────────────────────────────── */

const SEVERITY_BADGE = {
  'minimal': { bg: 'rgba(112,176,120,0.18)', fg: '#4A7A52' },
  'mild': { bg: 'rgba(196,168,130,0.18)', fg: '#7A6A58' },
  'moderate': { bg: 'rgba(196,168,130,0.28)', fg: '#8A6E48' },
  'moderately severe': { bg: 'rgba(200,140,100,0.22)', fg: '#A05A38' },
  'severe': { bg: 'rgba(176,112,112,0.22)', fg: '#9A4A4A' },
};

function PHQ9Card({ phq9 }) {
  if (phq9 === null) {
    return (
      <div className="profile-card">
        <h2 className="section-title serif">Wellbeing Trajectory</h2>
        <div className="empty-state">Loading…</div>
      </div>
    );
  }

  const { assessments = [], in_progress = null } = phq9;
  const hasAssessments = assessments.length > 0;

  return (
    <div className="profile-card">
      <h2 className="section-title serif">Wellbeing Trajectory</h2>
      <p style={{
        fontSize: '0.8rem', color: 'var(--muted)',
        marginTop: '-1rem', marginBottom: '2rem', lineHeight: 1.6,
      }}>
        PHQ-9 depression screening — a clinically validated 0–27 scale, measured
        conversationally during your therapy sessions.
      </p>

      {hasAssessments ? (
        <>
          <LatestScoreDisplay
            latest={assessments[0]}
            previous={assessments[1]}
          />
          {assessments.length >= 2 && <PHQ9Chart assessments={assessments} />}
          {in_progress && (
            <InProgressNote in_progress={in_progress} />
          )}
        </>
      ) : (
        <EmptyState in_progress={in_progress} />
      )}
    </div>
  );
}

function LatestScoreDisplay({ latest, previous }) {
  const date = new Date(latest.created_at).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });
  const badge = SEVERITY_BADGE[latest.severity] || SEVERITY_BADGE.moderate;
  const delta = previous ? latest.total_score - previous.total_score : null;
  const deltaColor = delta == null ? 'var(--muted)' : (delta < 0 ? '#4A7A52' : delta > 0 ? '#B07070' : 'var(--muted)');
  const deltaArrow = delta == null ? '' : (delta < 0 ? '↓' : delta > 0 ? '↑' : '·');

  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', gap: '2rem',
      marginBottom: '2.5rem', flexWrap: 'wrap',
    }}>
      <div>
        <div style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: '4rem', lineHeight: 1, color: 'var(--fg)', fontWeight: 300,
        }}>
          {latest.total_score}
          <span style={{ fontSize: '1.1rem', color: 'var(--muted)', marginLeft: '0.4rem', fontWeight: 400 }}>
            / 27
          </span>
        </div>
        <div style={{
          fontSize: '0.65rem', color: 'var(--muted)',
          textTransform: 'uppercase', letterSpacing: '0.18em',
          marginTop: '0.6rem', fontFamily: "'Syne', sans-serif", fontWeight: 600,
        }}>
          As of {date}
        </div>
      </div>

      <div style={{
        padding: '0.55rem 1.1rem', borderRadius: '100px',
        background: badge.bg, color: badge.fg,
        fontFamily: "'Syne', sans-serif",
        fontSize: '0.65rem', textTransform: 'uppercase',
        letterSpacing: '0.18em', fontWeight: 700,
      }}>
        {latest.severity}
      </div>

      {delta !== null && (
        <div style={{
          fontSize: '0.8rem', color: deltaColor,
          fontFamily: "'IBM Plex Mono', monospace",
        }}>
          {deltaArrow} {Math.abs(delta)} from previous
        </div>
      )}
    </div>
  );
}

function PHQ9Chart({ assessments }) {
  // Backend returns newest-first; chart wants oldest-first.
  const data = [...assessments].reverse();

  const W = 600, H = 240;
  const padL = 32, padR = 16, padT = 18, padB = 32;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const xFor = (i) => (
    data.length > 1
      ? padL + (i / (data.length - 1)) * plotW
      : padL + plotW / 2
  );
  // High score = top of chart (clinical convention — depression goes UP when worse).
  const yFor = (score) => padT + (1 - Math.min(score, 27) / 27) * plotH;

  const bands = [
    { lo: 0, hi: 4, color: 'rgba(112,176,120,0.09)' }, // minimal
    { lo: 5, hi: 9, color: 'rgba(196,168,130,0.07)' }, // mild
    { lo: 10, hi: 14, color: 'rgba(196,168,130,0.13)' }, // moderate
    { lo: 15, hi: 19, color: 'rgba(200,140,100,0.13)' }, // mod severe
    { lo: 20, hi: 27, color: 'rgba(176,112,112,0.14)' }, // severe
  ];

  const linePoints = data
    .map((a, i) => `${xFor(i)},${yFor(a.total_score)}`)
    .join(' ');

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', minWidth: '480px', height: 'auto', display: 'block' }}
        role="img"
        aria-label="PHQ-9 depression score over time"
      >
        {/* Severity bands */}
        {bands.map((b, idx) => {
          const yTop = yFor(b.hi);
          const yBot = yFor(b.lo);
          return (
            <rect key={idx}
              x={padL} y={yTop}
              width={plotW} height={Math.max(yBot - yTop, 0)}
              fill={b.color}
            />
          );
        })}

        {/* Gridlines + Y labels */}
        {[0, 5, 10, 15, 20, 27].map((s) => (
          <g key={s}>
            <line
              x1={padL} y1={yFor(s)} x2={W - padR} y2={yFor(s)}
              stroke="rgba(26,23,20,0.06)" strokeWidth="1"
              strokeDasharray={s === 0 ? '0' : '2 3'}
            />
            <text
              x={padL - 8} y={yFor(s) + 4}
              fontSize="10" fontFamily="'IBM Plex Mono', monospace"
              fill="#9A8E82" textAnchor="end"
            >
              {s}
            </text>
          </g>
        ))}

        {/* Line */}
        {data.length > 1 && (
          <polyline
            points={linePoints}
            fill="none" stroke="#C4A882" strokeWidth="2"
            strokeLinejoin="round" strokeLinecap="round"
          />
        )}

        {/* Points */}
        {data.map((a, i) => (
          <g key={i}>
            <circle
              cx={xFor(i)} cy={yFor(a.total_score)}
              r="5" fill="#F5F2EE" stroke="#C4A882" strokeWidth="2"
            />
            <title>
              {`${new Date(a.created_at).toLocaleDateString()}: ${a.total_score} (${a.severity})`}
            </title>
          </g>
        ))}

        {/* X-axis labels (first + last) */}
        {data.length > 0 && (
          <text
            x={xFor(0)} y={H - 10}
            fontSize="10" fontFamily="'IBM Plex Mono', monospace"
            fill="#9A8E82" textAnchor={data.length > 1 ? 'start' : 'middle'}
          >
            {new Date(data[0].created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </text>
        )}
        {data.length > 1 && (
          <text
            x={xFor(data.length - 1)} y={H - 10}
            fontSize="10" fontFamily="'IBM Plex Mono', monospace"
            fill="#9A8E82" textAnchor="end"
          >
            {new Date(data[data.length - 1].created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </text>
        )}
      </svg>

      {/* Severity legend */}
      <div style={{
        display: 'flex', gap: '1.2rem', flexWrap: 'wrap',
        marginTop: '1.2rem',
        fontSize: '0.6rem', color: 'var(--muted)',
        fontFamily: "'Syne', sans-serif",
        textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 600,
      }}>
        <LegendItem swatch="rgba(112,176,120,0.6)" label="0–4 Minimal" />
        <LegendItem swatch="rgba(196,168,130,0.5)" label="5–9 Mild" />
        <LegendItem swatch="rgba(196,168,130,0.85)" label="10–14 Moderate" />
        <LegendItem swatch="rgba(200,140,100,0.7)" label="15–19 Mod. Severe" />
        <LegendItem swatch="rgba(176,112,112,0.75)" label="20–27 Severe" />
      </div>
    </div>
  );
}

function LegendItem({ swatch, label }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
      <span style={{
        display: 'inline-block', width: 10, height: 10,
        borderRadius: '50%', background: swatch,
      }} />
      {label}
    </span>
  );
}

function EmptyState({ in_progress }) {
  if (in_progress) {
    return (
      <div style={{
        padding: '1.4rem 1.5rem',
        background: 'rgba(196,168,130,0.07)',
        border: '1px dashed rgba(196,168,130,0.35)',
        borderRadius: '14px',
      }}>
        <div style={{
          fontFamily: "'Syne', sans-serif",
          fontSize: '0.6rem', textTransform: 'uppercase',
          letterSpacing: '0.18em', color: 'var(--gold)',
          marginBottom: '0.6rem', fontWeight: 700,
        }}>
          Check-in in progress
        </div>
        <div style={{ fontSize: '0.9rem', color: 'var(--fg)', lineHeight: 1.6 }}>
          You've answered <strong>{in_progress.answered} of 9</strong> screening questions in your current session.
          Continue chatting in Therapy mode — Meridian asks one more every 5 messages — and your first full
          PHQ-9 score will appear here once all 9 are complete.
        </div>
      </div>
    );
  }
  return (
    <div className="empty-state" style={{ lineHeight: 1.7 }}>
      Your PHQ-9 trajectory will appear here once you complete a 9-question check-in
      during a Therapy session.
      <br />
      Meridian asks one PHQ-9 question every 5 messages, so a full cycle takes roughly 45 turns.
    </div>
  );
}

function InProgressNote({ in_progress }) {
  return (
    <div style={{
      marginTop: '1.5rem', padding: '0.9rem 1.2rem',
      background: 'rgba(196,168,130,0.06)',
      border: '1px solid rgba(196,168,130,0.18)',
      borderRadius: '10px',
      fontSize: '0.8rem', color: 'var(--muted)', lineHeight: 1.6,
    }}>
      <strong style={{
        color: 'var(--gold)', fontFamily: "'Syne', sans-serif",
        fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.15em'
      }}>
        Next check-in
      </strong>{' '}
      — you're <strong style={{ color: 'var(--fg)' }}>{in_progress.answered} of 9</strong> through
      another cycle in your current session.
    </div>
  );
}