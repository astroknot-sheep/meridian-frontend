import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import ShaderBackground from '../components/ShaderBackground.jsx';
import CursorGlow from '../components/CursorGlow.jsx';
import AmbientOrbs from '../components/AmbientOrbs.jsx';
import '../styles/background.css';
import '../styles/landing.css';

export default function Landing() {
  const navRef = useRef(null);
  const heroTextRef = useRef(null);
  const chatPreviewRef = useRef(null);

  // ── Very subtle parallax on hero (no tilts, no magnetics) ──
  useEffect(() => {
    const onMove = (e) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 8;
      const y = (e.clientY / window.innerHeight - 0.5) * 8;
      if (heroTextRef.current) {
        heroTextRef.current.style.transform = `translate(${x * 0.4}px, ${y * 0.4}px)`;
      }
      if (chatPreviewRef.current) {
        chatPreviewRef.current.style.transform = `translate(${x * 0.15}px, ${y * 0.15}px)`;
      }
    };
    document.addEventListener('mousemove', onMove);
    return () => document.removeEventListener('mousemove', onMove);
  }, []);

  // ── Simple scroll reveal (fade + translate up) ──
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px -30px 0px' }
    );
    document.querySelectorAll('[data-reveal]').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  // ── Static nav (no scroll class toggling) ──

  return (
    <div className="landing-root">
      <ShaderBackground />
      <CursorGlow />
      <AmbientOrbs variant="landing" />

      <header className="landing-nav-wrap">
        <nav ref={navRef} className="landing-nav" aria-label="Main">
          <Link to="/" className="landing-nav__logo serif">Meridian</Link>
          <div className="landing-nav__links">
            <a href="#benefits" className="link sans-label">What You Get</a>
            <a href="#how-it-works" className="link sans-label">How it Works</a>
            <a href="#trust" className="link sans-label">Why Meridian</a>
            <Link to="/chat" className="btn-solid sans-label">
              Start Talking
            </Link>
          </div>
        </nav>
      </header>

      <main>
        {/* HERO ─────────────────────────────────────────── */}
        <section className="hero">
          <div className="hero-content">
            <div className="hero-text" ref={heroTextRef}>
              <h1>
                <span className="hero-line-wrap"><span className="hero-line">A space to be heard,</span></span>
                <span className="hero-line-wrap"><span className="hero-line"><i>exactly as you are.</i></span></span>
                <span className="hero-line-wrap"><span className="hero-line">No pressure. No judgment.</span></span>
              </h1>
              <p className="hero-sub">
                Talk through whatever’s weighing on you and get real, evidence-based coping
                skills — drawn from CBT, DBT, mindfulness, and more. Your name, location, and
                personal details are stripped away before a single word is ever read or stored.
                What you share stays yours.
              </p>
              <div className="hero-actions">
                <Link to="/chat" className="btn-solid sans-label">
                  Begin anonymously
                </Link>
              </div>
            </div>

            {/* Static chat preview – no tilt, just gentle parallax */}
            <div className="chat-preview" ref={chatPreviewRef} aria-hidden="true">
              <div className="chat-bubble bubble-user">
                I’ve been carrying so much lately. I don’t even know where to start.
              </div>
              <div className="chat-bubble bubble-ai">
                That sounds really heavy — and it makes complete sense that it’s hard to know
                where to begin. We can take this at your pace. Would it help to talk it through
                together, or would you rather just let it out first?
              </div>
            </div>
          </div>
        </section>

        {/* BENEFITS ─────────────────────────────────────── */}
        <section id="benefits">
          <div className="section-wrap">
            <header className="section-header" data-reveal>
              <span className="section-eyebrow sans-label">Support On Your Terms</span>
              <h2 className="section-title serif">Help shouldn’t feel like paperwork.</h2>
            </header>
            <div className="grid-cards">
              {[
                { icon: '—', title: 'No Forms — Just Talk', body: "Meridian understands how you’re doing through honest conversation, not cold clinical questionnaires. You talk the way you’d talk to someone who genuinely gets it — and it listens like one." },
                { icon: '—', title: 'Real Coping Skills, On Demand', body: 'Switch between CBT, DBT, ACT, mindfulness, and solution-focused approaches whenever you need to. These are the same evidence-based methods used in practice — broken down into one small, doable step at a time.' },
                { icon: '—', title: 'Support That Remembers You', body: 'Pick up any conversation exactly where you left off. Meridian carries what matters across sessions, so you never have to re-explain your story — or hear the same advice twice.' },
                { icon: '—', title: 'Private By Design', body: 'Your name, location, email, and anything else that could identify you is removed before a single word is processed — and never stored. Speak freely; the parts that identify you never leave your side.' },
                { icon: '—', title: 'Safe When It Counts Most', body: "If you’re ever in real distress, Meridian doesn’t improvise — it immediately connects you with vetted crisis lines and human support. Care always comes first." },
              ].map((c, i) => (
                <article key={c.title} className="card" data-reveal style={{ '--i': i }}>
                  <div className="card-icon">{c.icon}</div>
                  <h3>{c.title}</h3>
                  <p>{c.body}</p>
                </article>
              ))}
            </div>
            <div className="stats-row" data-reveal>
              <div className="stat-item"><div className="stat-num">100%</div><div className="stat-label">Anonymous &amp; Private</div></div>
              <div className="stat-item"><div className="stat-num">0</div><div className="stat-label">Personal Details Stored</div></div>
              <div className="stat-item"><div className="stat-num">24/7</div><div className="stat-label">Always Here For You</div></div>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS ─────────────────────────────────── */}
        <section className="section-dark" id="how-it-works">
          <div className="section-wrap">
            <header className="section-header" data-reveal>
              <span className="section-eyebrow sans-label">The Process</span>
              <h2 className="section-title serif">A safe space, designed from the ground up.</h2>
            </header>
            <div className="protocol-grid">
              {[
                { num: '01', title: "You say what’s on your mind.", body: 'Type as much or as little as you want — about your day, your stress, your hopes. There are no right or wrong answers here. Only a space to be heard.' },
                { num: '02', title: 'Your identity is removed — instantly.', body: 'Before your words travel anywhere, anything that could identify you is stripped out and discarded. Your feelings are kept and understood; who you are stays private.' },
                { num: '03', title: "You’re met with real skills, not scripts.", body: 'Instead of generic replies, you’re guided with techniques from established therapy frameworks — and gently checked in on over time, so your progress is never lost.' },
              ].map((p, i) => (
                <article key={p.num} className="protocol-item" data-reveal style={{ '--i': i }}>
                  <div className="protocol-num">{p.num}</div>
                  <h3 className="protocol-title serif">{p.title}</h3>
                  <p className="protocol-desc">{p.body}</p>
                </article>
              ))}
            </div>
            <div className="privacy-callout" data-reveal>
              <p>Your identity is never stored. Not once. Not ever.</p>
            </div>
          </div>
        </section>

        {/* TRUST ─────────────────────────────────────────── */}
        <section id="trust">
          <div className="section-wrap">
            <header className="section-header" data-reveal>
              <span className="section-eyebrow sans-label">Why It’s Different</span>
              <h2 className="section-title serif">Gentle on the outside.<br />Clinical-grade on the inside.</h2>
            </header>
            <div className="trust-grid">
              {[
                { title: 'Grounded In Evidence, Not Guesswork', body: "Meridian’s read on how you’re doing is built on language understanding trained specifically for mental health — not a generic chatbot taking a guess. Every coping tool it offers comes straight from established clinical frameworks." },
                { title: 'Continuity That Actually Holds', body: 'Most AI companions forget you the moment you close the tab. Meridian carries context forward, so your support builds on itself instead of starting from zero — and never loops the same advice back at you.' },
                { title: 'A Space That Stays Safe', body: 'A dedicated safeguarding layer keeps every conversation focused, respectful, and protected from misuse — and Meridian will never diagnose or prescribe. It stays a place for you, and only you, every single time.' },
              ].map((t, i) => (
                <article key={t.title} className="trust-item" data-reveal style={{ '--i': i }}>
                  <h3 className="serif">{t.title}</h3>
                  <p>{t.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* CTA ──────────────────────────────────────────── */}
        <section className="cta-section">
          <hr className="gradient-rule" style={{ width: 120, marginBottom: '4rem' }} />
          <h2 className="serif" data-reveal>You don’t have to hold it all alone.</h2>
          <p data-reveal style={{ '--i': 1 }}>
            No waitlists. No paperwork. Just a private, evidence-based space to talk —
            open the moment you need it.
          </p>
          <Link to="/chat" className="btn-light sans-label" data-reveal style={{ '--i': 2 }}>
            Begin when you’re ready
          </Link>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="footer-inner">
          <Link to="/" className="footer-logo serif">Meridian</Link>
          <p className="foot-reassurance">
            No data sold. No conversations used to train AI. Privacy is built into every
            layer — not bolted on afterward.
          </p>
          <span className="foot-badge">Privacy-First · Evidence-Based · Safety-Engineered</span>
        </div>
        <div className="footer-bottom">
          <span className="footer-copy">© 2026 Meridian. Automated support — not a replacement for emergency or clinical care.</span>
        </div>
      </footer>
    </div>
  );
}