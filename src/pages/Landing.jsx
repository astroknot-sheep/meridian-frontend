import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import * as THREE from 'three';
import '../styles/landing.css';

/* ════════════════════════════ GLSL ════════════════════════════ */

const SNOISE = /* glsl */ `
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
  m=m*m; m=m*m;
  vec3 x=2.0*fract(p*C.www)-1.0; vec3 h=abs(x)-0.5;
  vec3 ox=floor(x+0.5); vec3 a0=x-ox;
  m*=1.79284291400159-0.85373472095314*(a0*a0+h*h);
  vec3 g; g.x=a0.x*x0.x+h.x*x0.y; g.yz=a0.yz*x12.xz+h.yz*x12.yw;
  return 130.0*dot(m,g);
}`;

/* Fluid, gentlerain-style dark fog layer with cursor warmth */
const BG_VERT = `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position,1.0); }`;
const BG_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uTime; uniform float uScroll;
uniform vec2 uMouse; uniform vec2 uRes;
${SNOISE}
float fbm(vec2 p){ float f=0.0,a=0.5; for(int i=0;i<4;i++){ f+=a*snoise(p); p*=2.07; a*=0.5; } return f; }
void main(){
  vec2 uv=vUv;
  vec2 asp=vec2(uRes.x/max(uRes.y,1.0),1.0);
  float t=uTime*0.045;
  vec2 q=vec2(fbm(uv*1.9+t), fbm(uv*1.9-t*1.4));
  float n=fbm(uv*2.5+q*0.85+vec2(0.0,uScroll*0.9));
  vec3 col=mix(vec3(0.040,0.036,0.031), vec3(0.075,0.066,0.056), uv.y*0.7+n*0.45);
  col=mix(col, vec3(0.275,0.225,0.160), smoothstep(0.30,1.05,n)*0.34);
  float hd=length((uv-vec2(0.5,0.62))*asp);                 /* halo behind the presence */
  col+=vec3(0.155,0.118,0.075)*exp(-hd*hd*3.4)*(1.0-min(uScroll,1.0));
  float md=length((uv-uMouse)*asp);                         /* cursor warmth */
  col+=vec3(0.165,0.120,0.070)*exp(-md*md*6.0);
  float v=smoothstep(1.35,0.40,length((uv-0.5)*asp*1.08));  /* vignette */
  col*=mix(0.62,1.0,v);
  gl_FragColor=vec4(col,1.0);
}`;

/* Epiminds-style particle presence: morphs sphere → wave-sea → halo on scroll,
   repels from the cursor, bursts on chat pulses, tints on room hover. */
const P_VERT = /* glsl */ `
attribute vec3 aP1; attribute vec3 aP2; attribute float aSeed;
uniform float uTime, uMorph, uPulse, uPx;
uniform vec3 uMouse; /* xy = world cursor, z = strength */
varying float vSeed, vGlow;
void main(){
  float m1=smoothstep(0.0,1.0,clamp(uMorph,0.0,1.0));
  float m2=smoothstep(0.0,1.0,clamp(uMorph-1.0,0.0,1.0));
  vec3 pos=mix(mix(position,aP1,m1),aP2,m2);
  float t=uTime;
  pos.x+=0.11*sin(t*0.70+aSeed*17.0+pos.y*1.7);
  pos.y+=0.11*sin(t*0.62+aSeed*23.0+pos.x*1.5);
  pos.z+=0.11*cos(t*0.66+aSeed*29.0+pos.x*1.3);
  pos.y+=m1*(1.0-m2)*0.5*sin(pos.x*1.25+t*1.05+pos.z*0.9);   /* sea swell  */
  pos*=1.0+(1.0-m1)*0.04*sin(t*0.9+aSeed*6.2831);            /* breathing  */
  pos+=normalize(pos+0.0001)*uPulse*(0.30+0.45*fract(aSeed*7.13)); /* burst */
  vec2 d=pos.xy-uMouse.xy; float dist=length(d);
  pos.xy+=(d/max(dist,0.001))*exp(-dist*dist*1.5)*uMouse.z*0.55;
  vec4 mv=modelViewMatrix*vec4(pos,1.0);
  gl_Position=projectionMatrix*mv;
  float s=1.1+2.0*fract(aSeed*3.7);
  gl_PointSize=s*(1.0+uPulse*0.9)*uPx*(9.0/-mv.z);
  vSeed=aSeed;
  vGlow=exp(-dist*dist*1.5)*uMouse.z*1.4+uPulse*0.55;
}`;
const P_FRAG = /* glsl */ `
precision highp float;
varying float vSeed, vGlow;
uniform vec3 uTintC; uniform float uTintA;
void main(){
  float d=length(gl_PointCoord-0.5);
  float a=smoothstep(0.5,0.06,d);
  vec3 col=mix(vec3(0.77,0.66,0.51), vec3(0.72,0.52,0.42), fract(vSeed*5.1));
  col=mix(col, vec3(0.95,0.92,0.86), smoothstep(0.78,1.0,fract(vSeed*9.3))*0.85);
  col=mix(col, uTintC, uTintA);
  col+=vGlow*0.5;
  gl_FragColor=vec4(col, a*(0.30+0.5*fract(vSeed*4.7)));
}`;

/* ═══════════════════════ WebGL presence ═══════════════════════ */

function PresenceScene() {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return undefined;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isMobile = window.innerWidth < 768;
    const COUNT = isMobile ? 5500 : 14000;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
    } catch {
      return undefined; // no WebGL → solid dark background remains
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.autoClear = false;

    // ── background fog quad ──
    const bgScene = new THREE.Scene();
    const bgCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const bgUni = {
      uTime: { value: reduce ? 5 : 0 },
      uScroll: { value: 0 },
      uMouse: { value: new THREE.Vector2(0.5, 0.55) },
      uRes: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
    };
    const bgGeo = new THREE.PlaneGeometry(2, 2);
    const bgMat = new THREE.ShaderMaterial({ vertexShader: BG_VERT, fragmentShader: BG_FRAG, uniforms: bgUni, depthWrite: false, depthTest: false });
    bgScene.add(new THREE.Mesh(bgGeo, bgMat));

    // ── particle presence ──
    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 60);
    cam.position.set(0, 0, 6);

    const p0 = new Float32Array(COUNT * 3); // sphere
    const p1 = new Float32Array(COUNT * 3); // wave field
    const p2 = new Float32Array(COUNT * 3); // halo ring
    const seeds = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      const k = i * 3;
      const t = i / COUNT;
      const ga = i * 2.39996323;
      const y = 1 - 2 * t;
      const r = Math.sqrt(Math.max(0, 1 - y * y));
      const R = 1.55 + (Math.random() - 0.5) * 0.22;
      p0[k] = Math.cos(ga) * r * R; p0[k + 1] = y * R * 1.04; p0[k + 2] = Math.sin(ga) * r * R;
      p1[k] = (Math.random() - 0.5) * 8.4; p1[k + 1] = (Math.random() - 0.5) * 0.8; p1[k + 2] = (Math.random() - 0.5) * 4.6;
      const a = Math.random() * Math.PI * 2;
      const rr = 2.15 + (Math.random() - 0.5) * 0.5;
      p2[k] = Math.cos(a) * rr; p2[k + 1] = Math.sin(a) * rr * 0.55; p2[k + 2] = (Math.random() - 0.5) * 0.5;
      seeds[i] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(p0, 3));
    geo.setAttribute('aP1', new THREE.BufferAttribute(p1, 3));
    geo.setAttribute('aP2', new THREE.BufferAttribute(p2, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    const uni = {
      uTime: { value: reduce ? 5 : 0 },
      uMorph: { value: 0 },
      uPulse: { value: 0 },
      uPx: { value: renderer.getPixelRatio() },
      uMouse: { value: new THREE.Vector3(0, 0, 0) },
      uTintC: { value: new THREE.Color('#C4A882') },
      uTintA: { value: 0 },
    };
    const mat = new THREE.ShaderMaterial({
      vertexShader: P_VERT, fragmentShader: P_FRAG, uniforms: uni,
      transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(geo, mat);
    points.position.y = 0.35;
    scene.add(points);

    // ── interaction state ──
    let raf = 0;
    let mxT = 0.5; let myT = 0.55; let mStr = 0; let pulse = 0;
    const tintNow = new THREE.Color('#C4A882');
    const tintTarget = new THREE.Color('#C4A882');
    let tintA = 0; let tintAT = 0;
    const lf = reduce ? 1 : 0.05; // lerp factor (instant when reduced motion)

    const frame = (now) => {
      if (!reduce) { uni.uTime.value = now * 0.001; bgUni.uTime.value = now * 0.001; }

      // scroll → morph + fog drift
      const h = window.innerHeight || 1;
      const sy = window.scrollY;
      const morphT = Math.min(sy / (h * 1.25), 1) + Math.min(Math.max((sy - h * 2.9) / (h * 1.1), 0), 1);
      uni.uMorph.value += (morphT - uni.uMorph.value) * lf;
      bgUni.uScroll.value += (Math.min(sy / h, 2.5) * 0.45 - bgUni.uScroll.value) * lf;

      // cursor (screen space for fog, world space for particles)
      const bm = bgUni.uMouse.value;
      bm.x += (mxT - bm.x) * 0.05; bm.y += (myT - bm.y) * 0.05;
      mStr *= 0.965;
      const vh = 2 * cam.position.z * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
      const wm = uni.uMouse.value;
      wm.x += ((mxT - 0.5) * vh * cam.aspect - wm.x) * 0.07;
      wm.y += ((myT - 0.5) * vh - points.position.y - wm.y) * 0.07;
      wm.z += (mStr - wm.z) * 0.08;

      // pulses + tint
      pulse *= 0.93;
      uni.uPulse.value = pulse;
      tintNow.lerp(tintTarget, lf);
      uni.uTintC.value.copy(tintNow);
      tintA += (tintAT - tintA) * lf;
      uni.uTintA.value = tintA * 0.65;

      // camera choreography
      const m = uni.uMorph.value;
      const m1 = Math.min(m, 1);
      const m2 = Math.max(m - 1, 0);
      if (!reduce) points.rotation.y += 0.0009;
      points.rotation.x += (-0.62 * m1 * (1 - m2) - points.rotation.x) * 0.04;
      cam.position.x += ((bm.x - 0.5) * 0.7 - cam.position.x) * 0.03;
      cam.position.y += ((bm.y - 0.55) * 0.45 + m1 * (1 - m2) * 1.2 - cam.position.y) * 0.03;
      cam.position.z += (6 + m1 * 0.8 - m2 * 0.5 - cam.position.z) * 0.03;
      cam.lookAt(0, 0.35 - m1 * (1 - m2) * 0.3, 0);

      renderer.clear();
      renderer.render(bgScene, bgCam);
      renderer.render(scene, cam);
    };
    const loop = (now) => { frame(now); raf = requestAnimationFrame(loop); };

    const onMouse = (e) => { mxT = e.clientX / window.innerWidth; myT = 1 - e.clientY / window.innerHeight; mStr = 1; };
    const onScroll = () => { if (reduce) frame(performance.now()); };
    const onResize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      cam.aspect = window.innerWidth / window.innerHeight;
      cam.updateProjectionMatrix();
      bgUni.uRes.value.set(window.innerWidth, window.innerHeight);
      if (reduce) frame(performance.now());
    };
    const onPulse = (e) => { if (!reduce) pulse = Math.min(1.3, pulse + (e.detail?.s ?? 0.7)); };
    const onTint = (e) => {
      tintTarget.set(e.detail?.c || '#C4A882');
      tintAT = e.detail?.a ?? 0;
      if (reduce) frame(performance.now());
    };

    window.addEventListener('mousemove', onMouse, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    window.addEventListener('meridian-pulse', onPulse);
    window.addEventListener('meridian-tint', onTint);

    if (reduce) frame(performance.now());
    else raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', onMouse);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('meridian-pulse', onPulse);
      window.removeEventListener('meridian-tint', onTint);
      geo.dispose(); mat.dispose(); bgGeo.dispose(); bgMat.dispose();
      renderer.dispose();
    };
  }, []);

  return <canvas ref={ref} className="presence-canvas" aria-hidden="true" />;
}

/* ══════════════════ Formless-style chat card ══════════════════ */

const SCRIPT = [
  {
    you: 'I’ve been carrying a lot lately. I don’t even know where to start.',
    ai: 'Then we don’t have to start anywhere in particular. There’s no clock on this. What feels heaviest right now?',
  },
  {
    you: 'I keep telling myself I’m failing at everything.',
    ai: 'That word — everything — is doing a lot of cruel work there. Could we hold just one piece of it up to the light together?',
  },
  {
    you: 'My mind won’t switch off at night.',
    ai: '2am thoughts are loud. Let’s slow the room down: in for four, hold for four, out for four. I’m right here while you do.',
  },
];
const STATUS = ['[ listening ]', '[ holding space ]', '[ reflecting ]'];

function TypingChat() {
  const [i, setI] = useState(0);
  const [typed, setTyped] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    const line = SCRIPT[i].ai;
    setTyped('');
    setDone(false);
    window.dispatchEvent(new CustomEvent('meridian-pulse', { detail: { s: 0.25 } }));
    let typer; let hold;
    const start = setTimeout(() => {
      let c = 0;
      typer = setInterval(() => {
        c += 1;
        setTyped(line.slice(0, c));
        if (c >= line.length) {
          clearInterval(typer);
          setDone(true);
          window.dispatchEvent(new CustomEvent('meridian-pulse', { detail: { s: 0.85 } }));
          hold = setTimeout(() => setI((p) => (p + 1) % SCRIPT.length), 3600);
        }
      }, 24);
    }, 850);
    return () => { clearTimeout(start); clearInterval(typer); clearTimeout(hold); };
  }, [i]);

  return (
    <aside className="hero-chat" aria-hidden="true">
      <div className="hero-chat__status">
        <span className="status-orb" />
        <span className="status-text">{STATUS[i % STATUS.length]}</span>
      </div>
      <div className="bubble bubble--you">{SCRIPT[i].you}</div>
      <div className="bubble bubble--ai">
        {typed}
        {!done && <span className="caret" />}
      </div>
    </aside>
  );
}

/* ═══════════════════════════ content ══════════════════════════ */

const ROOMS = [
  { tag: 'CBT', name: 'The Reframing Room', c: '#C4A882', d: 'Catch the thought loops — “always”, “never”, “everything” — and gently take them apart, one at a time.' },
  { tag: 'DBT', name: 'The Steady Room', c: '#8FA3B8', d: 'For when feelings run hot. Skills to ride the wave without being pulled under by it.' },
  { tag: 'ACT', name: 'The Open Room', c: '#B8856C', d: 'Make space for hard feelings instead of fighting them, and move toward what actually matters to you.' },
  { tag: 'Mindfulness', name: 'The Stillness Room', c: '#86A78D', d: 'Breath, body, this exact moment. Practices that quiet the noise without demanding silence.' },
  { tag: 'SFBT', name: 'The Forward Room', c: '#C2A06A', d: 'Less about what’s broken, more about what’s next: small, concrete steps you can take this week.' },
];

const STEPS = [
  { n: '01', t: 'You speak freely.', d: 'About your day, the 2am spirals, the things you haven’t said out loud. As much or as little as you want — there are no fields to fill.' },
  { n: '02', t: 'Your identity dissolves.', d: 'Before your words travel anywhere, names, places and anything identifying is removed and discarded. The feeling is kept and understood; the who never leaves your side.' },
  { n: '03', t: 'You’re met with skills, not scripts.', d: 'Guided one small, doable step at a time by techniques from established therapy frameworks — and the work carries forward between sessions, so you never start from zero.' },
];

const TICKS = [
  'Private by design', 'CBT · DBT · ACT · Mindfulness · SFBT', 'Your identity never enters the room',
  'Remembers the work, not the person', 'Crisis-safe, always', 'No forms — just talk', 'Here at 2am, and at 2pm',
];

function animateCounter(el) {
  const target = parseInt(el.getAttribute('data-target'), 10);
  const start = performance.now();
  const tick = (now) => {
    const p = Math.min((now - start) / 1800, 1);
    el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

const tint = (c, a) => window.dispatchEvent(new CustomEvent('meridian-tint', { detail: { c, a } }));

export default function Landing() {
  const navRef = useRef(null);

  useEffect(() => {
    const onScroll = () => navRef.current?.classList.toggle('lnav--scrolled', window.scrollY > 50);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add('revealed');
        e.target.querySelectorAll('.counter').forEach(animateCounter);
        observer.unobserve(e.target);
      }),
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    );
    document.querySelectorAll('[data-reveal]').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="landing-root">
      <PresenceScene />

      <header className="lnav-wrap">
        <nav ref={navRef} className="lnav" aria-label="Main">
          <Link to="/" className="lnav__logo serif">Meridian<span className="ldot" /></Link>
          <div className="lnav__links">
            <a href="#mindscape" className="lnav__link sans-label">The Mindscape</a>
            <a href="#how" className="lnav__link sans-label">How It Works</a>
            <a href="#safety" className="lnav__link sans-label">Safety</a>
            <Link to="/chat" className="btn btn--light btn--sm sans-label">Start Talking</Link>
          </div>
        </nav>
      </header>

      <main className="lmain">
        {/* ── HERO ───────────────────────────────────────────── */}
        <section className="hero">
          <div className="hero__inner">
            <p className="hero__eyebrow sans-label">A private space to be heard</p>
            <h1>
              <span className="hl"><span className="hl__in" style={{ '--i': 0 }}>A presence that listens,</span></span>
              <span className="hl"><span className="hl__in" style={{ '--i': 1 }}><i>not a form that asks.</i></span></span>
            </h1>
            <p className="hero__sub">
              Meridian is a private, evidence-based space to talk through whatever you’re
              carrying — real skills from CBT, DBT, ACT and mindfulness — while your name,
              location and anything identifying is stripped away before a single word is read.
            </p>
            <div className="hero__actions">
              <Link to="/chat" className="btn btn--light sans-label">Begin anonymously</Link>
              <a href="#mindscape" className="hero__more sans-label">Enter the mindscape ↓</a>
            </div>
          </div>
          <TypingChat />
          <div className="hero__hint sans-label">scroll — the presence follows</div>
        </section>

        {/* ── TICKER ─────────────────────────────────────────── */}
        <section className="ticker" aria-hidden="true">
          <div className="ticker__track">
            {[...TICKS, ...TICKS].map((t, i) => <span className="ticker__item" key={i}>{t}</span>)}
          </div>
        </section>

        {/* ── MINDSCAPE ROOMS ────────────────────────────────── */}
        <section id="mindscape" className="sec">
          <header className="sec__head" data-reveal>
            <span className="sec__eyebrow sans-label">The Mindscape</span>
            <h2 className="sec__title serif">Five rooms. One steady presence.</h2>
            <p className="sec__sub">
              As you scroll, the presence travels with you. Each room is a different
              evidence-based way of working — hover one and it answers. Switch between
              them mid-conversation, whenever you need.
            </p>
          </header>
          <div className="rooms">
            {ROOMS.map((r, i) => (
              <article
                key={r.tag}
                className="room"
                data-reveal
                style={{ '--i': i, '--rc': r.c }}
                onMouseEnter={() => tint(r.c, 0.55)}
                onMouseLeave={() => tint('#C4A882', 0)}
              >
                <span className="room__num serif">0{i + 1}</span>
                <span className="room__tag sans-label">{r.tag}</span>
                <h3 className="room__name serif">{r.name}</h3>
                <p className="room__desc">{r.d}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ── HOW IT WORKS ───────────────────────────────────── */}
        <section id="how" className="sec sec--rule">
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
          <div className="stats" data-reveal style={{ '--i': 4 }}>
            <div className="stat">
              <div className="stat__n serif"><span className="counter" data-target="100">0</span>%</div>
              <div className="stat__l sans-label">Anonymous, always</div>
            </div>
            <div className="stat">
              <div className="stat__n serif"><span className="counter" data-target="0">0</span></div>
              <div className="stat__l sans-label">Personal details stored</div>
            </div>
            <div className="stat">
              <div className="stat__n serif">24<span className="stat__sep">/</span>7</div>
              <div className="stat__l sans-label">Here when you are</div>
            </div>
          </div>
        </section>

        {/* ── SAFETY ─────────────────────────────────────────── */}
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

        {/* ── CTA ────────────────────────────────────────────── */}
        <section className="cta">
          <h2 className="serif" data-reveal>Step into the quiet.</h2>
          <p data-reveal style={{ '--i': 1 }}>
            No waitlists. No paperwork. No name required. Just a steady presence,
            open the moment you need it.
          </p>
          <Link to="/chat" className="btn btn--light sans-label" data-reveal style={{ '--i': 2 }}>
            Begin when you’re ready
          </Link>
        </section>
      </main>

      <footer className="lfoot">
        <div className="lfoot__top">
          <span className="lfoot__logo serif">Meridian</span>
          <p>
            No data sold. No conversations used to train AI. Privacy is built into
            every layer — not bolted on afterward.
          </p>
          <span className="lfoot__badge sans-label">Privacy-first · Evidence-based · Crisis-safe</span>
        </div>
        <div className="lfoot__bottom">
          © 2026 Meridian — automated support, not a replacement for emergency or clinical care.
        </div>
      </footer>
    </div>
  );
}