import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import ShaderBackground from '../components/ShaderBackground.jsx';
import '../styles/landing.css';

/* ────────────────────────────────────────────────────────────────────
   Copy — unchanged from the original page. Only presentation is new.
   ──────────────────────────────────────────────────────────────────── */

const NAV = [
  { href: '#benefits', label: 'What You Get' },
  { href: '#how-it-works', label: 'How it Works' },
  { href: '#trust', label: 'Why Meridian' },
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

const prefersReduced =
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function Landing() {
  const navRef = useRef(null);
  const barRef = useRef(null);

  /* Nav surface + reading-progress hairline. Scroll-driven only. */
  useEffect(() => {
    const onScroll = () => {
      if (navRef.current) navRef.current.classList.toggle('scrolled', window.scrollY > 32);
      if (barRef.current) {
        const el = document.documentElement;
        const max = el.scrollHeight - el.clientHeight;
        barRef.current.style.transform = `scaleX(${max > 0 ? el.scrollTop / max : 0})`;
      }
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* One reveal mechanism for the whole page. */
  useEffect(() => {
    const els = document.querySelectorAll('[data-rv]');
    if (prefersReduced) { els.forEach((el) => el.classList.add('on')); return undefined; }
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('on'); io.unobserve(e.target); }
      }),
      { threshold: 0.15, rootMargin: '0px 0px -8% 0px' }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className="lp">
      <ShaderBackground />
      <span className="lp-progress" ref={barRef} aria-hidden="true" />

      {/* ── Nav: full-width hairline bar, no pill ─────────────────── */}
      <header className="lp-nav" ref={navRef}>
        <div className="lp-wrap lp-nav-in">
          <Link to="/" className="lp-logo serif">Meridian</Link>
          <nav className="lp-links" aria-label="Main">
            {NAV.map((n) => <a key={n.href} href={n.href}>{n.label}</a>)}
            <Link to="/chat" className="lp-btn lp-btn--line">Start Talking</Link>
          </nav>
        </div>
      </header>

      <main>
        {/* ── Hero: editorial type lockup + live transcript ─────────── */}
        <section className="lp-hero">
          <div className="lp-wrap lp-hero-grid">
            <div className="lp-hero-copy">
              <h1 className="lp-h1 serif">
                <span className="w"><span className="l" style={{ '--i': 0 }}>A space to be heard,</span></span>
                <span className="w"><span className="l" style={{ '--i': 1 }}><i>exactly as you are.</i></span></span>
                <span className="w"><span className="l" style={{ '--i': 2 }}>No pressure. No judgment.</span></span>
              </h1>
              <p className="lp-sub lp-fade" style={{ '--d': '0.7s' }}>
                Talk through whatever's weighing on you and get real, evidence-based coping
                skills — drawn from CBT, DBT, mindfulness, and more. Your name, location, and
                personal details are stripped away before a single word is ever read or stored.
                What you share stays yours.
              </p>
              <div className="lp-actions lp-fade" style={{ '--d': '0.95s' }}>
                <Link to="/chat" className="lp-btn lp-btn--ink">Begin anonymously</Link>
                <a href="#how-it-works" className="lp-ul">How it works ↓</a>
              </div>
            </div>
            <Transcript />
          </div>
          <span className="lp-drip" aria-hidden="true" />
        </section>

        {/* ── Oversized serif marquee ───────────────────────────────── */}
        <section className="lp-marquee" aria-hidden="true">
          <div className="lp-marquee-track">
            {[...TICKERS, ...TICKERS].map((t, i) => <span key={i}>{t}</span>)}
          </div>
        </section>

        {/* ── Benefits as an editorial index, not cards ─────────────── */}
        <section id="benefits" className="lp-sec">
          <div className="lp-wrap">
            <header className="lp-head" data-rv>
              <span className="lp-eyebrow">Support On Your Terms</span>
              <h2 className="lp-title serif">Help shouldn't feel like paperwork.</h2>
            </header>
            <ol className="lp-index">
              {BENEFITS.map((b, i) => (
                <li key={b.title} data-rv style={{ '--d': `${i * 0.06}s` }}>
                  <span className="num">0{i + 1}</span>
                  <div className="row-body">
                    <h3><span className="g serif" aria-hidden="true">{b.icon}</span>{b.title}</h3>
                    <p>{b.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="lp-stats" data-rv>
              <div><span className="n serif">100<i>%</i></span><span className="t">Anonymous & Private</span></div>
              <div><span className="n serif">0</span><span className="t">Personal Details Stored</span></div>
              <div><span className="n serif">24<i>/7</i></span><span className="t">Always Here For You</span></div>
            </div>
          </div>
        </section>

        {/* ── Process: sticky stacking chapters (the signature) ─────── */}
        <section id="how-it-works" className="lp-dark">
          <div className="lp-wrap lp-dark-head" data-rv>
            <span className="lp-eyebrow">The Process</span>
            <h2 className="lp-title serif">A safe space, designed from the ground up.</h2>
          </div>
          <div className="lp-stack">
            {STEPS.map((s) => (
              <article className="lp-panel" key={s.num}>
                <div className="lp-wrap lp-panel-in">
                  <span className="lp-ghost serif" aria-hidden="true">{s.num}</span>
                  <div className="lp-step">
                    <span className="lp-step-num">{s.num}</span>
                    <h3 className="serif">{s.title}</h3>
                    <p>{s.body}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
          <div className="lp-wrap">
            <div className="lp-vow" data-rv>
              <p className="serif">Your identity is never stored. Not once. Not ever.</p>
            </div>
          </div>
        </section>

        {/* ── Trust: three quiet editorial columns ──────────────────── */}
        <section id="trust" className="lp-sec">
          <div className="lp-wrap">
            <header className="lp-head" data-rv>
              <span className="lp-eyebrow">Why It's Different</span>
              <h2 className="lp-title serif">Gentle on the outside.<br />Clinical-grade on the inside.</h2>
            </header>
            <div className="lp-trust">
              {TRUST.map((t, i) => (
                <article key={t.title} data-rv style={{ '--d': `${i * 0.08}s` }}>
                  <h3 className="serif">{t.title}</h3>
                  <p>{t.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ───────────────────────────────────────────────────── */}
        <section className="lp-cta">
          <div className="lp-wrap">
            <h2 className="serif" data-rv>You don't have to hold it all alone.</h2>
            <p data-rv style={{ '--d': '0.08s' }}>
              No waitlists. No paperwork. Just a private, evidence-based space to talk —
              open the moment you need it.
            </p>
            <Link to="/chat" className="lp-btn lp-btn--paper" data-rv style={{ '--d': '0.16s' }}>
              Begin when you're ready
            </Link>
          </div>
        </section>
      </main>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="lp-foot">
        <div className="lp-wrap">
          <div className="lp-foot-top">
            <Link to="/" className="lp-foot-logo serif">Meridian</Link>
            <p className="lp-foot-note">
              No data sold. No conversations used to train AI. Privacy is built into every
              layer — not bolted on afterward.
            </p>
          </div>
          <div className="lp-foot-bot">
            <span className="lp-badge">Privacy-First · Evidence-Based · Safety-Engineered</span>
            <span className="lp-copy">© 2026 Meridian. Automated support — not a replacement for emergency or clinical care.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* Live transcript artifact. Types each reply, holds, rotates.
   Purely time-driven — no mouse tracking anywhere on this page. */
function Transcript() {
  const [i, setI] = useState(0);
  const [typed, setTyped] = useState('');

  useEffect(() => {
    const line = CONVO[i].ai;
    if (prefersReduced) {
      setTyped(line);
      const hold = setTimeout(() => setI((p) => (p + 1) % CONVO.length), 5200);
      return () => clearTimeout(hold);
    }
    setTyped('');
    let typer; let hold; let c = 0;
    const start = setTimeout(() => {
      typer = setInterval(() => {
        c += 1;
        setTyped(line.slice(0, c));
        if (c >= line.length) {
          clearInterval(typer);
          hold = setTimeout(() => setI((p) => (p + 1) % CONVO.length), 3600);
        }
      }, 24);
    }, 650);
    return () => { clearTimeout(start); clearInterval(typer); clearTimeout(hold); };
  }, [i]);

  const done = typed.length >= CONVO[i].ai.length;

  return (
    <aside className="lp-chat lp-fade" style={{ '--d': '1.15s' }} aria-hidden="true">
      <div className="lp-chat-bar"><i /><i /><i /></div>
      <div className="lp-chat-body">
        <div className="bb you">{CONVO[i].you}</div>
        <div className="bb ai">
          {typed}
          {!done && <span className="caret" />}
        </div>
      </div>
    </aside>
  );
}