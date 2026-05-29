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

  // ── Scroll-based nav style ─────────────────────────────
  useEffect(() => {
    const onScroll = () => {
      if (!navRef.current) return;
      navRef.current.classList.toggle('nav--scrolled', window.scrollY > 60);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // ── Intersection-observer scroll reveal + counters ─────
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
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    document.querySelectorAll('[data-reveal]').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  // ── Hero parallax + tilt cards + magnetic buttons ──────
  useEffect(() => {
    const onMove = (e) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 18;
      const y = (e.clientY / window.innerHeight - 0.5) * 18;
      if (heroTextRef.current) {
        heroTextRef.current.style.transform = `translate(${x * 0.6}px, ${y * 0.6}px)`;
        heroTextRef.current.style.transition = 'transform 0.6s ease-out';
      }
      if (chatPreviewRef.current) {
        chatPreviewRef.current.style.transform = `perspective(600px) rotateY(${x * 0.25}deg) rotateX(${-y * 0.25}deg) translateZ(5px)`;
        chatPreviewRef.current.style.transition = 'transform 0.6s ease-out, box-shadow 0.4s ease';
      }
    };
    document.addEventListener('mousemove', onMove);

    const tiltCards = document.querySelectorAll('.tilt-card');
    const cardCleanups = [];
    tiltCards.forEach((card) => {
      const onCardMove = (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const rotateX = ((y - rect.height / 2) / (rect.height / 2)) * -8;
        const rotateY = ((x - rect.width / 2) / (rect.width / 2)) * 8;
        card.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px)`;
      };
      const onCardLeave = () => {
        card.style.transform = 'perspective(800px) rotateX(0deg) rotateY(0deg) translateY(0px)';
        card.style.transition = 'transform 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.1)';
      };
      const onCardEnter = () => {
        card.style.transition = 'transform 0.1s ease-out, box-shadow 0.5s ease, border-color 0.5s ease';
      };
      card.addEventListener('mousemove', onCardMove);
      card.addEventListener('mouseleave', onCardLeave);
      card.addEventListener('mouseenter', onCardEnter);
      cardCleanups.push(() => {
        card.removeEventListener('mousemove', onCardMove);
        card.removeEventListener('mouseleave', onCardLeave);
        card.removeEventListener('mouseenter', onCardEnter);
      });
    });

    const magButtons = document.querySelectorAll('.btn-solid, .btn-light');
    const btnCleanups = [];
    magButtons.forEach((btn) => {
      const onBtnMove = (e) => {
        const rect = btn.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        btn.style.transform = `translate(${x * 0.35}px, ${y * 0.35}px) scale(1.04)`;
        btn.style.transition = 'transform 0.15s ease-out';
      };
      const onBtnLeave = () => {
        btn.style.transform = 'translate(0, 0) scale(1)';
        btn.style.transition = 'transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.1)';
      };
      btn.addEventListener('mousemove', onBtnMove);
      btn.addEventListener('mouseleave', onBtnLeave);
      btnCleanups.push(() => {
        btn.removeEventListener('mousemove', onBtnMove);
        btn.removeEventListener('mouseleave', onBtnLeave);
      });
    });

    return () => {
      document.removeEventListener('mousemove', onMove);
      cardCleanups.forEach((fn) => fn());
      btnCleanups.forEach((fn) => fn());
    };
  }, []);

  return (
    <div className="landing-root">
      <ShaderBackground />
      <CursorGlow />
      <AmbientOrbs variant="landing" />

      <header className="landing-nav-wrap">
        <nav ref={navRef} className="landing-nav" aria-label="Main">
          <Link to="/" className="landing-nav__logo serif">Meridian</Link>
          <div className="landing-nav__links">
            <a href="#benefits" className="link sans-label">Benefits</a>
            <a href="#how-it-works" className="link sans-label">How it Works</a>
            <a href="#trust" className="link sans-label">Technology</a>
            <Link to="/chat" className="btn-solid sans-label" style={{ position: 'relative' }}>
              <span className="pulse-ring" />
              Start Session
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
                <span className="hero-line-wrap"><span className="hero-line" style={{ '--i': 0 }}>Therapy tools that</span></span>
                <span className="hero-line-wrap"><span className="hero-line" style={{ '--i': 1 }}><i>actually listen.</i></span></span>
                <span className="hero-line-wrap"><span className="hero-line" style={{ '--i': 2 }}>No forms. No judgment.</span></span>
              </h1>
              <p className="hero-sub">
                Talk about your day. Get real coping skills from CBT, DBT, and mindfulness — with airtight
                privacy that protects your secrets before they ever touch the cloud.
              </p>
              <div className="hero-actions">
                <Link to="/chat" className="btn-solid sans-label" style={{ position: 'relative' }}>
                  <span className="pulse-ring" />
                  Begin anonymously
                </Link>
              </div>
            </div>

            <div className="chat-preview" ref={chatPreviewRef} aria-hidden="true">
              <div className="chat-bubble bubble-user">
                I've just been feeling incredibly overwhelmed lately... like I can't catch a break.
              </div>
              <div className="chat-bubble bubble-ai">
                I hear you. It sounds like you're carrying a lot right now. Let's take a deep breath together.
                Would it help to untangle some of those thoughts, or do you just need to vent?
              </div>
            </div>
          </div>
        </section>

        {/* BENEFITS ─────────────────────────────────────── */}
        <section id="benefits">
          <div className="section-wrap">
            <header className="section-header" data-reveal>
              <span className="section-eyebrow sans-label">Support On Your Terms</span>
              <h2 className="section-title serif">Relief shouldn't require paperwork.</h2>
            </header>
            <div className="grid-cards">
              {[
                { icon: '§', title: "Talk, Don't Fill Out Forms", body: "Meridian screens for depression and anxiety naturally as you chat. No cold questionnaires – just a conversation that understands you." },
                { icon: '◊', title: 'Built-In Coping Skills On-Demand', body: 'Switch to Mindfulness, CBT, or DBT mode anytime. Learn to challenge negative thoughts, regulate emotions, or ground yourself immediately.' },
                { icon: '—', title: 'A Listener That Remembers', body: 'Resume any session exactly where you left off. Your conversation, therapy framework, and context are restored instantly without repeating yourself.' },
                { icon: '×', title: 'Privacy Shielded Automatically', body: 'Names, locations, and emails are stripped out before any AI reads your words. You speak freely; the system forgets what matters most.' },
                { icon: '+', title: 'Safety-First When It Matters', body: 'If the system detects crisis language, it gently adapts and points you to immediate help resources. Not just a log – active care.' },
              ].map((c, i) => (
                <article key={c.title} className="card tilt-card" data-reveal style={{ '--i': i }}>
                  <div className="card-icon">{c.icon}</div>
                  <h3>{c.title}</h3>
                  <p>{c.body}</p>
                </article>
              ))}
            </div>
            <div className="stats-row" data-reveal style={{ '--i': 5 }}>
              <div className="stat-item"><div className="stat-num"><span className="counter" data-target="100">0</span>%</div><div className="stat-label">Anonymous Sessions</div></div>
              <div className="stat-item"><div className="stat-num"><span className="counter" data-target="0">0</span></div><div className="stat-label">Personal Data Stored</div></div>
              <div className="stat-item"><div className="stat-num"><span className="counter" data-target="24">0</span>/7</div><div className="stat-label">Always Available</div></div>
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
                { num: '01', title: "You share what's on your mind.", body: 'Type naturally about your day, your stress, or your goals. There are no right or wrong answers, only a space to be heard.' },
                { num: '02', title: 'Our privacy engine masks your details.', body: 'Before your message is processed, identifying details are scrubbed completely, ensuring your identity is untethered from your feelings.' },
                { num: '03', title: 'A specialized AI guides you.', body: 'Using evidence-based tools rather than generic responses, the system helps you process emotions and quietly checks in on your progress.' },
              ].map((p, i) => (
                <article key={p.num} className="protocol-item" data-reveal style={{ '--i': i }}>
                  <div className="protocol-num">{p.num}</div>
                  <h3 className="protocol-title serif">{p.title}</h3>
                  <p className="protocol-desc">{p.body}</p>
                </article>
              ))}
            </div>
            <div className="privacy-callout" data-reveal style={{ '--i': 3 }}>
              <p>We never store your raw identity. Period.</p>
            </div>
          </div>
        </section>

        {/* TRUST ─────────────────────────────────────────── */}
        <section id="trust">
          <div className="section-wrap">
            <header className="section-header" data-reveal>
              <span className="section-eyebrow sans-label">Why It's Different</span>
              <h2 className="section-title serif">Empathetic on the outside.<br />Clinical-grade on the inside.</h2>
            </header>
            <div className="trust-grid">
              {[
                { title: 'Not Guesswork — Clinical-Grade Screening', body: "We don't ask a standard chatbot to guess your state. Our detection model analyzes language patterns trained specifically on mental health data, matching clinical research standards." },
                { title: "Therapy That Doesn't Loop", body: 'Thanks to intelligent memory retrieval, Meridian avoids repeating the same advice or starting from scratch — a massive flaw in most AI companions.' },
                { title: 'Engineered to Prevent Abuse', body: 'A rigorous guardian layer blocks vulgar, off-topic, or jailbreak attempts, ensuring the AI stays focused, professional, and safe for you at all times.' },
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
          <h2 className="serif" data-reveal>Try a confidential conversation.</h2>
          <p data-reveal style={{ '--i': 1 }}>
            No waitlists. Just immediate, evidence-based support directly in your browser.
          </p>
          <Link to="/chat" className="btn-light sans-label" data-reveal style={{ '--i': 2, position: 'relative' }}>
            <span className="pulse-ring" />
            Start Your First Session
          </Link>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="footer-inner">
          <Link to="/" className="footer-logo serif">Meridian</Link>
          <p className="foot-reassurance">
            No data sold. No training on your conversations. HIPAA-ready privacy architecture.
          </p>
          <span className="foot-badge">Built with Microsoft Presidio for PII Redaction</span>
        </div>
        <div className="footer-bottom">
          <span className="footer-copy">© 2026 Meridian. Not a replacement for emergency medical care.</span>
        </div>
      </footer>
    </div>
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
