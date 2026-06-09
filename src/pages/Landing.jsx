import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import * as THREE from 'three';
import '../styles/landing.css';

/* ════════════ Gentlerain-style living water (no mouse) ════════════
   One full-screen shader. Scroll dives from a cream "surface" into a
   dark amber depth. Ripples are emitted by the page itself: chat
   messages, crossing the surface, moving between palace rooms.      */

const FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uTime, uDepth, uFlow, uTintA;
uniform vec2 uRes;
uniform vec3 uTint;
uniform vec4 uRipples[3]; /* xy: center, z: birth time, w: strength */

vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec2 mod289(vec2 x){return x-floor(x*(1.0/289.0))*289.0;}
vec3 permute(vec3 x){return mod289(((x*34.0)+1.0)*x);}
float snoise(vec2 v){
  const vec4 C=vec4(0.211324865405187,0.366025403784439,-0.577350269189626,0.024390243902439);
  vec2 i=floor(v+dot(v,C.yy)); vec2 x0=v-i+dot(i,C.xx);
  vec2 i1=(x0.x>x0.y)?vec2(1.0,0.0):vec2(0.0,1.0);
  vec4 x12=x0.xyxy+C.xxzz; x12.xy-=i1; i=mod289(i);
  vec3 p=permute(permute(i.y+vec3(0.0,i1.y,1.0))+i.x+vec3(0.0,i1.x,1.0));
  vec3 m=max(0.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.0);
  m=m*m;m=m*m;
  vec3 x=2.0*fract(p*C.www)-1.0; vec3 h=abs(x)-0.5;
  vec3 ox=floor(x+0.5); vec3 a0=x-ox;
  m*=1.79284291400159-0.85373472095314*(a0*a0+h*h);
  vec3 g; g.x=a0.x*x0.x+h.x*x0.y; g.yz=a0.yz*x12.xz+h.yz*x12.yw;
  return 130.0*dot(m,g);
}
float fbm(vec2 p){float f=0.0,a=0.5;for(int i=0;i<5;i++){f+=a*snoise(p);p*=2.05;a*=0.5;}return f;}

