import { useEffect, useRef, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiFetch } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import ProfileDropdown from '../components/ProfileDropdown.jsx';
import '../styles/chat.css';

const GLOW_THEMES = {
  therapy_cbt: 'rgba(196, 168, 130, 0.08)',
  therapy_act: 'rgba(184, 133, 108, 0.09)',
  therapy_dbt: 'rgba(130, 145, 160, 0.08)',
  therapy_mindfulness: 'rgba(130, 165, 140, 0.09)',
  therapy_sfbt: 'rgba(180, 155, 115, 0.08)',
  diagnosis: 'rgba(150, 145, 138, 0.08)',
};

const TYPING_STATES = [
  '[ processing thought ]',
  '[ gathering context ]',
  '[ parsing inflection ]',
  '[ structuralizing response ]',
  '[ framing cadence ]',
];

const generateUUID = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
};

/** Parse the `__ACCUMULATING__N/M\n…` envelope used by the screening mode. */
function parseAccumulating(text) {
  const m = (text || '').match(/^__ACCUMULATING__(\d+)\/(\d+)(?:\n|\s)*([\s\S]*)$/);
  if (m) {
    return {
      isAccumulating: true,
      charsDone: parseInt(m[1], 10),
      charsTarget: parseInt(m[2], 10),
      bodyText: m[3].trim(),
    };
  }
  return {
    isAccumulating: false,
    charsDone: 0,
    charsTarget: 0,
    bodyText: (text || '').replace(/^__ACCUMULATING__\d+\/\d+\n?/, '').trim(),
  };
}

function isScreeningReport(text) {
  return (
    text.includes('Linguistic Screening Report') ||
    (text.includes('| Indicator') && text.includes('Depression'))
  );
}

function escHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function inlineFormat(text) {
  return escHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
}

function renderScreeningHTML(raw) {
  const parsed = parseAccumulating(raw);
  const parts = parsed.bodyText.split(/\n---\n/);
  const body = parts[0];
  const disclaimer = parts[1] || '';
  const lines = body.split('\n');
  let html = '<div class="screen-report-container">';
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim().startsWith('|')) {
      const tl = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) { tl.push(lines[i]); i++; }
      const headers = tl[0].split('|').map((c) => c.trim()).filter(Boolean);
      html += '<table class="screen-table"><thead><tr>' +
        headers.map((h) => `<th>${inlineFormat(h)}</th>`).join('') +
        '</tr></thead><tbody>';
      for (let r = 2; r < tl.length; r++) {
        const cells = tl[r].split('|').map((c) => c.trim()).filter(Boolean);
        if (cells.length) html += '<tr>' + cells.map((c) => `<td>${inlineFormat(c)}</td>`).join('') + '</tr>';
      }
      html += '</tbody></table>';
      continue;
    }
    if (/^\*\*(.+?)\*\*$/.test(line.trim()) && line.trim().length < 60) {
      html += `<div class="screen-report-title serif">${escHtml(line.trim().replace(/^\*\*|\*\*$/g, ''))}</div>`;
      i++; continue;
    }
    if (line.trim() === '') { i++; continue; }
    html += `<div class="screen-summary">${inlineFormat(line)}</div>`;
    i++;
  }
  html += '</div>';
  if (disclaimer) {
    const clean = disclaimer.replace(/^\*|\*$/gm, '').replace(/^\s*⚠️\s*/, '').trim();
    html += `<div class="screen-disclaimer">⚠ ${escHtml(clean)}</div>`;
  }
  return html;
}

