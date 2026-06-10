// src/pages/Landing.jsx
// Meridian landing — one continuous scroll journey:
//   the surface (hero) → a real conversation → the five rooms →
//   the descent (page submerges into dark water: privacy & safety) → the door.
// Scroll-driven only. No mouse tracking anywhere.

import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import ShaderBackground from '../components/ShaderBackground.jsx';
import '../styles/landing.css';

/* ── Content ─────────────────────────────────────────────── */

const DIALOGUE = [
  {
    you: 'I don’t even know where to start.',
    mer: 'Then don’t start at the beginning. Start with today. What’s the heaviest thing you carried into this evening?',
  },
  {
    you: 'I keep telling myself I’m failing at everything.',
    mer: '“Everything” is doing a lot of work in that sentence. Pick one thing it points to, and we’ll look at it in daylight.',
  },
  {
    you: 'My mind won’t switch off at night.',
    mer: 'Late thoughts lie with great confidence. While they talk: in for four, hold for four, out for four. I’ll count with you.',
  },
];

const ROOMS = [
  {
    n: '01', art: 'arch', name: 'The Listening Room',
    body: 'Talk the way you’d talk to someone who gets it. Meridian reads tone, pace and the words you actually choose, not boxes you tick, and it follows where you lead instead of marching you through a script.',
  },
  {
    n: '02', art: 'steps', name: 'The Practice Room',
    body: 'For the days you want more than sympathy: CBT, DBT, ACT, mindfulness and solution-focused work, translated into one small step you can actually take tonight.',
  },
  {
    n: '03', art: 'plate', name: 'The Unmarked Room',
    body: 'Your name, your city, your email address. All of it is stripped out and destroyed before a single word is read. What’s left is feeling without identity, and none of it is ever stored.',
  },
  {
    n: '04', art: 'hall', name: 'The Long Hall',
    body: 'Sessions connect. Meridian keeps the thread: what helped, what didn’t, what you said last Tuesday. You never have to retell your story from zero.',
  },
  {
    n: '05', art: 'door', name: 'The Open Door',
    body: 'If a conversation turns into a crisis, Meridian doesn’t improvise. It steps aside and puts real human help directly in front of you: 988, iCall, lines near you.',
  },
];

const STEPS = [
  {
    n: 'I.', t: 'You write.',
    b: 'As much or as little as you want. There isn’t a required field anywhere in Meridian.',
  },
  {
    n: 'II.', t: 'Identity comes off at the door.',
    b: 'Names, places and anything traceable are removed and destroyed before your words are processed. The system reads the feeling, never the person.',
  },
  {
    n: 'III.', t: 'You get craft, not scripts.',
    b: 'Every reply draws on established clinical frameworks and passes a safeguarding layer before it reaches you. The thread is kept for next time.',
  },
];

/* ── Hand-drawn room marks (stroke draws itself on reveal) ── */

function RoomArt({ kind }) {
  const P = { className: 'draw', pathLength: 1 };
  return (
    <svg className="ld-room-art" viewBox="0 0 96 96" aria-hidden="true">
      {kind === 'arch' && (
        <>
          <path {...P} d="M26 84 V46 a22 22 0 0 1 44 0 V84" />
          <path {...P} d="M16 84 h64" />
          <path {...P} d="M48 84 V60" opacity=".45" />
        </>
      )}
      {kind === 'steps' && (
        <>
          <path {...P} d="M14 82 h17 v-13 h17 v-13 h17 v-13 h17 V30" />
          <path {...P} d="M14 86 h68" opacity=".45" />
        </>
      )}
      {kind === 'plate' && (
        <>
          <rect {...P} x="28" y="16" width="40" height="68" rx="2" />
          <rect {...P} x="38" y="32" width="20" height="11" rx="1.5" />
          <circle {...P} cx="61" cy="56" r="1.8" />
        </>
      )}
      {kind === 'hall' && (
        <>
          <rect {...P} x="14" y="14" width="68" height="70" />
          <rect {...P} x="29" y="32" width="38" height="52" />
          <rect {...P} x="40" y="46" width="16" height="38" />
          <path {...P} d="M14 14 L40 46 M82 14 L56 46" opacity=".45" />
        </>
      )}
      {kind === 'door' && (
        <>
          <path {...P} d="M30 86 V18 h36 v68" />
          <path {...P} d="M30 18 L54 28 V92 L30 86 Z" />
          <path {...P} d="M60 50 h16 M60 58 h11" opacity=".5" />
        </>
      )}
    </svg>
  );
}

/* ── One exchange: your line, then Meridian types its reply ─ */

