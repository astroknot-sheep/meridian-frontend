import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import ShaderBackground from '../components/ShaderBackground.jsx';
import '../styles/landing.css';

/* ── Copy (unchanged) ──────────────────────────────────────────── */
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

export default function Landing() {
  const navWrapRef = useRef(null);
  const barRef = useRef(null);
  const roomRefs = useRef([]);
  const [room, setRoom] = useState(0);

  /* Scroll progress hairline + nav surface */
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const max = document.documentElement.scrollHeight - window.innerHeight;
        if (barRef.current) {
          barRef.current.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`;
        }
        navWrapRef.current?.classList.toggle('is-scrolled', window.scrollY > 24);
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  /* Quiet scroll reveals */
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in');
            obs.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -7% 0px' }
    );
    document.querySelectorAll('[data-rv]').forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  /* Sticky numeral tracks which benefit sits mid-viewport */
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setRoom(Number(e.target.dataset.idx));
        });
      },
      { rootMargin: '-46% 0px -46% 0px' }
    );
    roomRefs.current.forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, []);

  return (
    <div className="landing-root">
      <ShaderBackground />
      <span ref={barRef} className="ld-progress" aria-hidden="true" />

      <header ref={navWrapRef} className="ld-nav-wrap">
        <nav className="ld-nav" aria-label="Main">
          <Link to="/" className="ld-logo serif">Meridian</Link>
          <div className="ld-nav-links">
            <a href="#benefits" className="ld-nav-link">What You Get</a>
            <a href="#how-it-works" className="ld-nav-link">How it Works</a>
            <a href="#trust" className="ld-nav-link">Why Meridian</a>
            <Link to="/chat" className="ld-btn ld-btn-dark ld-btn-sm">Start Talking</Link>
          </div>
        </nav>
      </header>

      <main>
        {/* HERO — staircase headline over the fluid shader */}
        <section className="ld-hero">
          <h1>
            <span className="ld-h1-line"><span style={{ '--i': 0 }}>A space to be heard,</span></span>
            <span className="ld-h1-line"><span style={{ '--i': 1 }}>exactly as you are.</span></span>
            <span className="ld-h1-line"><span style={{ '--i': 2 }}>No pressure. No judgment.</span></span>
          </h1>
          <div className="ld-hero-rule" aria-hidden="true" />
          <div className="ld-hero-low">
            <p className="ld-hero-sub">
              Talk through whatever's weighing on you and get real, evidence-based coping
              skills — drawn from CBT, DBT, mindfulness, and more. Your name, location, and
              personal details are stripped away before a single word is ever read or stored.
              What you share stays yours.
            </p>
            <div className="ld-hero-actions">
              <Link to="/chat" className="ld-btn ld-btn-dark">Begin anonymously</Link>
              <a href="#how-it-works" className="ld-link-quiet">How it works ↓</a>
            </div>
          </div>
        </section>

        {/* TICKER — hairline manifest strip */}
        <section className="ld-ticker" aria-hidden="true">
          <div className="ld-ticker-track">
            {[...TICKERS, ...TICKERS].map((t, i) => (
              <span className="ld-tick-item" key={i}>{t}</span>
            ))}
          </div>
        </section>

        {/* TRANSCRIPT — the conversation as the centerpiece */}
        <Transcript />

        {/* BENEFITS — sticky numeral rail, scrolled entries */}
        <section className="ld-band" id="benefits">
          <div className="ld-inner">
            <header className="ld-sec-head" data-rv>
              <span className="ld-eyebrow">Support On Your Terms</span>
              <h2 className="ld-title serif">Help shouldn't feel like paperwork.</h2>
            </header>

            <div className="ld-rooms">
              <aside className="ld-rooms-rail" aria-hidden="true">
                <div className="ld-rail-sticky">
                  <span className="ld-rail-num serif" key={room}>
                    {String(room + 1).padStart(2, '0')}
                  </span>
                  <span className="ld-rail-total">/ 05</span>
                  <span className="ld-rail-glyph serif">{BENEFITS[room].icon}</span>
                </div>
              </aside>
              <div className="ld-rooms-list">
                {BENEFITS.map((b, i) => (
                  <article
                    key={b.title}
                    className="ld-room"
                    data-rv
                    data-idx={i}
                    ref={(el) => { roomRefs.current[i] = el; }}
                  >
                    <div className="ld-room-meta">
                      <span>{String(i + 1).padStart(2, '0')}</span>
                      <span className="serif">{b.icon}</span>
                    </div>
                    <h3 className="serif">{b.title}</h3>
                    <p>{b.body}</p>
                  </article>
                ))}
              </div>
            </div>

            <div className="ld-stats" data-rv>
              <div className="ld-stat">
                <span className="ld-stat-num serif">100<em>%</em></span>
                <span className="ld-stat-label">Anonymous &amp; Private</span>
              </div>
              <div className="ld-stat">
                <span className="ld-stat-num serif">0</span>
                <span className="ld-stat-label">Personal Details Stored</span>
              </div>
              <div className="ld-stat">
                <span className="ld-stat-num serif">24<em>/7</em></span>
                <span className="ld-stat-label">Always Here For You</span>
              </div>
            </div>
          </div>
        </section>

        {/* PROCESS — dark descent, staggered ledger rows */}
        <section className="ld-band ld-dark" id="how-it-works">
          <div className="ld-inner">
            <header className="ld-sec-head" data-rv>
              <span className="ld-eyebrow">The Process</span>
              <h2 className="ld-title serif">A safe space, designed from the ground up.</h2>
            </header>
            <ol className="ld-steps">
              {STEPS.map((s) => (
                <li className="ld-step" data-rv key={s.num}>
                  <span className="ld-step-num serif" aria-hidden="true">{s.num}</span>
                  <div>
                    <h3 className="serif">{s.title}</h3>
                    <p>{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="ld-vow serif" data-rv>
              Your identity is never stored. <i>Not once. Not ever.</i>
            </p>
          </div>
        </section>

        {/* TRUST — ledger rows, claim left / argument right */}
        <section className="ld-band" id="trust">
          <div className="ld-inner">
            <header className="ld-sec-head" data-rv>
              <span className="ld-eyebrow">Why It's Different</span>
              <h2 className="ld-title serif">
                Gentle on the outside.<br />Clinical-grade on the inside.
              </h2>
            </header>
            <div className="ld-trust">
              {TRUST.map((t) => (
                <article className="ld-trust-row" data-rv key={t.title}>
                  <h3 className="serif">{t.title}</h3>
                  <p>{t.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="ld-band ld-dark ld-cta">
          <div className="ld-inner">
            <h2 className="serif" data-rv>You don't have to hold it all alone.</h2>
            <p data-rv>
              No waitlists. No paperwork. Just a private, evidence-based space to talk —
              open the moment you need it.
            </p>
            <Link to="/chat" className="ld-btn ld-btn-light" data-rv>
              Begin when you're ready
            </Link>
          </div>
        </section>
      </main>

      <footer className="ld-footer">
        <div className="ld-foot-top">
          <div>
            <Link to="/" className="ld-foot-logo serif">Meridian</Link>
            <p className="ld-foot-copy">
              No data sold. No conversations used to train AI. Privacy is built into every
              layer — not bolted on afterward.
            </p>
          </div>
          <span className="ld-foot-badge">Privacy-First · Evidence-Based · Safety-Engineered</span>
        </div>
        <div className="ld-foot-bottom">
          <span>© 2026 Meridian. Automated support — not a replacement for emergency or clinical care.</span>
        </div>
      </footer>
    </div>
  );
}

/* ── Typed transcript — replies set themselves in serif on a dark stage ── */
function Transcript() {
  const [i, setI] = useState(0);
  const [typed, setTyped] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    const line = CONVO[i].ai;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let starter; let typer; let holder;

    if (reduce) {
      setTyped(line);
      setDone(true);
      holder = setTimeout(() => setI((p) => (p + 1) % CONVO.length), 6000);
    } else {
      setTyped('');
      setDone(false);
      starter = setTimeout(() => {
        let c = 0;
        typer = setInterval(() => {
          c += 1;
          setTyped(line.slice(0, c));
          if (c >= line.length) {
            clearInterval(typer);
            setDone(true);
            holder = setTimeout(() => setI((p) => (p + 1) % CONVO.length), 3600);
          }
        }, 24);
      }, 850);
    }
    return () => {
      clearTimeout(starter);
      clearInterval(typer);
      clearTimeout(holder);
    };
  }, [i]);

  return (
    <section className="ld-transcript ld-dark" aria-label="Example conversation">
      <div className="ld-inner ld-tr-inner">
        <div className="ld-tr-head">
          <span className="ld-eyebrow ld-eyebrow--dim">You</span>
          <span className="ld-tr-count">
            {String(i + 1).padStart(2, '0')} / {String(CONVO.length).padStart(2, '0')}
          </span>
        </div>
        <p className="ld-tr-user" key={`u${i}`}>{CONVO[i].you}</p>

        <span className="ld-eyebrow">Meridian</span>
        <p className="ld-tr-ai serif">
          {typed}
          {!done && <span className="ld-caret" aria-hidden="true" />}
        </p>

        <div className="ld-tr-dots" aria-hidden="true">
          {CONVO.map((_, d) => <i key={d} className={d === i ? 'on' : ''} />)}
        </div>
      </div>
    </section>
  );
}