export default function Chat() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [mode, setMode] = useState('therapy');
  const [modality, setModality] = useState('cbt');
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Hello. I'm here to support you. How are you feeling today?", _initial: true },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [typing, setTyping] = useState(false);
  const [typingMsg, setTypingMsg] = useState(TYPING_STATES[0]);
  const sessionIdRef = useRef(searchParams.get('session') || generateUUID());
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const initialisedRef = useRef(false);
  const { session, signOut } = useAuth();

  // ── Auto-scroll on new messages ────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, typing]);

  // ── Typing animation cycler ────────────────────────────
  useEffect(() => {
    if (!typing) return;
    let idx = 0;
    const id = setInterval(() => {
      idx = (idx + 1) % TYPING_STATES.length;
      setTypingMsg(TYPING_STATES[idx]);
    }, 3500);
    return () => clearInterval(id);
  }, [typing]);

  // ── Update body glow on mode/modality change ───────────
  useEffect(() => {
    const themeKey = mode === 'therapy' ? `therapy_${modality}` : 'diagnosis';
    const targetGlow = GLOW_THEMES[themeKey] || GLOW_THEMES.therapy_cbt;
    document.documentElement.style.setProperty('--glow-color', targetGlow);
  }, [mode, modality]);

  // ── Load session metadata + messages from API ──────────
  const loadSessionMessages = useCallback(async (id) => {
    try {
      const res = await apiFetch(`/sessions/${id}/messages`);
      if (res.status === 401) {
        await signOut();
        window.location.href = '/auth';
        return;
      }
      if (res.status === 403) {
        window.location.href = '/onboarding';
        return;
      }
      if (!res.ok) throw new Error('Failed to load session messages');
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setMessages(data.map((m) => ({ role: m.role, content: m.content })));
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
    }
  }, [signOut]);

  // ── On mount: load explicit session or auto-resume latest ──
  useEffect(() => {
    if (initialisedRef.current) return;
    initialisedRef.current = true;

    (async () => {
      const explicit = searchParams.get('session');

      if (explicit) {
        // Pull session metadata so the selectors are restored.
        try {
          const res = await apiFetch('/sessions');
          if (res.ok) {
            const sessions = await res.json();
            const cur = sessions.find((s) => s.id === explicit);
            if (cur) {
              if (cur.mode) setMode(cur.mode);
              if (cur.modality) setModality(cur.modality);
            }
          }
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error('Failed to fetch session metadata:', e);
        }
        await loadSessionMessages(explicit);
      } else {
        // Resume the most recent session, if any.
        try {
          const res = await apiFetch('/sessions');
          if (res.ok) {
            const sessions = await res.json();
            if (sessions && sessions.length > 0) {
              const latest = sessions[0];
              sessionIdRef.current = latest.id;
              setSearchParams({ session: latest.id }, { replace: true });
              if (latest.mode) setMode(latest.mode);
              if (latest.modality) setModality(latest.modality);
              await loadSessionMessages(latest.id);
            }
          }
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error('Auto-resume failed:', e);
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Send a message ─────────────────────────────────────
  const sendMessage = async () => {
    const text = input.trim();
    if (!text || busy) return;

    const nextMessages = [...messages.filter((m) => !m._initial), { role: 'user', content: text }];
    setMessages(nextMessages);
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setBusy(true);
    setTyping(true);

    try {
      const res = await apiFetch('/chat', {
        method: 'POST',
        body: JSON.stringify({
          mode,
          modality,
          messages: nextMessages.map(({ role, content }) => ({ role, content })),
          session_id: sessionIdRef.current,
        }),
      });
      setTyping(false);

      if (res.status === 401) {
        await signOut();
        window.location.href = '/auth';
        return;
      }
      if (res.status === 403) {
        window.location.href = '/onboarding';
        return;
      }
      if (!res.ok) {
        setMessages((cur) => [...cur, {
          role: 'assistant',
          content: `Server error (${res.status}). Please try again.`,
        }]);
        return;
      }

      const data = await res.json();
      if (data.crisis_detected) {
        setMessages((cur) => [...cur, { role: 'assistant', _crisis: true, content: '' }]);
        return;
      }
      const reply = data.messages[0].content;
      const riskScores = data.risk_scores;
      setMessages((cur) => {
        const added = { role: 'assistant', content: reply };
        if (riskScores && typeof riskScores.depression === 'number') {
          added._riskProb = riskScores.depression;
        }
        return [...cur, added];
      });
    } catch (err) {
      setTyping(false);
      setMessages((cur) => [...cur, {
        role: 'assistant',
        content: 'Connection error — please check your internet connection and try again.',
      }]);
    } finally {
      setBusy(false);
      setTimeout(() => textareaRef.current?.focus(), 0);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const onInput = (e) => {
    setInput(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  };

  return (
    <div className="chat-page">
      <div className="ambient-orb-glow" />

      {/* Nav ─────────────────────────────────────── */}
      <header className="chat-nav-wrap">
        <nav className="chat-nav">
          <Link to="/" className="chat-nav__logo serif">
            Meridian<span className="logo-dot" />
          </Link>
          <div className="chat-nav__controls">
            <div className="ctrl-group">
              <span className="ctrl-label">Mode</span>
              <select value={mode} onChange={(e) => setMode(e.target.value)}>
                <option value="therapy">Therapy</option>
                <option value="diagnosis">Screening</option>
              </select>
            </div>
            {mode === 'therapy' && (
              <div className="ctrl-group">
                <span className="ctrl-label">Modality</span>
                <select value={modality} onChange={(e) => setModality(e.target.value)}>
                  <option value="cbt">CBT</option>
                  <option value="act">ACT</option>
                  <option value="dbt">DBT</option>
                  <option value="mindfulness">Mindfulness</option>
                  <option value="sfbt">Solution-Focused</option>
                </select>
              </div>
            )}
            <p className="hdr-note">{session?.user?.email || ''}</p>
            <ProfileDropdown />
          </div>
        </nav>
      </header>

      {/* Messages ────────────────────────────────── */}
      <div className="messages">
        {messages.map((m, i) => (
          <ChatMessage key={i} message={m} />
        ))}
        {typing && (
          <div className="typing-wrap">
            <div className="typing-meta">Meridian</div>
            <div className="typing-container">
              <div className="typing-breather">{typingMsg}</div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input ───────────────────────────────────── */}
      <div className="input-zone">
        <div className="input-bar-glass">
          <span className="input-who sans-label">You</span>
          <textarea
            ref={textareaRef}
            rows={1}
            placeholder="Type your thoughts here…"
            value={input}
            onChange={onInput}
            onKeyDown={onKeyDown}
          />
          <button
            className="send-btn sans-label"
            type="button"
            onClick={sendMessage}
            disabled={busy || !input.trim()}
          >
            Send
          </button>
        </div>
        <div className="input-footer">
          <span className="input-hint">↵ to send &nbsp;·&nbsp; ⇧↵ for newline</span>
          <span className="foot-disclaimer sans-label">
            Crisis (US) 988 &nbsp;·&nbsp; iCall (IN) 9152987821 &nbsp;·&nbsp;
            <a href="https://www.findahelpline.com" target="_blank" rel="noreferrer">
              findahelpline.com
            </a>
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── Individual message renderer ─────────────────── */
function ChatMessage({ message }) {
  if (message._crisis) return <CrisisBlock />;

  const { role, content, _riskProb } = message;
  const parsed = parseAccumulating(content);

  // Accumulating screening response
  if (role === 'assistant' && parsed.isAccumulating) {
    const filled = Math.min(10, Math.round((parsed.charsDone / parsed.charsTarget) * 10));
    const track = '█'.repeat(filled) + '░'.repeat(10 - filled);
    return (
      <div className="msg-wrap">
        <div className="msg-meta">Meridian</div>
        <div className="msg assistant accumulation-bubble">
          <div
            style={{ whiteSpace: 'normal' }}
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{
              __html: inlineFormat(parsed.bodyText).replace(/\n/g, '<br>'),
            }}
          />
          <div className="accumulation-indicator">
            <span className="accumulation-hint">Linguistic Mapping Integrity</span>
            <span className="accumulation-track">
              {track} &nbsp;{parsed.charsDone}/{parsed.charsTarget} raw metrics
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Full screening report
  if (role === 'assistant' && isScreeningReport(parsed.bodyText)) {
    return (
      <div className="msg-wrap">
        <div className="msg-meta">Meridian</div>
        <div
          className="msg assistant"
          style={{ whiteSpace: 'normal' }}
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: renderScreeningHTML(parsed.bodyText) }}
        />
        {typeof _riskProb === 'number' && <RiskBadgeInline prob={_riskProb} />}
      </div>
    );
  }

  // Normal assistant message
  if (role === 'assistant') {
    return (
      <div className="msg-wrap">
        <div className="msg-meta">Meridian</div>
        <div
          className="msg assistant"
          style={{ whiteSpace: 'normal' }}
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{
            __html: inlineFormat(parsed.bodyText).replace(/\n/g, '<br>'),
          }}
        />
        {typeof _riskProb === 'number' && <RiskBadgeInline prob={_riskProb} />}
      </div>
    );
  }

  // User message
  return (
    <div className="msg-wrap user">
      <div className="msg-meta">You</div>
      <div className="msg user">{content}</div>
    </div>
  );
}

function RiskBadgeInline({ prob }) {
  const pct = Math.round(prob * 100);
  const level = pct < 30 ? 'low' : pct < 60 ? 'moderate' : 'elevated';
  return <div className={`risk-line risk-${level}`}>— depression signal {pct}% ({level})</div>;
}

function CrisisBlock() {
  return (
    <div className="crisis-wrap">
      <div className="crisis-label">I'm concerned about your safety</div>
      <div className="crisis-body">
        Please reach out to someone right now.
        <br /><br />
        <strong>988 Suicide &amp; Crisis Lifeline</strong> — call or text 988 (US, free, 24/7)
        <br />
        <strong>iCall</strong> — 9152987821 (India, Mon–Sat 8am–10pm IST)
        <br />
        <strong>Samaritans</strong> — 116 123 (UK, free, 24/7)
        <br /><br />
        <a href="https://www.findahelpline.com" target="_blank" rel="noreferrer">findahelpline.com</a> — worldwide directory
      </div>
    </div>
  );
}