function Exchange({ you, mer, idx }) {
  const ref = useRef(null);
  const [typed, setTyped] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let timer;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      if (reduced) { setTyped(mer); setDone(true); return; }
      let i = 0;
      timer = setInterval(() => {
        i += 1;
        setTyped(mer.slice(0, i));
        if (i >= mer.length) { clearInterval(timer); setDone(true); }
      }, 22);
    }, { threshold: 0.35 });
    io.observe(el);
    return () => { io.disconnect(); clearInterval(timer); };
  }, [mer]);

  return (
    <div className="ld-exchange" ref={ref} data-reveal style={{ '--d': `${idx * 0.05}s` }}>
      <p className="ld-you">“{you}”</p>
      <div className="ld-mer">
        <span className="ld-mer-tag">Meridian</span>
        <p>
          {typed}
          {!done && <i className="ld-caret" aria-hidden="true" />}
        </p>
      </div>
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────── */

export default function Landing() {
  const [scrolled, setScrolled] = useState(false);
  const [inverse, setInverse] = useState(false);
  const deepRef = useRef(null);

  // Scroll reveals (one-shot).
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      }),
      { threshold: 0.16, rootMargin: '0px 0px -7% 0px' },
    );
    document.querySelectorAll('.ld-root [data-reveal]').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  // Nav state: hairline bar after a little scroll; light text over deep water.
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setScrolled(window.scrollY > 32);
        const r = deepRef.current?.getBoundingClientRect();
        setInverse(!!r && r.top < 84 && r.bottom > 0);
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); };
  }, []);

  return (
    <div className="ld-root">
      <ShaderBackground />

      <header className={`ld-nav ${scrolled ? 'is-scrolled' : ''} ${inverse ? 'is-inverse' : ''}`}>
        <Link to="/" className="ld-wordmark">Meridian<span className="logo-dot" /></Link>
        <nav className="ld-nav-right" aria-label="Main">
          <Link to="/auth" className="ld-nav-link">Sign in</Link>
          <Link to="/chat" className="ld-btn ld-btn--ink">Start talking <i>→</i></Link>
        </nav>
      </header>

      <main>
        {/* The surface */}
        <section className="ld-hero">
          <div className="ld-wrap">
            <p className="ld-eyebrow ld-hero-eyebrow">( a private place to talk )</p>
            <h1 className="ld-h1">
              <span className="ld-mask"><span className="ld-line" style={{ '--i': 0 }}>Say the thing</span></span>
              <span className="ld-mask"><span className="ld-line ld-ind" style={{ '--i': 1 }}>you haven’t said</span></span>
              <span className="ld-mask"><span className="ld-line" style={{ '--i': 2 }}><em>out loud</em> yet.</span></span>
            </h1>
            <div className="ld-hero-foot">
              <p className="ld-sub">
                Meridian is a quiet, evidence-based space to think through what’s
                weighing on you. No forms. No waiting room. No record of who you are.
              </p>
              <div className="ld-hero-actions">
                <Link to="/chat" className="ld-btn ld-btn--ink">Start talking <i>→</i></Link>
                <a href="#conversation" className="ld-ghostlink">See inside</a>
              </div>
            </div>
            <ul className="ld-caption">
              <li>Open all hours</li>
              <li>Anonymous by architecture</li>
              <li>CBT · DBT · ACT · Mindfulness</li>
            </ul>
          </div>
          <div className="ld-scrollcue" aria-hidden="true"><span /></div>
        </section>

        {/* A conversation, not an intake form */}
        <section className="ld-dialogue" id="conversation">
          <div className="ld-wrap ld-narrow">
            <p className="ld-eyebrow" data-reveal>( 01 · a conversation, not an intake form )</p>
            {DIALOGUE.map((d, i) => (
              <Exchange key={d.you} you={d.you} mer={d.mer} idx={i} />
            ))}
            <p className="ld-foot-note" data-reveal>
              Composite exchanges, written to show the shape of a session.
              Your own words stay between you and the page.
            </p>
          </div>
        </section>

        {/* The rooms */}
        <section className="ld-rooms">
          <div className="ld-wrap">
            <header className="ld-rooms-head" data-reveal>
              <p className="ld-eyebrow">( 02 · the rooms )</p>
              <h2 className="ld-h2">Built like a house, not an app.</h2>
              <p>Five rooms. Each one has a job.</p>
            </header>
            {ROOMS.map((r, i) => (
              <article key={r.n} className={`ld-room ${i % 2 ? 'flip' : ''}`} data-reveal>
                <div className="ld-room-side">
                  <span className="ld-room-n">{r.n}</span>
                  <RoomArt kind={r.art} />
                </div>
                <div className="ld-room-body">
                  <h3>{r.name}</h3>
                  <p>{r.body}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* The descent — the page submerges from here down */}
        <div className="ld-deep" data-water-deep ref={deepRef}>
          <section className="ld-how">
            <div className="ld-wrap">
              <p className="ld-eyebrow" data-reveal>( 03 · below the surface )</p>
              <h2 className="ld-h2" data-reveal>What happens to your words.</h2>
              <div className="ld-steps">
                {STEPS.map((s, i) => (
                  <div className="ld-step" key={s.n} data-reveal style={{ '--d': `${i * 0.06}s` }}>
                    <span className="ld-step-n">{s.n}</span>
                    <div>
                      <h3>{s.t}</h3>
                      <p>{s.b}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <p className="ld-vow" data-reveal>Who you are never enters the room.</p>

          {/* The door */}
          <section className="ld-cta">
            <div className="ld-wrap">
              <h2 className="ld-h2 ld-cta-h" data-reveal>Whenever you’re ready.</h2>
              <p data-reveal style={{ '--d': '0.08s' }}>
                No waitlist, no paperwork, nothing to install. The door is unlocked.
              </p>
              <Link to="/chat" className="ld-btn ld-btn--light" data-reveal style={{ '--d': '0.16s' }}>
                Begin anonymously <i>→</i>
              </Link>
            </div>
          </section>

          <footer className="ld-footer">
            <div className="ld-wrap">
              <div className="ld-footer-top">
                <Link to="/" className="ld-wordmark">Meridian<span className="logo-dot" /></Link>
                <p className="ld-footer-note">
                  Meridian is automated support, not a replacement for clinical or
                  emergency care. No data is sold, and no conversation is ever used
                  to train models.
                </p>
              </div>
              <p className="ld-crisis">
                <strong>In crisis right now?</strong>
                <span>988 (US)</span>
                <span>iCall 9152987821 (India)</span>
                <span>Samaritans 116 123 (UK)</span>
                <a href="https://www.findahelpline.com" target="_blank" rel="noreferrer">findahelpline.com</a>
              </p>
              <div className="ld-footer-bottom">
                <span>© 2026 Meridian</span>
                <span>Privacy-first · Evidence-based · Crisis-safe</span>
              </div>
            </div>
          </footer>
        </div>
      </main>
    </div>
  );
}