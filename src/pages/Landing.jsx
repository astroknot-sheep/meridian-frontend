import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import ShaderBackground from '../components/ShaderBackground.jsx';
import '../styles/landing.css';

/* ─────────────────── content (unchanged from original) ─────────────────── */

const TICKERS = [
  'Private by design',
  'Evidence-based care',
  'CBT · DBT · ACT · Mindfulness',
  'Remembers every session',
  'Crisis-safe, always',
  'No forms — just talk',
  'Your identity is never stored',
  'Here for you, 24/7',
];

const CONVO = [
  {
    you: "I've been carrying so much lately. I don't even know where to start.",
    ai: "That sounds really heavy — and it makes sense it's hard to know where to begin. We can go at your pace. Would it help to talk it through, or would you rather just let it out first?",
  },
  {
    you: "I keep telling myself I'm failing at everything.",
    ai: "That's a painful thing to carry. Notice the word \u201Ceverything\u201D — that's a pattern we call overgeneralization. Could we gently look at just one piece of it together?",
  },
  {
    you: "My mind won't switch off at night.",
    ai: "Racing thoughts at 2am are exhausting. Let's try one slow round of box breathing — in for four, hold four, out four. I'm right here with you.",
  },
];

const BENEFITS = [
  { icon: '§', title: 'No Forms — Just Talk', body: "Meridian understands how you're doing through honest conversation, not cold clinical questionnaires. You talk the way you'd talk to someone who genuinely gets it — and it listens like one." },
  { icon: '◊', title: 'Real Coping Skills, On Demand', body: 'Switch between CBT, DBT, ACT, mindfulness, and solution-focused approaches whenever you need to. These are the same evidence-based methods used in practice — broken down into one small, doable step at a time.' },
  { icon: '—', title: 'Support That Remembers You', body: 'Pick up any conversation exactly where you left off. Meridian carries what matters across sessions, so you never have to re-explain your story — or hear the same advice twice.' },
  { icon: '×', title: 'Private By Design', body: 'Your name, location, email, and anything else that could identify you is removed before a single word is processed — and never stored. Speak freely; the parts that identify you never leave your side.' },
  { icon: '+', title: 'Safe When It Counts Most', body: "If you're ever in real distress, Meridian doesn't improvise — it immediately connects you with vetted crisis lines and human support. Care always comes first." },
];

const STEPS = [
  { num: '01', title: "You say what's on your mind.", body: 'Type as much or as little as you want — about your day, your stress, your hopes. There are no right or wrong answers here. Only a space to be heard.' },
  { num: '02', title: 'Your identity is removed — instantly.', body: 'Before your words travel anywhere, anything that could identify you is stripped out and discarded. Your feelings are kept and understood; who you are stays private.' },
  { num: '03', title: "You're met with real skills, not scripts.", body: 'Instead of generic replies, you\u2019re guided with techniques from established therapy frameworks — and gently checked in on over time, so your progress is never lost.' },
];

const TRUST = [
  { title: 'Grounded In Evidence, Not Guesswork', body: "Meridian's read on how you're doing is built on language understanding trained specifically for mental health — not a generic chatbot taking a guess. Every coping tool it offers comes straight from established clinical frameworks." },
  { title: 'Continuity That Actually Holds', body: 'Most AI companions forget you the moment you close the tab. Meridian carries context forward, so your support builds on itself instead of starting from zero — and never loops the same advice back at you.' },
  { title: 'A Space That Stays Safe', body: 'A dedicated safeguarding layer keeps every conversation focused, respectful, and protected from misuse — and Meridian will never diagnose or prescribe. It stays a place for you, and only you, every single time.' },
];

/* ───────────────────────────────── page ─────────────────────────────────── */