void main(){
  vec2 asp=vec2(uRes.x/max(uRes.y,1.0),1.0);
  vec2 uv=vUv;
  float t=uTime*0.10;

  /* ripple rings: displace the water + flash of light */
  vec2 duv=uv; float flash=0.0;
  for(int i=0;i<3;i++){
    vec4 R=uRipples[i];
    float age=uTime-R.z;
    if(age>0.0 && age<4.0){
      vec2 d=(uv-R.xy)*asp;
      float dist=length(d);
      float wave=sin(dist*38.0-age*5.2)*exp(-dist*5.5)*exp(-age*1.25)*R.w;
      duv+=normalize(d+0.0001)*wave*0.030;
      flash+=exp(-dist*7.0)*exp(-age*1.8)*R.w;
    }
  }

  /* domain-warped flow — the gentlerain liquid */
  vec2 q=vec2(fbm(duv*2.2+vec2(t*0.30,uFlow-t*0.18)),
              fbm(duv*2.2+vec2(-t*0.24,uFlow+t*0.22)));
  vec2 r=vec2(fbm(duv*2.7+q*1.15+vec2(t*0.55,uFlow*0.6)),
              fbm(duv*2.7+q*1.15-vec2(t*0.32,t*0.42)));
  float n=fbm(duv*1.9+r);

  /* caustic shimmer — light refracting through the water */
  float ca=pow(smoothstep(0.45,1.0,snoise(duv*5.5+q*2.4+vec2(t*0.7,uFlow))),2.0);

  vec3 gold=vec3(0.77,0.66,0.51);

  /* surface: warm clay (kriss palette) */
  vec3 surf=mix(vec3(0.957,0.937,0.910),vec3(0.906,0.871,0.824),uv.y*0.45+n*0.55);
  surf=mix(surf,gold,smoothstep(0.15,1.0,n)*0.20);
  surf+=ca*gold*0.20;

  /* depth: cinematic dark amber (formless) */
  vec3 deep=mix(vec3(0.051,0.043,0.035),vec3(0.110,0.090,0.070),n*0.6+uv.y*0.25);
  deep=mix(deep,gold*0.55,smoothstep(0.30,1.05,n)*0.30);
  deep+=ca*gold*0.16;

  vec3 col=mix(surf,deep,uDepth);
  col=mix(col,uTint,uTintA*0.12*(0.45+n*0.5));            /* room mood   */
  col+=flash*mix(gold,vec3(1.0),0.35)*(0.16+uDepth*0.22); /* ripple glow */

  float v=smoothstep(1.45,0.42,length((uv-0.5)*asp*1.05));
  col*=mix(1.0,mix(0.92,0.58,uDepth),1.0-v);
  gl_FragColor=vec4(col,1.0);
}`;
const VERT = `varying vec2 vUv; void main(){vUv=uv; gl_Position=vec4(position,1.0);}`;

const clamp01 = (x) => Math.min(Math.max(x, 0), 1);

function WaterScene() {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return undefined;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    } catch { return undefined; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, window.innerWidth < 768 ? 1.5 : 2));
    renderer.setSize(window.innerWidth, window.innerHeight);

    const scene = new THREE.Scene();
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const uni = {
      uTime: { value: reduce ? 8 : 0 },
      uDepth: { value: 0 },
      uFlow: { value: 0 },
      uTint: { value: new THREE.Color('#C4A882') },
      uTintA: { value: 0 },
      uRes: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
      uRipples: { value: [new THREE.Vector4(0, 0, -99, 0), new THREE.Vector4(0, 0, -99, 0), new THREE.Vector4(0, 0, -99, 0)] },
    };
    const geo = new THREE.PlaneGeometry(2, 2);
    const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: uni, depthWrite: false, depthTest: false });
    scene.add(new THREE.Mesh(geo, mat));

    let raf = 0; let slot = 0; let dived = false;
    const tintT = new THREE.Color('#C4A882'); let tintAT = 0;
    const lf = reduce ? 1 : 0.05;
    const now = () => performance.now() * 0.001;

    const ripple = (x = 0.5, y = 0.5, s = 0.8) => {
      if (reduce) return;
      uni.uRipples.value[slot].set(x, y, now(), s);
      slot = (slot + 1) % 3;
    };

    const frame = () => {
      if (!reduce) uni.uTime.value = now();
      const vh = window.innerHeight || 1;
      const dive = document.getElementById('dive');
      let tDepth = 0;
      if (dive) {
        const rt = dive.getBoundingClientRect();
        tDepth = clamp01((vh * 0.95 - rt.top) / (vh * 0.65));
      }
      if (tDepth > 0.5 && !dived) { dived = true; ripple(0.5, 0.55, 1.0); }
      if (tDepth < 0.2) dived = false;
      uni.uDepth.value += (tDepth - uni.uDepth.value) * lf;
      uni.uFlow.value += (window.scrollY / vh * 0.35 - uni.uFlow.value) * lf;
      uni.uTint.value.lerp(tintT, lf);
      uni.uTintA.value += (tintAT - uni.uTintA.value) * lf;
      renderer.render(scene, cam);
    };
    const loop = () => { frame(); raf = requestAnimationFrame(loop); };

    const onResize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      uni.uRes.value.set(window.innerWidth, window.innerHeight);
      if (reduce) frame();
    };
    const onScroll = () => { if (reduce) frame(); };
    const onRipple = (e) => ripple(e.detail?.x, e.detail?.y, e.detail?.s);
    const onTint = (e) => { tintT.set(e.detail?.c || '#C4A882'); tintAT = e.detail?.a ?? 0; if (reduce) frame(); };

    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('mind-ripple', onRipple);
    window.addEventListener('mind-tint', onTint);
    if (reduce) frame(); else raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('mind-ripple', onRipple);
      window.removeEventListener('mind-tint', onTint);
      geo.dispose(); mat.dispose(); renderer.dispose();
    };
  }, []);
  return <canvas ref={ref} className="water-canvas" aria-hidden="true" />;
}

const ripple = (x, y, s) => window.dispatchEvent(new CustomEvent('mind-ripple', { detail: { x, y, s } }));
const tint = (c, a) => window.dispatchEvent(new CustomEvent('mind-tint', { detail: { c, a } }));

/* ════════════ Formless-style conversation (auto-playing) ════════════ */

const SCRIPT = [
  {
    you: 'I’ve been carrying a lot lately. I don’t even know where to start.',
    ai: 'Then we don’t have to start anywhere in particular. There’s no clock on this. What feels heaviest right now?'
  },
  {
    you: 'I keep telling myself I’m failing at everything.',
    ai: 'That word — everything — is doing a lot of cruel work there. Could we hold one piece of it up to the light together?'
  },
  {
    you: 'My mind won’t switch off at night.',
    ai: '2am thoughts are loud. Let’s slow the room down: in for four, hold for four, out for four. I’m right here while you do.'
  },
];

function HeroChat() {
  const [i, setI] = useState(0);
  const [phase, setPhase] = useState('user'); // user → typing → stream → hold
  const [typed, setTyped] = useState('');

  useEffect(() => {
    const line = SCRIPT[i].ai;
    setPhase('user'); setTyped('');
    ripple(0.5, 0.45, 0.35);
    const timers = [];
    timers.push(setTimeout(() => setPhase('typing'), 750));
    timers.push(setTimeout(() => {
      setPhase('stream');
      let c = 0;
      const typer = setInterval(() => {
        c += 1; setTyped(line.slice(0, c));
        if (c >= line.length) {
          clearInterval(typer);
          setPhase('hold');
          ripple(0.5, 0.5, 0.85);
          timers.push(setTimeout(() => setI((p) => (p + 1) % SCRIPT.length), 3400));
        }
      }, 24);
      timers.push({ clear: () => clearInterval(typer) });
    }, 1750));
    return () => timers.forEach((t) => (t.clear ? t.clear() : clearTimeout(t)));
  }, [i]);

  return (
    <div className="hero-chat" aria-hidden="true">
      <div className="hero-chat__head">
        <span className="pulse-dot" />
        <span className="hero-chat__name sans-label">Meridian — live</span>
      </div>
      <div className="bubble bubble--you" key={`u${i}`}>{SCRIPT[i].you}</div>
      {phase === 'typing' && (
        <div className="bubble bubble--ai bubble--dots" key={`t${i}`}>
          <span className="dot" /><span className="dot" /><span className="dot" />
        </div>
      )}
      {(phase === 'stream' || phase === 'hold') && (
        <div className="bubble bubble--ai" key={`a${i}`}>
          {typed}{phase === 'stream' && <span className="caret" />}
        </div>
      )}
    </div>
  );
}

/* ════════════ Kriss-style mind palace (sticky 3D corridor) ════════════ */

const ROOMS = [
  { tag: 'CBT', name: 'The Reframing Room', c: '#C4A882', d: 'Catch the loops — “always”, “never”, “everything” — and gently take them apart, one thought at a time.' },
  { tag: 'DBT', name: 'The Steady Room', c: '#8FA3B8', d: 'For when feelings run hot. Skills to ride the wave without being pulled under by it.' },
  { tag: 'ACT', name: 'The Open Room', c: '#B8856C', d: 'Make space for hard feelings instead of fighting them, and move toward what matters to you.' },
  { tag: 'Mindfulness', name: 'The Stillness Room', c: '#86A78D', d: 'Breath, body, this exact moment. Practices that quiet the noise without demanding silence.' },
  { tag: 'SFBT', name: 'The Forward Room', c: '#C2A06A', d: 'Less about what’s broken, more about what’s next: small, concrete steps for this week.' },
];
const GAP = 560; // z distance between rooms (px)
const N = ROOMS.length;

function MindPalace() {
  const trackRef = useRef(null);
  const worldRef = useRef(null);
  const roomRefs = useRef([]);
  const idxRef = useRef(0);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0; let p = 0;
    const step = () => {
      const track = trackRef.current; const world = worldRef.current;
      if (track && world) {
        const vh = window.innerHeight || 1;
        const rect = track.getBoundingClientRect();
        const total = Math.max(track.offsetHeight - vh, 1);
        const target = clamp01(-rect.top / total);
        p += (target - p) * (reduce ? 1 : 0.08); // buttery damped camera
        const travel = p * GAP * (N - 1);
        world.style.transform = `translateZ(${travel.toFixed(1)}px)`;
        roomRefs.current.forEach((node, i) => {
          if (!node) return;
          const z = travel - i * GAP; // >0 ⇒ behind the camera
          const o = z > 0 ? Math.max(0, 1 - z / 240) : Math.max(0.05, 1 - (-z) / (GAP * 2.5));
          node.style.opacity = o.toFixed(3);
          node.style.filter = `blur(${(z > 0 ? Math.min(10, z / 30) : Math.min(7, (-z) / (GAP * 0.55))).toFixed(2)}px)`;
        });
        const ai = Math.round(p * (N - 1));
        if (ai !== idxRef.current) {
          idxRef.current = ai; setIdx(ai);
          ripple(0.5, 0.5, 0.7);
          tint(ROOMS[ai].c, 1);
        }
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => { cancelAnimationFrame(raf); tint('#C4A882', 0); };
  }, []);

  const goTo = (i) => {
    const track = trackRef.current;
    if (!track) return;
    const top = track.getBoundingClientRect().top + window.scrollY;
    const total = track.offsetHeight - window.innerHeight;
    window.scrollTo({ top: top + (i / (N - 1)) * total, behavior: 'smooth' });
  };

  return (
    <section ref={trackRef} className="palace" style={{ height: `${N * 110}vh` }} aria-label="The mind palace">
      <div className="palace__stage">
        <header className="palace__hud">
          <span className="sec__eyebrow sans-label">The Mind Palace</span>
          <h2 className="serif">Five rooms.<br />One steady presence.</h2>
          <p className="palace__sub">Keep scrolling — the camera carries you from door to door. Switch rooms mid-conversation, whenever you need.</p>
        </header>

        <div className="palace__cam">
          <div ref={worldRef} className="palace__world">
            {ROOMS.map((r, i) => (
              <article
                key={r.tag}
                ref={(el) => { roomRefs.current[i] = el; }}
                className={`door ${i === idx ? 'door--active' : ''}`}
                style={{ '--rc': r.c, '--z': `${-i * GAP}px`, '--ox': `${i % 2 ? 9 : -9}vw`, '--ry': `${i % 2 ? -5 : 5}deg` }}
              >
                <span className="door__hotspot" />
                <span className="door__num serif">0{i + 1}</span>
                <span className="door__tag sans-label">{r.tag}</span>
                <h3 className="door__name serif">{r.name}</h3>
                <p className="door__desc">{r.d}</p>
              </article>
            ))}
          </div>
        </div>

        <nav className="palace__rail" aria-label="Rooms">
          {ROOMS.map((r, i) => (
            <button
              key={r.tag} type="button"
              className={`rail__dot ${i === idx ? 'rail__dot--on' : ''}`}
              style={{ '--rc': r.c }}
              onClick={() => goTo(i)}
              aria-label={r.name}
            >
              <span className="rail__label sans-label">{r.name}</span>
            </button>
          ))}
        </nav>

        <div className="palace__count sans-label">
          0{idx + 1} <span>/ 0{N}</span> — {ROOMS[idx].name}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════ page ═══════════════════════════ */

const STEPS = [
  { n: '01', t: 'You speak freely.', d: 'About your day, the 2am spirals, the things you haven’t said out loud. As much or as little as you want — there are no fields to fill.' },
  { n: '02', t: 'Your identity dissolves.', d: 'Before your words travel anywhere, names, places and anything identifying is removed and discarded. The feeling is kept; the who never leaves your side.' },
  { n: '03', t: 'You’re met with skills, not scripts.', d: 'Guided one small, doable step at a time by established therapy frameworks — and the work carries forward between sessions, so you never start from zero.' },
];

export default function Landing() {
  const navRef = useRef(null);

  useEffect(() => {
    const onScroll = () => {
      const dive = document.getElementById('dive');
      const deep = dive ? dive.getBoundingClientRect().top < window.innerHeight * 0.35 : false;
      navRef.current?.classList.toggle('lnav--deep', deep);
      navRef.current?.classList.toggle('lnav--scrolled', window.scrollY > 50);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const obs = new IntersectionObserver(
      (es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('revealed'); obs.unobserve(e.target); } }),
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' },
    );
    document.querySelectorAll('[data-reveal]').forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  return (
    <div className="landing-root">
      <WaterScene />

      <header className="lnav-wrap">
        <nav ref={navRef} className="lnav" aria-label="Main">
          <Link to="/" className="lnav__logo serif">Meridian<span className="ldot" /></Link>
          <div className="lnav__links">
            <a href="#dive" className="lnav__link sans-label">The Palace</a>
            <a href="#how" className="lnav__link sans-label">How It Works</a>
            <a href="#safety" className="lnav__link sans-label">Safety</a>
            <Link to="/chat" className="btn-ink sans-label">Start Talking</Link>
          </div>
        </nav>
      </header>

      <main className="lmain">
        {/* ── HERO — the page opens as a conversation ── */}
        <section className="hero">
          <p className="hero__eyebrow sans-label">A private space to be heard</p>
          <h1>
            <span className="hl"><span className="hl__in" style={{ '--i': 0 }}>Some things are easier said</span></span>
            <span className="hl"><span className="hl__in" style={{ '--i': 1 }}><i>to the water.</i></span></span>
          </h1>
          <p className="hero__sub">
            Meridian is an evidence-based space to talk through whatever you’re carrying —
            CBT, DBT, ACT, mindfulness — while your name and anything identifying is
            stripped away before a single word is read.
          </p>

          <Link to="/chat" className="hero-input" aria-label="Start talking to Meridian">
            <span className="hero-input__ph">Type your thoughts here…<span className="caret caret--ink" /></span>
            <span className="hero-input__send sans-label">Begin →</span>
          </Link>
          <p className="hero__note sans-label">No forms · anonymous by design · free to begin</p>

          <HeroChat />
        </section>

        {/* ── THE DIVE — the water darkens past this line ── */}
        <section id="dive" className="dive">
          <hr className="dive__rule" />
          <h2 className="serif" data-reveal>Below the surface,<br /><i>the presence keeps five rooms.</i></h2>
          <p className="dive__hint sans-label" data-reveal style={{ '--i': 1 }}>keep scrolling ↓</p>
        </section>

        {/* ── KRISS MIND PALACE ── */}
        <MindPalace />

        {/* ── HOW IT WORKS ── */}
        <section id="how" className="sec">
          <header className="sec__head" data-reveal>
            <span className="sec__eyebrow sans-label">The Process</span>
            <h2 className="sec__title serif">Built so you can say anything.</h2>
          </header>
          <div className="steps">
            {STEPS.map((s, i) => (
              <article key={s.n} className="step" data-reveal style={{ '--i': i }}>
                <div className="step__num serif">{s.n}</div>
                <h3 className="step__title serif">{s.t}</h3>
                <p className="step__desc">{s.d}</p>
              </article>
            ))}
          </div>
          <div className="callout" data-reveal style={{ '--i': 3 }}>
            <p>Your name never enters the room. Not stored. Not once.</p>
          </div>
        </section>

        {/* ── SAFETY ── */}
        <section id="safety" className="sec sec--tight">
          <div className="safety" data-reveal>
            <span className="safety__tag sans-label">Safe when it counts</span>
            <p>
              Meridian is automated support, not crisis care. If you’re ever in immediate
              distress it steps back and points you to humans, right away —{' '}
              <strong>988</strong> (US) · <strong>iCall 9152987821</strong> (IN) ·{' '}
              <a href="https://www.findahelpline.com" target="_blank" rel="noreferrer">findahelpline.com</a> worldwide.
            </p>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="cta">
          <h2 className="serif" data-reveal>Step into the quiet.</h2>
          <p data-reveal style={{ '--i': 1 }}>
            No waitlists. No paperwork. No name required. Just a steady presence,
            open the moment you need it.
          </p>
          <Link to="/chat" className="hero-input hero-input--deep" data-reveal style={{ '--i': 2 }}>
            <span className="hero-input__ph">Say what’s on your mind…<span className="caret" /></span>
            <span className="hero-input__send sans-label">Begin →</span>
          </Link>
        </section>
      </main>

      <footer className="lfoot">
        <div className="lfoot__top">
          <span className="lfoot__logo serif">Meridian</span>
          <p>No data sold. No conversations used to train AI. Privacy is built into every layer — not bolted on afterward.</p>
          <span className="lfoot__badge sans-label">Privacy-first · Evidence-based · Crisis-safe</span>
        </div>
        <div className="lfoot__bottom">© 2026 Meridian — automated support, not a replacement for emergency or clinical care.</div>
      </footer>
    </div>
  );
}