export default function Landing() {
  const navRef = useRef(null);
  const railRef = useRef(null);

  // One rAF-throttled scroll listener drives both the nav state
  // and the meridian rail's drawn progress (CSS var --p).
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const doc = document.documentElement;
      const max = Math.max(doc.scrollHeight - window.innerHeight, 1);
      const p = Math.min(window.scrollY / max, 1);
      if (railRef.current) railRef.current.style.setProperty('--p', p.toFixed(4));
      if (navRef.current) navRef.current.classList.toggle('nav--scrolled', window.scrollY > 40);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  // Scroll reveals + stat counters.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          e.target.classList.add('revealed');
          e.target.querySelectorAll('.counter').forEach((c) => animateCounter(c));
          observer.unobserve(e.target);
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -60px 0px' }
    );
    document.querySelectorAll('[data-reveal]').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="landing-root">
      <ShaderBackground />

      {/* The meridian — a line your own progress draws down the page. */}
      <div className="meridian-rail" ref={railRef} aria-hidden="true">
        <span className="rail-fill" />
        <span className="rail-dot" />
      </div>

      <header className="lnav-wrap">
        <nav ref={navRef} className="lnav" aria-label="Main">
          <Link to="/" className="lnav__logo serif">Meridian</Link>
          <div className="lnav__links">
            <a href="#benefits" className="lnav__link sans-label">What You Get</a>
            <a href="#how-it-works" className="lnav__link sans-label">How it Works</a>
            <a href="#trust" className="lnav__link sans-label">Why Meridian</a>
            <Link to="/chat" className="lnav__cta sans-label">Start Talking</Link>
          </div>
        </nav>
      </header>

      <main>
        {/* HERO ───────────────────────────────────────────── */}
        <section className="hero">
          <div className="wrap hero-frame">
            <div className="hero-copy">
              <h1 className="hero-title serif">
                <span className="hl-mask"><span className="hl" style={{ '--i': 0 }}>A space to be heard,</span></span>
                <span className="hl-mask"><span className="hl" style={{ '--i': 1 }}><i>exactly as you are.</i></span></span>
                <span className="hl-mask"><span className="hl" style={{ '--i': 2 }}>No pressure. No judgment.</span></span>
              </h1>
              <div className="hero-low">
                <p className="hero-sub">
                  Talk through whatever's weighing on you and get real, evidence-based coping
                  skills — drawn from CBT, DBT, mindfulness, and more. Your name, location, and
                  personal details are stripped away before a single word is ever read or stored.
                  What you share stays yours.
                </p>
                <div className="hero-actions">
                  <Link to="/chat" className="btn-ink sans-label">Begin anonymously</Link>
                  <a href="#how-it-works" className="hero-scroll sans-label">How it works ↓</a>
                </div>
              </div>
            </div>
            <SessionPreview />
          </div>
        </section>

        {/* MARQUEE ─────────────────────────────────────────── */}
        <section className="ticker" aria-hidden="true">
          <div className="ticker-track">
            {[...TICKERS, ...TICKERS].map((t, i) => (
              <span className="ticker-item serif" key={i}>{t}</span>
            ))}
          </div>
        </section>

        {/* BENEFITS ────────────────────────────────────────── */}
        <section id="benefits" className="chapter">
          <div className="wrap">
            <header className="chapter-head" data-reveal>
              <span className="eyebrow sans-label">Support On Your Terms</span>
              <h2 className="chapter-title serif">Help shouldn't feel like paperwork.</h2>
            </header>

            <div className="index-list">
              {BENEFITS.map((c, i) => (
                <article className="index-row" data-reveal style={{ '--i': i }} key={c.title}>
                  <span className="index-glyph serif" aria-hidden="true">{c.icon}</span>
                  <h3 className="index-title serif">{c.title}</h3>
                  <p className="index-body">{c.body}</p>
                </article>
              ))}
            </div>

            <div className="stats-band" data-reveal>
              <div className="stat">
                <div className="stat-num serif"><span className="counter" data-target="100">0</span>%</div>
                <div className="stat-label sans-label">Anonymous &amp; Private</div>
              </div>
              <div className="stat">
                <div className="stat-num serif"><span className="counter" data-target="0">0</span></div>
                <div className="stat-label sans-label">Personal Details Stored</div>
              </div>
              <div className="stat">
                <div className="stat-num serif"><span className="counter" data-target="24">0</span>/7</div>
                <div className="stat-label sans-label">Always Here For You</div>
              </div>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS ────────────────────────────────────── */}
        <section className="chapter chapter--dark" id="how-it-works">
          <div className="wrap process-grid">
            <header className="process-rail" data-reveal>
              <span className="eyebrow sans-label">The Process</span>
              <h2 className="chapter-title serif">A safe space, designed from the ground up.</h2>
            </header>
            <div className="process-steps">
              {STEPS.map((p, i) => (
                <article className="step" data-reveal style={{ '--i': i }} key={p.num}>
                  <span className="step-num serif" aria-hidden="true">{p.num}</span>
                  <div className="step-text">
                    <h3 className="step-title serif">{p.title}</h3>
                    <p className="step-desc">{p.body}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
          <div className="vow" data-reveal>
            <p className="serif">Your identity is never stored. Not once. Not ever.</p>
          </div>
        </section>

        {/* TRUST ───────────────────────────────────────────── */}
        <section id="trust" className="chapter">
          <div className="wrap">
            <header className="chapter-head" data-reveal>
              <span className="eyebrow sans-label">Why It's Different</span>
              <h2 className="chapter-title serif">Gentle on the outside.<br />Clinical-grade on the inside.</h2>
            </header>
            <div className="trust-rows">
              {TRUST.map((t, i) => (
                <article className="trust-row" data-reveal style={{ '--i': i }} key={t.title}>
                  <h3 className="trust-title serif">{t.title}</h3>
                  <p className="trust-body">{t.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* CTA ─────────────────────────────────────────────── */}
        <section className="cta">
          <span className="cta-line" aria-hidden="true" />
          <h2 className="cta-title serif" data-reveal>You don't have to hold it all alone.</h2>
          <p className="cta-sub" data-reveal style={{ '--i': 1 }}>
            No waitlists. No paperwork. Just a private, evidence-based space to talk —
            open the moment you need it.
          </p>
          <Link to="/chat" className="btn-paper sans-label" data-reveal style={{ '--i': 2 }}>
            Begin when you're ready
          </Link>
        </section>
      </main>

      <footer className="lfooter">
        <div className="lfooter-inner">
          <Link to="/" className="lfooter-logo serif">Meridian</Link>
          <p className="lfooter-note">
            No data sold. No conversations used to train AI. Privacy is built into every
            layer — not bolted on afterward.
          </p>
          <span className="lfooter-badge sans-label">Privacy-First · Evidence-Based · Safety-Engineered</span>
        </div>
        <div className="lfooter-bottom">
          <span>© 2026 Meridian. Automated support — not a replacement for emergency or clinical care.</span>
        </div>
      </footer>
    </div>
  );
}

/* Hero transcript — the same three real exchanges, streamed live,
   set directly on the page like a quiet letter instead of a chat card. */
function SessionPreview() {
  const [i, setI] = useState(0);
  const [typed, setTyped] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    const line = CONVO[i].ai;
    setTyped('');
    setDone(false);
    let typer;
    let holder;
    const starter = setTimeout(() => {
      let c = 0;
      typer = setInterval(() => {
        c += 1;
        setTyped(line.slice(0, c));
        if (c >= line.length) {
          clearInterval(typer);
          setDone(true);
          holder = setTimeout(() => setI((p) => (p + 1) % CONVO.length), 3400);
        }
      }, 26);
    }, 700);
    return () => { clearTimeout(starter); clearInterval(typer); clearTimeout(holder); };
  }, [i]);

  return (
    <aside className="session" aria-hidden="true">
      <div className="session-inner" key={i}>
        <p className="session-you">{CONVO[i].you}</p>
        <p className="session-ai serif">
          {typed}
          {!done && <span className="caret" />}
        </p>
      </div>
    </aside>
  );
}

function animateCounter(el) {
  const target = parseInt(el.getAttribute('data-target'), 10);
  const duration = 1800;
  const start = performance.now();
  const update = (now) => {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(target * eased);
    if (progress < 1) requestAnimationFrame(update);
    else el.textContent = target;
  };
  requestAnimationFrame(update);
}